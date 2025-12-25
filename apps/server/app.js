const path = require("path");

// Load environment from repository `apps/.env` explicitly so running from
// project root still picks up the correct file.
const _envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: _envPath, quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const helmet = require("helmet");

const config = require("./config");
const { initializeDatabase, ensureDirectories } = require("./models/database");
const { authenticateToken, validateCsrfToken } = require("./middleware/index");
const { setupAuthRoutes } = require("./routes/auth");
const { isPrivateAddress, fetchFavicon } = require("./helpers/utils.js");

const app = express();
config.validateSecurityConfig();

// Initialize database
const db = initializeDatabase(config.DB_PATH);
const { FAVICONS_DIR } = ensureDirectories();

// Initialize security audit logging
const {
  initializeAuditLog,
  createSecurityAuditLogger,
} = require("./helpers/security-audit");
initializeAuditLog(db);
const securityAudit = createSecurityAuditLogger(db, {
  enableFileLogging: process.env.SECURITY_LOG_FILE === "true",
  retentionDays: parseInt(process.env.SECURITY_LOG_RETENTION_DAYS) || 90,
});

// Middleware functions
const authenticateTokenMiddleware = authenticateToken(db);
const validateCsrfTokenMiddleware = validateCsrfToken(db);

const { makeFetchFaviconWrapper } = require("./helpers/favicon");
const metadataQueue = require("./helpers/metadata-queue");

// Background jobs and thumbnail cache are handled in background.js
const { createBackgroundJobs } = require("./background");

// Create a favicon wrapper (was previously inline)
const fetchFaviconWrapper = makeFetchFaviconWrapper(
  fetchFavicon,
  db,
  FAVICONS_DIR,
  config.NODE_ENV,
);

// Background jobs initialization (runs automatically, returns job instance)
createBackgroundJobs({
  db,
  ensureDirectories,
  fetchFavicon: fetchFaviconWrapper,
  isPrivateAddress,
  config,
});

// Initialize metadata queue for deferred favicon fetching during import
metadataQueue.initialize(db, fetchFaviconWrapper);
if (config.NODE_ENV !== "test") {
  metadataQueue.startProcessor();
}

// Rate limiter
const rateLimiter = require("./middleware/rateLimiter");

// Middleware registration
// Enhanced helmet configuration for security hardening
// CSP is environment-aware: relaxed for development (Vite HMR), strict for production
const cspDirectives = {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"], // Inline styles needed for dynamic theming
  fontSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'", "https:", "wss:"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

// Development: Allow unsafe-inline/unsafe-eval for Vite HMR
if (config.NODE_ENV === "development") {
  cspDirectives.scriptSrc = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
  cspDirectives.connectSrc.push("ws:", "wss:"); // WebSocket for Vite HMR
} else {
  // Production: Strict CSP - no unsafe-inline/unsafe-eval
  cspDirectives.scriptSrc = ["'self'"];
  // Note: 'strict-dynamic' with nonces would be the modern approach for production.
  // Currently all scripts are self-hosted, so 'self' is sufficient.
  // If external CDN scripts are added, use the SRI helper: helpers/sri.js
}

// Enhanced security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    hsts: config.SSL_ENABLED
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: false, // Required for favicon loading from external sources
    xContentTypeOptions: true, // Prevent MIME type sniffing
    xXssProtection: true, // Legacy XSS protection header
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
  }),
);
// Additional manual headers for redundancy
app.use((req, res, next) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(rateLimiter);

// Models are imported in individual route modules as needed
// Keeping these commented out for reference:
// const dashboardModel = require("./models/dashboard");
// const bookmarkViewModel = require("./models/bookmarkView");
// const userSettingsModel = require("./models/userSettings");
// const smartCollectionsModel = require("./models/smartCollections");
// const syncModel = require("./models/sync");
// const importExportModel = require("./models/importExport");
// const quickSearchModel = require("./models/quickSearch");
// const statsModel = require("./models/stats");
// const bookmarkModel = require("./models/bookmark");
// const tagHelpersLocal = require("./helpers/tags");

// Route groups are delegated to route modules under apps/server/routes/
const setupDashboardRoutes = require("./routes/dashboard");
const setupBookmarkViewsRoutes = require("./routes/bookmarkViews");
const setupCollectionsRoutes = require("./routes/collections");
const setupTagsRoutes = require("./routes/tags");
const controllerTags = require("./controllers/tags");
const setupImportExportRoutes = require("./routes/importExport");
const setupHealthRoutes = require("./routes/health");

// Register authentication routes (login/register/me/logout)
setupAuthRoutes(
  app,
  db,
  authenticateTokenMiddleware,
  fetchFaviconWrapper,
  securityAudit,
);
const setupSyncRoutes = require("./routes/sync");
const { setupApiRoutes } = require("./routes/api");

setupDashboardRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
});
setupBookmarkViewsRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
});
setupCollectionsRoutes(app, db, { authenticateTokenMiddleware });
setupTagsRoutes(app, db, { authenticateTokenMiddleware });
controllerTags.setupTagsRoutes(app, db, { authenticateTokenMiddleware });
setupImportExportRoutes(app, db, {
  authenticateTokenMiddleware,
});
setupSyncRoutes(app, db, { authenticateTokenMiddleware, fetchFaviconWrapper });
setupHealthRoutes(app, db, {
  authenticateTokenMiddleware,
  fetchFaviconWrapper,
}); // Must be before setupApiRoutes to avoid /api/bookmarks/by-domain being shadowed
setupApiRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
  config,
});

// Helper functions are imported in route modules as needed
const { fetchUrlMetadata } = require("./helpers/metadata");

// Route groups moved to dedicated modules
const setupQuickSearchRoutes = require("./routes/quickSearch");
const setupStatsRoutes = require("./routes/stats");

setupQuickSearchRoutes(app, db, { authenticateTokenMiddleware });
setupStatsRoutes(app, db, { authenticateTokenMiddleware });

// Smart organization routes moved to `routes/smartOrganization.js`
const setupSmartOrganizationRoutes = require("./routes/smartOrganization");
setupSmartOrganizationRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
});

// Serve frontend assets
// In development: Vite dev server runs on port 5173, Express serves API on port 3000
// In production: Express serves built Vite assets from dist/
const staticDir =
  config.NODE_ENV === "production" &&
    fs.existsSync(path.join(__dirname, "..", "client", "dist"))
    ? path.join(__dirname, "..", "client", "dist")
    : path.join(__dirname, "..", "client");

console.log(`Serving frontend from: ${staticDir} (${config.NODE_ENV} mode)`);

// Serve server-side static assets with explicit Content-Type enforcement
// This prevents potential XSS via MIME type confusion
app.use(
  "/favicons",
  express.static(path.join(__dirname, "public", "favicons"), {
    setHeaders: (res, _filePath) => {
      // Force image content types for favicon directory - no HTML/SVG execution
      res.setHeader("Content-Type", "image/png");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);
app.use(
  "/thumbnails",
  express.static(path.join(__dirname, "public", "thumbnails"), {
    setHeaders: (res, _filePath) => {
      // Force image content types for thumbnails directory
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);
// Serve remaining public assets (if any)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(staticDir));

// Serve frontend for all other routes (static catch-all)
const setupStaticRoutes = require("./routes/static");
setupStaticRoutes(app);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nClosing database connection...");
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nClosing database connection...");
  db.close();
  process.exit(0);
});

// Expose helpers for tests
app._isPrivateAddress = isPrivateAddress;
app.db = db;
app.securityAudit = securityAudit;
app.fetchUrlMetadata = fetchUrlMetadata;

module.exports = app;
