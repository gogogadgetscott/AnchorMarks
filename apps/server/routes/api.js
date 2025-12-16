const { setupAuthRoutes } = require("./auth");
const { setupBookmarksRoutes } = require("../controllers/bookmarks");

function setupApiRoutes(app, db, helpers) {
  const {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper,
    config,
  } = helpers;

  // Health
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      version: "1.0.0",
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Auth routes (register/login/etc.)
  setupAuthRoutes(app, db, authenticateTokenMiddleware, fetchFaviconWrapper);

  // Bookmarks routes (migrated into controller)
  setupBookmarksRoutes(app, db, {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper,
    config,
  });

  // Folders routes (migrated into controller)
  const { setupFoldersRoutes } = require("../controllers/folders");
  setupFoldersRoutes(app, db, {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
  });

  // Tags routes (migrated into controller)
  const { setupTagsRoutes } = require("../controllers/tags");
  setupTagsRoutes(app, db, {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
  });

  // Save/update user settings
  const userSettingsModel = require("../models/userSettings");
  app.put(
    "/api/settings",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        userSettingsModel.upsertUserSettings(db, req.user.id, req.body);

        const settings = db
          .prepare("SELECT * FROM user_settings WHERE user_id = ?")
          .get(req.user.id);

        if (!settings) return res.json({});

        res.json({
          view_mode: settings.view_mode || "grid",
          hide_favicons: settings.hide_favicons === 1,
          hide_sidebar: settings.hide_sidebar === 1,
          ai_suggestions_enabled: settings.ai_suggestions_enabled !== 0,
          theme: settings.theme || "dark",
          dashboard_mode: settings.dashboard_mode || "folder",
          dashboard_tags: settings.dashboard_tags
            ? JSON.parse(settings.dashboard_tags)
            : [],
          dashboard_sort: settings.dashboard_sort || "updated_desc",
          widget_order: settings.widget_order
            ? JSON.parse(settings.widget_order)
            : {},
          dashboard_widgets: settings.dashboard_widgets
            ? JSON.parse(settings.dashboard_widgets)
            : [],
          collapsed_sections: settings.collapsed_sections
            ? JSON.parse(settings.collapsed_sections)
            : [],
          include_child_bookmarks: settings.include_child_bookmarks || 0,
          current_view: settings.current_view || "all",
          snap_to_grid: settings.snap_to_grid === 1,
        });
      } catch (err) {
        console.error("Error saving settings:", err);
        res.status(500).json({ error: "Failed to save settings" });
      }
    },
  );

  // Maintenance routes
  const setupMaintenanceRoutes = require("./maintenance");
  app.use(
    "/api/maintenance",
    setupMaintenanceRoutes(db, authenticateTokenMiddleware),
  );

  // Settings API
  app.get("/api/settings", authenticateTokenMiddleware, (req, res) => {
    try {
      const settings = db
        .prepare("SELECT * FROM user_settings WHERE user_id = ?")
        .get(req.user.id);
      if (!settings) {
        res.json({
          view_mode: "grid",
          hide_favicons: false,
          hide_sidebar: false,
          ai_suggestions_enabled: true,
          theme: "dark",
          dashboard_mode: "folder",
          dashboard_tags: [],
          dashboard_sort: "updated_desc",
          widget_order: {},
          collapsed_sections: [],
        });
        return;
      }

      res.json({
        view_mode: settings.view_mode || "grid",
        hide_favicons: settings.hide_favicons === 1,
        hide_sidebar: settings.hide_sidebar === 1,
        ai_suggestions_enabled: settings.ai_suggestions_enabled !== 0,
        theme: settings.theme || "dark",
        dashboard_mode: settings.dashboard_mode || "folder",
        dashboard_tags: settings.dashboard_tags
          ? JSON.parse(settings.dashboard_tags)
          : [],
        dashboard_sort: settings.dashboard_sort || "updated_desc",
        widget_order: settings.widget_order
          ? JSON.parse(settings.widget_order)
          : {},
        dashboard_widgets: settings.dashboard_widgets
          ? JSON.parse(settings.dashboard_widgets)
          : [],
        collapsed_sections: settings.collapsed_sections
          ? JSON.parse(settings.collapsed_sections)
          : [],
        include_child_bookmarks: settings.include_child_bookmarks || 0,
        current_view: settings.current_view || "all",
        snap_to_grid: settings.snap_to_grid === 1,
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // AI tag suggestions
  const aiTags = require("../helpers/ai-tags");
  const { isPrivateAddress } = require("../helpers/utils");

  app.get(
    "/api/tags/suggest-ai",
    authenticateTokenMiddleware,
    async (req, res) => {
      const { url, limit = 10 } = req.query;
      if (!url)
        return res.status(400).json({ error: "URL parameter required" });

      let urlObj;
      try {
        urlObj = new URL(url);
      } catch (e) {
        return res.status(400).json({ error: "Invalid URL" });
      }

      try {
        const userTags = db
          .prepare("SELECT DISTINCT name FROM tags WHERE user_id = ?")
          .all(req.user.id)
          .map((row) => row.name);
        const aiConfig = config.getAIConfig
          ? config.getAIConfig()
          : { provider: "none" };
        const suggestions = await aiTags.suggestTagsAI(
          { url, title: null, limit: parseInt(limit), userTags },
          aiConfig,
        );

        res.json({
          suggestions,
          info: { provider: aiConfig.provider, model: aiConfig.model || null },
        });
      } catch (err) {
        if (
          err &&
          (err.code === "AI_NOT_CONFIGURED" ||
            err.code === "AI_KEY_MISSING" ||
            err.code === "AI_UNSUPPORTED")
        ) {
          return res.status(501).json({ error: err.message });
        }
        console.error("AI tag suggestions error:", err);
        return res.status(500).json({ error: "Failed to get AI suggestions" });
      }
    },
  );
}

module.exports = { setupApiRoutes };
