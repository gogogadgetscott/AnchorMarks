const path = require("path");

// Load environment from repository `apps/.env` explicitly so running from
// project root still picks up the correct file.
const _envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: _envPath, quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const https = require("https");
const fs = require("fs");
const helmet = require("helmet");
const smartOrg = require("./helpers/smart-organization");
const aiTags = require("./helpers/ai-tags");
const { v4: uuidv4 } = require("uuid");

const config = require("./config");
const { initializeDatabase, ensureDirectories } = require("./models/database");
const { authenticateToken, validateCsrfToken } = require("./middleware/index");
const { setupAuthRoutes } = require("./routes/auth");
const { isPrivateAddress, fetchFavicon } = require("./helpers/utils.js");
const {
  ensureTagsExist,
  updateBookmarkTags,
  getUserTags,
  getBookmarkTagsString,
} = require("./helpers/tag-helpers");

const app = express();
config.validateSecurityConfig();

// Initialize database
const db = initializeDatabase(config.DB_PATH);
const { FAVICONS_DIR, THUMBNAILS_DIR } = ensureDirectories();

// Middleware functions
const authenticateTokenMiddleware = authenticateToken(db);
const validateCsrfTokenMiddleware = validateCsrfToken(db);

const { makeFetchFaviconWrapper } = require("./helpers/favicon");

// Background jobs and thumbnail cache are handled in background.js
const { createBackgroundJobs } = require("./background");

// Create a favicon wrapper (was previously inline)
const fetchFaviconWrapper = makeFetchFaviconWrapper(
  fetchFavicon,
  db,
  FAVICONS_DIR,
  config.NODE_ENV,
);

const bg = createBackgroundJobs({
  db,
  ensureDirectories,
  fetchFavicon: fetchFaviconWrapper,
  isPrivateAddress,
  config,
});

// Rate limiter
const rateLimiter = require("./middleware/rateLimiter");

// Middleware registration
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(rateLimiter);

const dashboardModel = require("./models/dashboard");
const bookmarkViewModel = require("./models/bookmarkView");
const userSettingsModel = require("./models/userSettings");
const smartCollectionsModel = require("./models/smartCollections");
const syncModel = require("./models/sync");
const importExportModel = require("./models/importExport");
const quickSearchModel = require("./models/quickSearch");
const statsModel = require("./models/stats");
const bookmarkModel = require("./models/bookmark");
const tagHelpersLocal = require("./helpers/tags");
const {
  parseTags,
  mergeTags,
  stringifyTags,
  parseTagsDetailed,
  normalizeTagColorOverrides,
} = tagHelpersLocal;

// Route groups are delegated to route modules under apps/server/routes/
const setupDashboardRoutes = require("./routes/dashboard");
const setupBookmarkViewsRoutes = require("./routes/bookmarkViews");
const setupCollectionsRoutes = require("./routes/collections");
const setupBookmarksRoutes = require("./routes/bookmarks");
const setupTagsRoutes = require("./routes/tags");
const controllerTags = require("./controllers/tags");
const setupImportExportRoutes = require("./routes/importExport");

// Register authentication routes (login/register/me/logout)
setupAuthRoutes(app, db, authenticateTokenMiddleware, fetchFaviconWrapper);
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
setupBookmarksRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
  config,
});
setupTagsRoutes(app, db, { authenticateTokenMiddleware });
controllerTags.setupTagsRoutes(app, db, { authenticateTokenMiddleware });
setupImportExportRoutes(app, db, {
  authenticateTokenMiddleware,
  fetchFaviconWrapper,
});
setupSyncRoutes(app, db, { authenticateTokenMiddleware, fetchFaviconWrapper });
setupApiRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
  config,
});

const { fetchUrlMetadata, detectContentType } = require("./helpers/metadata");
const {
  parseHtmlMetadata,
  decodeHtmlEntities,
  generateBookmarkHtml,
} = require("./helpers/html");
const { parseBookmarkHtml } = require("./helpers/import");

// Route groups moved to dedicated modules
const setupQuickSearchRoutes = require("./routes/quickSearch");
const setupStatsRoutes = require("./routes/stats");
const setupHealthRoutes = require("./routes/health");

setupQuickSearchRoutes(app, db, { authenticateTokenMiddleware });
setupStatsRoutes(app, db, { authenticateTokenMiddleware });
setupHealthRoutes(app, db, {
  authenticateTokenMiddleware,
  fetchFaviconWrapper,
});

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
// Serve server-side static assets (favicons, thumbnails)
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

module.exports = app;
