const createAuthRouter = require("./auth");
const createBookmarksRouter = require("./bookmarks");
const createTagsRouter = require("./tags");
const createFoldersRouter = require("./folders");
const createDashboardRouter = require("./dashboard");
const createBookmarkViewsRouter = require("./bookmarkViews");
const createCollectionsRouter = require("./collections");
const createHealthRouter = require("./health");
const createMaintenanceRouter = require("./maintenance");
const createQuickSearchRouter = require("./quickSearch");
const createStatsRouter = require("./stats");
const createSyncRouter = require("./sync");
const createSettingsRouter = require("./settings");
const createImportExportRouter = require("./importExport");
const createSmartOrganizationRouter = require("./smartOrganization");
const { getApiHealth } = require("../controllers/settingsController");

module.exports = function mountRoutes(app, db) {
  // Unauthenticated health check
  app.get("/api/health", getApiHealth);

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api/bookmarks", createBookmarksRouter(db));
  app.use("/api/tags", createTagsRouter(db));
  app.use("/api/folders", createFoldersRouter(db));
  app.use("/api/dashboard", createDashboardRouter(db));
  app.use("/api/bookmark/views", createBookmarkViewsRouter(db));
  app.use("/api/collections", createCollectionsRouter(db));
  app.use("/api/health", createHealthRouter(db));
  app.use("/api/maintenance", createMaintenanceRouter(db));
  app.use("/api/quick-search", createQuickSearchRouter(db));
  app.use("/api/stats", createStatsRouter(db));
  app.use("/api/sync", createSyncRouter(db));
  app.use("/api/settings", createSettingsRouter(db));
  // Import/export and smart-org routes span multiple path prefixes — mount at /api
  app.use("/api", createImportExportRouter(db));
  app.use("/api", createSmartOrganizationRouter(db));
};
