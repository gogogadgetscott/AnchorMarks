const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per minute
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Periodic cleanup of expired rate limit entries to prevent memory leak
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, times] of requestCounts.entries()) {
    // Filter out expired entries
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      // Remove entries with no recent activity
      requestCounts.delete(key);
      cleaned++;
    } else if (recent.length < times.length) {
      // Update with filtered array if some entries were expired
      requestCounts.set(key, recent);
    }
  }
  if (process.env.NODE_ENV === "development" && cleaned > 0) {
    console.log(`[Rate Limiter] Cleaned up ${cleaned} expired entries`);
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

function rateLimiter(req, res, next) {
  try {
    // Skip rate limiting for static asset requests (favicons, thumbnails, JS/CSS/images)
    if (
      req.method === "GET" &&
      (req.path.startsWith("/favicons") ||
        req.path.startsWith("/thumbnails") ||
        /\.(png|jpg|jpeg|svg|gif|ico|css|js)$/.test(req.path))
    ) {
      return next();
    }

    // Skip rate limiting for maintenance operations (bulk updates)
    if (req.path.startsWith("/api/maintenance")) {
      return next();
    }

    // Skip rate limiting for health endpoints (monitoring, diagnostics)
    if (req.path.startsWith("/api/health")) {
      return next();
    }

    // Skip rate limiting for auth endpoints (login, register, me check)
    // These need to be accessible for initial app load
    if (req.path.startsWith("/api/auth/me") || req.path === "/api/auth/me") {
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
    const now = Date.now();
    const key =
      req.ip ||
      req.headers["x-forwarded-for"] ||
      (req.connection && req.connection.remoteAddress) ||
      "anon";
    const times = requestCounts.get(key) || [];
    // keep only recent entries
    const recent = times.filter((t) => now - t < RATE_LIMIT_WINDOW);
    recent.push(now);
    requestCounts.set(key, recent);
    if (recent.length > RATE_LIMIT_MAX) {
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    next();
  }
}

module.exports = rateLimiter;
