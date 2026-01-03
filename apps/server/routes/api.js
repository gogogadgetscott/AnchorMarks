const { setupAuthRoutes } = require("./auth");
const setupBookmarksRoutesLegacy = require("./bookmarks");
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

  // Legacy bookmarks routes from routes/bookmarks.js (GET/PUT/DELETE, counts, archive)
  setupBookmarksRoutesLegacy(app, db, {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper,
    config,
  });

  // Bookmarks routes from controllers (includes POST /api/bookmarks)
  setupBookmarksRoutes(app, db, {
    authenticateTokenMiddleware,
    fetchFaviconWrapper,
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
        console.log(`[Settings] Saving for user ${req.user.id}:`, req.body);
        userSettingsModel.upsertUserSettings(db, req.user.id, req.body);

        const settings = db
          .prepare("SELECT * FROM user_settings WHERE user_id = ?")
          .get(req.user.id);

        if (!settings) return res.json({});

        // Merge flexible JSON settings
        let extra = {};
        try {
          extra = settings.settings_json
            ? JSON.parse(settings.settings_json)
            : {};
        } catch {
          extra = {};
        }

        res.json({
          view_mode: settings.view_mode || "grid",
          hide_favicons: settings.hide_favicons === 1,
          hide_sidebar: settings.hide_sidebar === 1,
          ai_suggestions_enabled: settings.ai_suggestions_enabled !== 0,
          rich_link_previews_enabled: settings.rich_link_previews_enabled === 1,
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
          tour_completed: settings.tour_completed === 1,
          ...extra,
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

  // Import/Export Routes
  const setupImportExportRoutes = require("./importExport");
  setupImportExportRoutes(app, db, { authenticateTokenMiddleware });

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
          rich_link_previews_enabled: true, // Enable by default
          theme: "dark",
          dashboard_mode: "folder",
          dashboard_tags: [],
          dashboard_sort: "updated_desc",
          widget_order: {},
          collapsed_sections: [],
          tour_completed: false,
        });
        return;
      }

      let extra = {};
      try {
        extra = settings.settings_json
          ? JSON.parse(settings.settings_json)
          : {};
      } catch {
        extra = {};
      }

      res.json({
        view_mode: settings.view_mode || "grid",
        hide_favicons: settings.hide_favicons === 1,
        hide_sidebar: settings.hide_sidebar === 1,
        ai_suggestions_enabled: settings.ai_suggestions_enabled !== 0,
        rich_link_previews_enabled: settings.rich_link_previews_enabled === 1,
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
        tour_completed: settings.tour_completed === 1,
        ...extra,
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Reset bookmarks - delete all and create example bookmarks
  const {
    EXAMPLE_BOOKMARKS,
    STARTER_FOLDER,
  } = require("../helpers/example-bookmarks");

  app.post(
    "/api/settings/reset-bookmarks",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    async (req, res) => {
      try {
        const { v4: uuidv4 } = require("uuid");
        const userId = req.user.id;

        // Delete all bookmark_tags for this user's bookmarks
        db.prepare(
          `DELETE FROM bookmark_tags WHERE bookmark_id IN (SELECT id FROM bookmarks WHERE user_id = ?)`,
        ).run(userId);

        // Delete all bookmarks for this user
        db.prepare("DELETE FROM bookmarks WHERE user_id = ?").run(userId);

        // Delete all folders for this user
        db.prepare("DELETE FROM folders WHERE user_id = ?").run(userId);

        // Delete all tags for this user
        db.prepare("DELETE FROM tags WHERE user_id = ?").run(userId);

        // Create starter folder using shared config
        const folderId = uuidv4();
        db.prepare(
          "INSERT INTO folders (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)",
        ).run(
          folderId,
          userId,
          STARTER_FOLDER.name,
          STARTER_FOLDER.color,
          STARTER_FOLDER.icon || "folder",
        );

        // Tag helper functions
        const {
          ensureTagsExist,
          updateBookmarkTags,
        } = require("../helpers/tag-helpers");

        let bookmarksCreated = 0;
        for (const bm of EXAMPLE_BOOKMARKS) {
          const id = uuidv4();
          // Place bookmarks marked with inStarterFolder in the starter folder
          const bookmarkFolderId = bm.inStarterFolder ? folderId : null;

          db.prepare(
            `INSERT INTO bookmarks (id, user_id, folder_id, title, url, description) 
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(id, userId, bookmarkFolderId, bm.title, bm.url, bm.description);

          // Add tags if present
          if (bm.tags) {
            const tagNames = bm.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
            if (tagNames.length > 0) {
              const tagIds = ensureTagsExist(db, userId, tagNames);
              updateBookmarkTags(db, id, tagIds);
            }
          }

          // Fetch favicon in background
          if (fetchFaviconWrapper) {
            fetchFaviconWrapper(bm.url, id).catch(() => {});
          }
          bookmarksCreated++;
        }

        res.json({
          success: true,
          bookmarks_created: bookmarksCreated,
          message: "Bookmarks reset successfully",
        });
      } catch (err) {
        console.error("Error resetting bookmarks:", err);
        res.status(500).json({ error: "Failed to reset bookmarks" });
      }
    },
  );

  // AI tag suggestions
  const aiTags = require("../helpers/ai-tags");

  app.get(
    "/api/tags/suggest-ai",
    authenticateTokenMiddleware,
    async (req, res) => {
      const { url, limit = 10 } = req.query;
      if (!url)
        return res.status(400).json({ error: "URL parameter required" });

      try {
        new URL(url);
      } catch {
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
