const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

function setupMiddleware(app, { config, validateCsrfTokenMiddleware }) {
  const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
    connectSrc: ["'self'"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
  };

  app.use(
    helmet({
      contentSecurityPolicy: { directives: cspDirectives },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
    }),
  );

  if (config.NODE_ENV === "production") {
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });
  }

  const corsOptions = {
    origin: config.resolveCorsOrigin(),
    credentials: true,
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "x-api-key"],
  };
  app.use(cors(corsOptions));
  app.use(cookieParser());

  // Rate limiting for API
  const requestCounts = new Map();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const RATE_LIMIT_MAX = 100; // requests per minute
  const CLEANUP_INTERVAL = 300000; // 5 minutes

  // Periodic cleanup of expired rate limit entries to prevent memory leak
  function cleanupExpiredEntries() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, record] of requestCounts.entries()) {
      if (now > record.resetTime) {
        requestCounts.delete(key);
        cleaned++;
      }
    }
    if (config.NODE_ENV === "development" && cleaned > 0) {
      console.log(`[Rate Limiter] Cleaned up ${cleaned} expired entries`);
    }
  }

  // Start periodic cleanup (only in production where rate limiting is active)
  let cleanupInterval = null;
  if (config.NODE_ENV === "production") {
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
    if (config.NODE_ENV !== "production") return next();

    const key = req.ip;
    const now = Date.now();

    if (!requestCounts.has(key)) {
      requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
      const record = requestCounts.get(key);
      if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
      } else {
        record.count++;
        if (record.count > RATE_LIMIT_MAX) {
          return res.status(429).json({ error: "Too many requests" });
        }
      }
    }
    next();
  }

  app.use("/api", rateLimiter);
  app.use(express.json({ limit: "10mb" }));

  // Request logging
  app.use((req, res, next) => {
    if (config.NODE_ENV === "development") {
      console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    }
    next();
  });

  app.use(
    express.static(path.join(__dirname, "../public"), {
      maxAge: config.NODE_ENV === "production" ? "1d" : 0,
    }),
  );

  // Apply CSRF validation to state-changing operations (skip auth endpoints)
  app.use("/api", (req, res, next) => {
    const unauthenticatedPaths = ["/auth/login", "/auth/register", "/health"];

    if (
      unauthenticatedPaths.some((p) => req.url === p || req.url.startsWith(p))
    ) {
      return next();
    }

    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      return validateCsrfTokenMiddleware(req, res, next);
    }
    next();
  });
}

// Export middleware setup and auth helpers
const jwt = require("jsonwebtoken");
const { JWT_SECRET, isApiKeyAllowed } = require("../config");

function authenticateToken(db) {
  return (req, res, next) => {
    const apiKey = req.headers["x-api-key"];

    // Scoped API key support (Flow Launcher / extension)
    if (apiKey) {
      const user = db
        .prepare("SELECT * FROM users WHERE api_key = ?")
        .get(apiKey);
      if (user) {
        if (!isApiKeyAllowed(req)) {
          console.warn(
            `[API-KEY 403] User ${user.id} attempted ${req.method} ${req.path} (not whitelisted)`,
          );
          return res.status(403).json({
            error: "API key not permitted for this endpoint.",
            suggestion:
              "Check allowed endpoints and methods in server config. Only GET /api/bookmarks, POST /api/bookmarks, GET /api/folders, and GET /api/quick-search are permitted by API key.",
            tip: "Use 'x-api-key' (all lowercase) as the header name.",
          });
        }
        req.user = user;
        req.authType = "api-key";
        return next();
      } else {
        console.warn(
          `[API-KEY 403] Invalid API key received: ${apiKey} for ${req.method} ${req.path}`,
        );
        return res.status(403).json({
          error: "Invalid API key.",
          suggestion:
            "Verify your API key is correct and active. Use the value from your user profile.",
          tip: "Use 'x-api-key' (all lowercase) as the header name.",
        });
      }
    }

    // JWT from HTTP-only cookie
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(decoded.userId);
      if (!req.user) {
        return res.status(401).json({ error: "User not found" });
      }
      req.authType = "jwt";
      next();
    } catch {
      res.clearCookie("token");
      return res.status(403).json({ error: "Invalid token" });
    }
  };
}

function validateCsrfToken(db) {
  return (req, res, next) => {
    // Skip CSRF check for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

    // Check if using API key auth - skip CSRF for API keys
    const apiKey = req.headers["x-api-key"];
    if (apiKey) {
      const user = db
        .prepare("SELECT * FROM users WHERE api_key = ?")
        .get(apiKey);
      if (user) {
        return next(); // API key bypass CSRF
      }
    }

    // Enforce double-submit: require X-CSRF-Token header and match cookie
    const csrfToken = req.headers["x-csrf-token"];
    const sessionCsrf = req.cookies.csrfToken;

    if (!csrfToken) {
      return res.status(403).json({
        error:
          "Missing X-CSRF-Token header. Please include the CSRF token in your request headers.",
      });
    }
    if (!sessionCsrf) {
      return res.status(403).json({
        error:
          "Missing CSRF cookie. Please log in again to obtain a new CSRF token.",
      });
    }
    if (csrfToken !== sessionCsrf) {
      return res.status(403).json({
        error:
          "CSRF token mismatch. Please refresh the page or re-authenticate.",
      });
    }
    next();
  };
}

module.exports = {
  setupMiddleware,
  authenticateToken,
  validateCsrfToken,
};
