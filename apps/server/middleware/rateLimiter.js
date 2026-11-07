// Config via env:
// General API: RATE_LIMIT_MAX (default 60), RATE_LIMIT_WINDOW_MS (default 60000).
// Auth (login/register): RATE_LIMIT_AUTH_MAX (default 10), RATE_LIMIT_AUTH_WINDOW_MS (default 60000).
//   Auth attempts are persisted in SQLite so the brute-force window survives server restarts.
// API key writes (POST/PUT via API key): RATE_LIMIT_API_KEY_WRITE_MAX (default 30), same window.
// Maintenance: RATE_LIMIT_MAINTENANCE_MAX (default 20), RATE_LIMIT_MAINTENANCE_WINDOW_MS (default 60000).
// RATE_LIMIT_DISABLED=1 to turn off (e.g. when all traffic is one IP behind Docker/proxy).
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { logger } = require("../lib/logger");
const requestCounts = new Map();
const apiKeyWriteCounts = new Map();
const maintenanceRequestCounts = new Map();

const RATE_LIMIT_WINDOW =
  parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX, 10);
const effectiveMax =
  Number.isNaN(RATE_LIMIT_MAX) || RATE_LIMIT_MAX <= 0 ? 60 : RATE_LIMIT_MAX;

const RATE_LIMIT_AUTH_WINDOW =
  parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10) || 60000; // 1 minute
const RATE_LIMIT_AUTH_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10);
const effectiveAuthMax =
  Number.isNaN(RATE_LIMIT_AUTH_MAX) || RATE_LIMIT_AUTH_MAX <= 0
    ? 10
    : RATE_LIMIT_AUTH_MAX;

const RATE_LIMIT_MAINTENANCE_WINDOW =
  parseInt(process.env.RATE_LIMIT_MAINTENANCE_WINDOW_MS, 10) || 60000; // 1 minute
const RATE_LIMIT_MAINTENANCE_MAX = parseInt(
  process.env.RATE_LIMIT_MAINTENANCE_MAX,
  10,
);
const effectiveMaintenanceMax =
  Number.isNaN(RATE_LIMIT_MAINTENANCE_MAX) || RATE_LIMIT_MAINTENANCE_MAX <= 0
    ? 20
    : RATE_LIMIT_MAINTENANCE_MAX;

const RATE_LIMIT_API_KEY_WRITE_MAX = parseInt(
  process.env.RATE_LIMIT_API_KEY_WRITE_MAX,
  10,
);
const effectiveApiKeyWriteMax =
  Number.isNaN(RATE_LIMIT_API_KEY_WRITE_MAX) ||
  RATE_LIMIT_API_KEY_WRITE_MAX <= 0
    ? 30
    : RATE_LIMIT_API_KEY_WRITE_MAX;

const RATE_LIMIT_DISABLED =
  process.env.RATE_LIMIT_DISABLED === "1" ||
  process.env.RATE_LIMIT_DISABLED === "true";
const effectiveMaxOrNull = RATE_LIMIT_DISABLED ? null : effectiveMax;

const CLEANUP_INTERVAL = 300000; // 5 minutes

// SQLite helpers for persistent auth rate limiting (survives server restarts)
function incrementAuthCount(db, key, windowMs) {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  db.prepare(
    `INSERT INTO rate_limit_auth_attempts (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`,
  ).run(key, windowStart);
  return db
    .prepare(
      "SELECT count FROM rate_limit_auth_attempts WHERE key = ? AND window_start = ?",
    )
    .get(key, windowStart).count;
}

function getWindowStartMs(windowMs) {
  return Math.floor(Date.now() / windowMs) * windowMs;
}

