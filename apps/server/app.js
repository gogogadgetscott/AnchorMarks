const path = require("path");

// Load environment from repository `.env` explicitly so running from
// project root still picks up the correct file.
const _envPath = path.join(__dirname, "..", "..", ".env");
require("dotenv").config({ path: _envPath, quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const fs = require("fs");
const helmet = require("helmet");

// Read app version from root package.json
let APP_VERSION = "unknown";
try {
  const pkg = require(path.join(__dirname, "..", "..", "package.json"));
  APP_VERSION = (pkg && pkg.version) || "unknown";
} catch {
  console.warn("package.json not found, version unknown");
}

const config = require("./config");
const { initializeDatabase, ensureDirectories } = require("./models/database");
const { authenticateToken, validateCsrfToken } = require("./middleware/index");
const { setupAuthRoutes } = require("./routes/auth");
const { isPrivateAddress, fetchFavicon } = require("./helpers/utils.js");

// API Documentation
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./helpers/swagger");

const app = express();
config.validateSecurityConfig();

// Trust first proxy (nginx, Docker, etc.) for accurate req.ip and rate limiting
if (config.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

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

// Initialize metadata queue for deferred favicon/thumbnail fetching during import
const { captureScreenshot } = require("./helpers/thumbnail");

metadataQueue.initialize(
  db,
  fetchFaviconWrapper,
  config.THUMBNAIL_ENABLED ? captureScreenshot : null,
);
if (config.NODE_ENV !== "test") {
  metadataQueue.startProcessor();
}

// Rate limiter
const rateLimiter = require("./middleware/rateLimiter");

// Performance monitoring
const { performanceMiddleware } = require("./helpers/performance-monitor");

// Middleware registration
// CSP violation reporting: enable with CSP_DIAGNOSTIC=true to narrow down which elements trigger script-src-attr violations.
// Reports are POSTed to /api/csp-report and logged (see route below).
const CSP_DIAGNOSTIC = process.env.CSP_DIAGNOSTIC === "true";

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
  // Edge's lazy-load placeholder intervention can inject handlers. Our code uses addEventListener.
  // When CSP_DIAGNOSTIC=true, use 'none' to trigger violations and report them for debugging.
  scriptSrcAttr: CSP_DIAGNOSTIC ? ["'none'"] : ["'unsafe-inline'"],
};
if (CSP_DIAGNOSTIC) {
  cspDirectives.reportUri = "/api/csp-report";
}

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

// Enhanced security headers (default CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    hsts: config.SSL_ENABLED
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    crossOriginOpenerPolicy: config.SSL_ENABLED
      ? { policy: "same-origin" }
      : false,
    originAgentCluster: config.SSL_ENABLED,
    crossOriginEmbedderPolicy: false, // Required for favicon loading from external sources
    xContentTypeOptions: true, // Prevent MIME type sniffing
    xXssProtection: true, // Legacy XSS protection header
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    frameguard: { action: "deny" },
  }),
);

// Relax CSP for inline-script bookmark pages (/addbookmark, /m-addbookmark)
// These static pages are self-hosted but require inline JS to prefill fields.
const relaxedCspDirectives = {
  ...cspDirectives,
  scriptSrc: [...(cspDirectives.scriptSrc || ["'self'"]), "'unsafe-inline'"],
};

app.use(
  ["/addbookmark", "/m-addbookmark"],
  helmet({
    contentSecurityPolicy: { directives: relaxedCspDirectives },
    hsts: false,
    crossOriginOpenerPolicy: config.SSL_ENABLED
      ? { policy: "same-origin" }
      : false,
    originAgentCluster: config.SSL_ENABLED,
  }),
);

// Relax CSP for API Docs (Swagger UI requires inline scripts/styles for its interactive UI)
const swaggerCspDirectives = {
  ...cspDirectives,
  scriptSrc: [
    ...(cspDirectives.scriptSrc || ["'self'"]),
    "'unsafe-inline'",
    "https://cdn.jsdelivr.net",
  ],
  styleSrc: [
    ...(cspDirectives.styleSrc || ["'self'"]),
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  imgSrc: [
    ...(cspDirectives.imgSrc || ["'self'"]),
    "data:",
    "https:",
    "https://validator.swagger.io",
  ],
  fontSrc: [
    ...(cspDirectives.fontSrc || ["'self'"]),
    "https://fonts.gstatic.com",
  ],
};

app.use(
  "/api/docs",
  helmet({
    contentSecurityPolicy: { directives: swaggerCspDirectives },
    hsts: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: ".swagger-ui .topbar { display: none }", // Hide topbar for cleaner look
    swaggerOptions: {
      persistAuthorization: true,
    },
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
app.use(
  cors({
    origin: config.resolveCorsOrigin(),
    credentials: true,
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "x-api-key"],
  }),
);
// Enable compression for all responses
app.use(compression({ level: 6, threshold: 1024 }));
app.use(
  express.json({
    limit: "10mb",
    type: ["application/json", "application/csp-report"],
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSP violation report endpoint (for CSP_DIAGNOSTIC mode).
// Browsers POST with Content-Type: application/csp-report; body: { "csp-report": { ... } }.
app.post("/api/csp-report", (req, res) => {
  const report = req.body?.["csp-report"] || req.body;
  if (report && CSP_DIAGNOSTIC) {
    console.warn("[CSP VIOLATION]", {
      directive: report["effective-directive"] || report["violated-directive"],
      blocked: report["blocked-uri"],
      document: report["document-uri"],
      source: report["source-file"],
      line: report["line-number"],
      column: report["column-number"],
      script:
        report["script-sample"] || report["original-policy"]?.slice?.(0, 80),
      raw: report,
    });
  }
  res.status(204).end();
});
app.use(performanceMiddleware); // Track performance before rate limiting
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
const controllerTags = require("./controllers/tags");
const setupImportExportRoutes = require("./routes/importExport");
const setupHealthRoutes = require("./routes/health");

// Register authentication routes (login/register/me/logout)
setupAuthRoutes(
  app,
  db,
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
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
setupCollectionsRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
});
controllerTags.setupTagsRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
});
setupImportExportRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
});
setupSyncRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
});
setupHealthRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
}); // Must be before setupApiRoutes to avoid /api/bookmarks/by-domain being shadowed
setupApiRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
  config,
  version: APP_VERSION,
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
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
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
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  }),
);
// Serve favicon.ico (browsers automatically request this)
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "icon.png"));
});

// Serve remaining public assets (if any)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(staticDir));

// Serve frontend for all other routes (static catch-all)
const setupStaticRoutes = require("./routes/static");
setupStaticRoutes(app);

// Global error handler — catches unhandled errors and prevents stack trace leaks
app.use((err, _req, res, _next) => {
  if (config.NODE_ENV === "development") {
    console.error("Unhandled error:", err);
  }
  res.status(err.status || 500).json({ error: "Internal Server Error" });
});

// Graceful shutdown
const { closeBrowser } = require("./helpers/thumbnail");

process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  metadataQueue.stopProcessor();
  await closeBrowser();
  db.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  metadataQueue.stopProcessor();
  await closeBrowser();
  db.close();
  process.exit(0);
});

// Expose helpers for tests
app._isPrivateAddress = isPrivateAddress;
app.db = db;
app.securityAudit = securityAudit;
app.fetchUrlMetadata = fetchUrlMetadata;

module.exports = app;
