// Config via env:
// General API: RATE_LIMIT_MAX (default 60), RATE_LIMIT_WINDOW_MS (default 60000).
// Auth (login/register): RATE_LIMIT_AUTH_MAX (default 10), RATE_LIMIT_AUTH_WINDOW_MS (default 60000).
// Maintenance: RATE_LIMIT_MAINTENANCE_MAX (default 20), RATE_LIMIT_MAINTENANCE_WINDOW_MS (default 60000).
// RATE_LIMIT_DISABLED=1 to turn off (e.g. when all traffic is one IP behind Docker/proxy).
const { logger } = require("../lib/logger");
const requestCounts = new Map();
const authRequestCounts = new Map();
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

const RATE_LIMIT_DISABLED =
  process.env.RATE_LIMIT_DISABLED === "1" ||
  process.env.RATE_LIMIT_DISABLED === "true";
const effectiveMaxOrNull = RATE_LIMIT_DISABLED ? null : effectiveMax;

const CLEANUP_INTERVAL = 300000; // 5 minutes

// Periodic cleanup of expired rate limit entries to prevent memory leak
function cleanupExpiredEntries() {
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
  for (const [key, times] of authRequestCounts.entries()) {
    const recent = times.filter((t) => now - t < RATE_LIMIT_AUTH_WINDOW);
    if (recent.length === 0) {
      authRequestCounts.delete(key);
      cleaned++;
    } else if (recent.length < times.length) {
      authRequestCounts.set(key, recent);
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
  if (process.env.NODE_ENV === "development" && cleaned > 0) {
    logger.debug(`Rate limiter: cleaned up ${cleaned} expired entries`);
  }
}

// Start periodic cleanup
let cleanupInterval = null;
if (process.env.NODE_ENV === "production") {
  cleanupInterval = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);
  // Cleanup on process exit
  process.on("SIGTERM", () => {
    if (cleanupInterval) clearInterval(cleanupInterval);
  });
  process.on("SIGINT", () => {
    if (cleanupInterval) clearInterval(cleanupInterval);
  });
}

function getClientKey(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
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

function rateLimiter(req, res, next) {
  try {
    const now = Date.now();
    const key = getClientKey(req);

    // Stricter rate limit for login/register (brute-force protection)
    const isAuthStrict =
      req.method === "POST" &&
      (req.path === "/api/auth/login" || req.path === "/api/auth/register");
    if (isAuthStrict) {
      const times = authRequestCounts.get(key) || [];
      const recent = times.filter((t) => now - t < RATE_LIMIT_AUTH_WINDOW);
      recent.push(now);
      authRequestCounts.set(key, recent);
      if (recent.length > effectiveAuthMax) {
        const retryAfter = (recent[0] + RATE_LIMIT_AUTH_WINDOW - now) / 1000;
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

module.exports = rateLimiter;