// Periodic cleanup of expired rate limit entries to prevent memory/disk leak
function cleanupExpiredEntries(db) {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, times] of requestCounts.entries()) {
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      requestCounts.delete(key);
      cleaned++;
    } else if (recent.length < times.length) {
      requestCounts.set(key, recent);
    }
  }
  for (const [key, times] of apiKeyWriteCounts.entries()) {
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      apiKeyWriteCounts.delete(key);
      cleaned++;
    } else if (recent.length < times.length) {
      apiKeyWriteCounts.set(key, recent);
    }
  }
  for (const [key, times] of maintenanceRequestCounts.entries()) {
    const recent = times.filter((t) => now - t < RATE_LIMIT_MAINTENANCE_WINDOW);
    if (recent.length === 0) {
      maintenanceRequestCounts.delete(key);
      cleaned++;
    } else if (recent.length < times.length) {
      maintenanceRequestCounts.set(key, recent);
    }
  }
  // Purge SQLite auth attempts older than two windows
  if (db) {
    const cutoff = now - RATE_LIMIT_AUTH_WINDOW * 2;
    db.prepare(
      "DELETE FROM rate_limit_auth_attempts WHERE window_start < ?",
    ).run(cutoff);
  }
  if (process.env.NODE_ENV === "development" && cleaned > 0) {
    logger.debug(`Rate limiter: cleaned up ${cleaned} expired entries`);
  }
}

// Start periodic cleanup — called from createRateLimiter once db is available.
// Runs in every environment except tests so the in-memory maps cannot grow
// without bound in dev/staging deployments; the timer is unref()ed so it never
// keeps the process alive.
let cleanupInterval = null;
function startCleanup(db) {
  if (cleanupInterval) return; // already started
  if (process.env.NODE_ENV === "test") return;
  cleanupInterval = setInterval(
    () => cleanupExpiredEntries(db),
    CLEANUP_INTERVAL,
  );
  if (cleanupInterval.unref) cleanupInterval.unref();
  const stop = () => {
    if (cleanupInterval) clearInterval(cleanupInterval);
    cleanupInterval = null;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

// Build the rate-limit bucket key for a request.
// Prefer a stable per-user key so that traffic behind a reverse proxy / Docker
// NAT (where every client shares one source IP) does not exhaust a single
// bucket. Unauthenticated traffic falls back to the client IP so the
// login/register brute-force limits stay per-source.
function getClientKey(req) {
  // 1) Authenticated session: verify the JWT cookie (cheap HMAC check) and
  //    key the bucket by user id.
  try {
    const token = req.cookies && req.cookies[`${config.COOKIE_PREFIX}token`];
    if (token) {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const userId = decoded.userId || decoded.id;
      if (userId) return `u:${userId}`;
    }
  } catch {
    // Invalid/expired token — fall through to IP keying.
  }

  // 2) API key: hash it so the raw key never sits in an in-memory map.
  const apiKey = req.headers && req.headers["x-api-key"];
  if (apiKey) {
    const digest = crypto
      .createHash("sha256")
      .update(String(apiKey))
      .digest("hex")
      .slice(0, 24);
    return `k:${digest}`;
  }

  // 3) Everything else: source IP.
  return (
    req.ip ||
    (req.headers && req.headers["x-forwarded-for"]) ||
    (req.connection && req.connection.remoteAddress) ||
    "anon"
  );
}

function sendRateLimitExceeded(res, retryAfterSeconds) {
  if (retryAfterSeconds > 0 && retryAfterSeconds <= 3600) {
    res.setHeader("Retry-After", String(Math.ceil(retryAfterSeconds)));
  }
  return res.status(429).json({ error: "Rate limit exceeded" });
}

function createRateLimiter(db) {
  startCleanup(db);

  return function rateLimiter(req, res, next) {
    return rateLimiterImpl(db, req, res, next);
  };
}

function rateLimiterImpl(db, req, res, next) {
  try {
    const now = Date.now();
    const key = getClientKey(req);

    // Stricter rate limit for login/register (brute-force protection).
    // Counts are persisted in SQLite so the window survives server restarts.
    const isAuthStrict =
      req.method === "POST" &&
      (req.path === "/api/auth/login" || req.path === "/api/auth/register");
    if (isAuthStrict) {
      const count = incrementAuthCount(db, key, RATE_LIMIT_AUTH_WINDOW);
      if (count > effectiveAuthMax) {
        const windowStart = getWindowStartMs(RATE_LIMIT_AUTH_WINDOW);
        const retryAfter = (windowStart + RATE_LIMIT_AUTH_WINDOW - now) / 1000;
        return sendRateLimitExceeded(res, retryAfter);
      }
      return next();
    }

    if (effectiveMaxOrNull === null) return next();

    // Skip rate limiting for static asset requests (favicons, thumbnails, JS/CSS/images)
    if (
      req.method === "GET" &&
      (req.path.startsWith("/favicons") ||
        req.path.startsWith("/thumbnails") ||
        /\.(png|jpg|jpeg|svg|gif|ico|css|js)$/.test(req.path))
    ) {
      return next();
    }

    // Stricter rate limit for maintenance (check-link, duplicates, optimize) to prevent resource exhaustion
    if (req.path.startsWith("/api/maintenance")) {
      if (RATE_LIMIT_DISABLED) return next();
      const mKey = getClientKey(req);
      const mTimes = maintenanceRequestCounts.get(mKey) || [];
      const mRecent = mTimes.filter(
        (t) => now - t < RATE_LIMIT_MAINTENANCE_WINDOW,
      );
      mRecent.push(now);
      maintenanceRequestCounts.set(mKey, mRecent);
      if (mRecent.length > effectiveMaintenanceMax) {
        const retryAfter =
          (mRecent[0] + RATE_LIMIT_MAINTENANCE_WINDOW - now) / 1000;
        return sendRateLimitExceeded(res, retryAfter);
      }
      return next();
    }

    // Skip rate limiting for health endpoints (monitoring, diagnostics)
    if (req.path.startsWith("/api/health")) {
      return next();
    }

    // Skip rate limiting for read-only auth (me, refresh) to avoid blocking normal use
    if (
      req.path.startsWith("/api/auth/me") ||
      req.path === "/api/auth/me" ||
      req.path.startsWith("/api/auth/refresh") ||
      req.path === "/api/auth/refresh"
    ) {
      return next();
    }

    // Skip rate limiting for bulk bookmark favicon updates (PUT with only favicon field)
    if (
      req.method === "PUT" &&
      req.path.startsWith("/api/bookmarks/") &&
      req.body &&
      Object.keys(req.body).length === 1 &&
      req.body.favicon
    ) {
      return next();
    }

    // Separate, stricter rate limit for API-key write operations.
    // Check for the x-api-key header directly (rate limiter runs before auth middleware).
    // A leaked key must not allow rapid data modification without a session CSRF barrier.
    if (
      req.headers["x-api-key"] &&
      (req.method === "POST" || req.method === "PUT")
    ) {
      const wTimes = apiKeyWriteCounts.get(key) || [];
      const wRecent = wTimes.filter((t) => now - t < RATE_LIMIT_WINDOW);
      wRecent.push(now);
      apiKeyWriteCounts.set(key, wRecent);
      if (wRecent.length > effectiveApiKeyWriteMax) {
        const retryAfter = (wRecent[0] + RATE_LIMIT_WINDOW - now) / 1000;
        return sendRateLimitExceeded(res, retryAfter);
      }
      return next();
    }

    const times = requestCounts.get(key) || [];
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW);
    recent.push(now);
    requestCounts.set(key, recent);
    if (recent.length > effectiveMax) {
      const retryAfter = (recent[0] + RATE_LIMIT_WINDOW - now) / 1000;
      return sendRateLimitExceeded(res, retryAfter);
    }
    next();
  } catch (err) {
    logger.error("Rate limiter error", err);
    next();
  }
}

module.exports = createRateLimiter;
// Test hooks: exercise the limiter with fake req/res without going through
// a full Express app, and reset the in-memory buckets between tests.
module.exports.rateLimiterImpl = rateLimiterImpl;
module.exports.getClientKey = getClientKey;
module.exports._maps = {
  requestCounts,
  apiKeyWriteCounts,
  maintenanceRequestCounts,
};
// Effective limits resolved from env at module load — tests need them so a
// 429 test can hit the exact threshold without hardcoding 60/30.
module.exports._effectiveMax = effectiveMax;
module.exports._effectiveApiKeyWriteMax = effectiveApiKeyWriteMax;
module.exports._effectiveAuthMax = effectiveAuthMax;
