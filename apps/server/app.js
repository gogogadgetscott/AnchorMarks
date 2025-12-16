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
const smartOrg = require("./smart-organization");
const aiTags = require("./ai-tags");
const { v4: uuidv4 } = require("uuid");

const config = require("./config");
const { initializeDatabase, ensureDirectories } = require("./database");
const { authenticateToken, validateCsrfToken } = require("./middleware");
const { setupAuthRoutes } = require("./routes/auth");
const { isPrivateAddress, fetchFavicon } = require("./utils");
const {
  ensureTagsExist,
  updateBookmarkTags,
  getUserTags,
  getBookmarkTagsString,
} = require("./tag-helpers");

const app = express();
config.validateSecurityConfig();

// Initialize database
const db = initializeDatabase(config.DB_PATH);
const { FAVICONS_DIR, THUMBNAILS_DIR } = ensureDirectories();

// Middleware functions
const authenticateTokenMiddleware = authenticateToken(db);
const validateCsrfTokenMiddleware = validateCsrfToken(db);

// Favicon fetch function
const fetchFaviconWrapper = (url, bookmarkId) =>
  fetchFavicon(url, bookmarkId, db, FAVICONS_DIR, config.NODE_ENV);

// Background job to fetch missing favicons
function processFaviconQueue() {
  const bookmarks = db
    .prepare(
      `
    SELECT id, url FROM bookmarks 
    WHERE favicon_local IS NULL AND url IS NOT NULL 
    LIMIT 10
  `,
    )
    .all();

  for (const bookmark of bookmarks) {
    fetchFaviconWrapper(bookmark.url, bookmark.id).catch(console.error);
  }
}

if (config.ENABLE_BACKGROUND_JOBS && config.ENABLE_FAVICON_BACKGROUND_JOBS) {
  // Run favicon queue processor every 30 seconds
  setInterval(processFaviconQueue, 30000);
  // Initial run after 5 seconds
  setTimeout(processFaviconQueue, 5000);
}

// ============== THUMBNAIL CACHING ==============

// Cache for in-progress thumbnail fetches
const thumbnailFetchQueue = new Map();

async function cacheThumbnail(url, bookmarkId) {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) return null;

    // Block private/loopback targets in production to avoid SSRF
    if (config.NODE_ENV === "production" && (await isPrivateAddress(url))) {
      return null;
    }

    const domain = urlObj.hostname;
    const thumbnailFilename = `${bookmarkId.substring(0, 8)}_${domain.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
    const localPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    const publicPath = `/thumbnails/${thumbnailFilename}`;

    // Check if already cached locally
    if (fs.existsSync(localPath)) {
      db.prepare("UPDATE bookmarks SET thumbnail_local = ? WHERE id = ?").run(
        publicPath,
        bookmarkId,
      );
      return publicPath;
    }

    // Check if already being fetched (deduplicate)
    if (thumbnailFetchQueue.has(bookmarkId)) {
      return thumbnailFetchQueue.get(bookmarkId);
    }

    // Simple service: Store as a placeholder for now
    // In a production system, you would use a headless browser like Puppeteer
    // to capture actual website screenshots
    const fetchPromise = new Promise((resolve) => {
      // For now, just store a placeholder indicating thumbnails can be added
      // Real implementation would use screenshot/favicon service
      db.prepare("UPDATE bookmarks SET thumbnail_local = ? WHERE id = ?").run(
        null,
        bookmarkId,
      );
      thumbnailFetchQueue.delete(bookmarkId);
      resolve(null);
    });

    thumbnailFetchQueue.set(bookmarkId, fetchPromise);
    return fetchPromise;
  } catch (err) {
    console.error("Thumbnail cache error:", err);
    return null;
  }
}

// ============== MIDDLEWARE ==============

// Security headers for production
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
    "https://r2cdn.perplexity.ai",
  ],
  imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
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

// CORS configuration
const corsOptions = {
  origin: config.resolveCorsOrigin(),
  credentials: true,
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
};
app.use(cors(corsOptions));
app.use(cookieParser());

// Rate limiting for API
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per minute

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

// Request logging (must be before express.static; static can end the response and skip later middleware)
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
  // Skip CSRF check for unauthenticated auth endpoints
  const unauthenticatedPaths = ["/auth/login", "/auth/register", "/health"];

  // Check if the request URL matches any of the unauthenticated paths
  // Note: Since this middleware is mounted at '/api', req.url will be relative to '/api'
  // e.g. for '/api/auth/login', req.url is '/auth/login'
  if (
    unauthenticatedPaths.some(
      (path) => req.url === path || req.url.startsWith(path),
    )
  ) {
    return next();
  }

  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    return validateCsrfTokenMiddleware(req, res, next);
  }
  next();
});

// Generate CSRF token
function generateCsrfToken() {
  return uuidv4().replace(/-/g, "");
}

// ============== HEALTH CHECK ==============

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ============== AUTH ROUTES ==============

setupAuthRoutes(app, db, authenticateTokenMiddleware, fetchFaviconWrapper);

// Maintenance Routes
const setupMaintenanceRoutes = require("./routes/maintenance");
app.use(
  "/api/maintenance",
  setupMaintenanceRoutes(db, authenticateTokenMiddleware),
);

// ============== USER SETTINGS API ==============

// Get user settings
app.get("/api/settings", authenticateTokenMiddleware, (req, res) => {
  try {
    const settings = db
      .prepare("SELECT * FROM user_settings WHERE user_id = ?")
      .get(req.user.id);

    if (!settings) {
      // Return defaults
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

// GET /api/tags/suggest-ai - AI-powered tag suggestions for a URL
app.get(
  "/api/tags/suggest-ai",
  authenticateTokenMiddleware,
  async (req, res) => {
    const { url, limit = 10 } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL parameter required" });
    }

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

// Update user settings
app.put(
  "/api/settings",
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  (req, res) => {
    try {
      const {
        view_mode,
        hide_favicons,
        hide_sidebar,
        ai_suggestions_enabled,
        theme,
        dashboard_mode,
        dashboard_tags,
        dashboard_sort,
        widget_order,
        dashboard_widgets,
        collapsed_sections,
        include_child_bookmarks,
      } = req.body;

      const existing = db
        .prepare("SELECT user_id FROM user_settings WHERE user_id = ?")
        .get(req.user.id);

      if (existing) {
        // Update existing settings
        const updates = [];
        const values = [];

        if (view_mode !== undefined) {
          updates.push("view_mode = ?");
          values.push(view_mode);
        }
        if (hide_favicons !== undefined) {
          updates.push("hide_favicons = ?");
          values.push(hide_favicons ? 1 : 0);
        }
        if (hide_sidebar !== undefined) {
          updates.push("hide_sidebar = ?");
          values.push(hide_sidebar ? 1 : 0);
        }
        if (ai_suggestions_enabled !== undefined) {
          updates.push("ai_suggestions_enabled = ?");
          values.push(ai_suggestions_enabled ? 1 : 0);
        }
        if (theme !== undefined) {
          updates.push("theme = ?");
          values.push(theme);
        }
        if (dashboard_mode !== undefined) {
          updates.push("dashboard_mode = ?");
          values.push(dashboard_mode);
        }
        if (dashboard_tags !== undefined) {
          updates.push("dashboard_tags = ?");
          values.push(JSON.stringify(dashboard_tags));
        }
        if (dashboard_sort !== undefined) {
          updates.push("dashboard_sort = ?");
          values.push(dashboard_sort);
        }
        if (widget_order !== undefined) {
          updates.push("widget_order = ?");
          values.push(JSON.stringify(widget_order));
        }
        if (dashboard_widgets !== undefined) {
          updates.push("dashboard_widgets = ?");
          values.push(JSON.stringify(dashboard_widgets));
        }
        if (collapsed_sections !== undefined) {
          updates.push("collapsed_sections = ?");
          values.push(JSON.stringify(collapsed_sections));
        }
        if (include_child_bookmarks !== undefined) {
          updates.push("include_child_bookmarks = ?");
          values.push(include_child_bookmarks);
        }
        if (req.body.snap_to_grid !== undefined) {
          updates.push("snap_to_grid = ?");
          values.push(req.body.snap_to_grid ? 1 : 0);
        }
        if (req.body.current_view !== undefined) {
          updates.push("current_view = ?");
          values.push(req.body.current_view);
        }

        if (updates.length > 0) {
          updates.push("updated_at = CURRENT_TIMESTAMP");
          values.push(req.user.id);
          db.prepare(
            `UPDATE user_settings SET ${updates.join(", ")} WHERE user_id = ?`,
          ).run(...values);
        }
      } else {
        // Insert new settings
        db.prepare(
          `
                INSERT INTO user_settings (
                    user_id, view_mode, hide_favicons, hide_sidebar, ai_suggestions_enabled, theme, dashboard_mode,
                    dashboard_tags, dashboard_sort, widget_order, dashboard_widgets, collapsed_sections, include_child_bookmarks
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
            `,
        ).run(
          req.user.id,
          view_mode || "grid",
          hide_favicons || 0,
          hide_sidebar || 0,
          ai_suggestions_enabled !== undefined &&
            ai_suggestions_enabled !== null
            ? ai_suggestions_enabled
              ? 1
              : 0
            : 1,
          theme || "light",
          dashboard_mode || "folder",
          dashboard_tags ? JSON.stringify(dashboard_tags) : null,
          dashboard_sort || "updated_desc",
          widget_order ? JSON.stringify(widget_order) : null,
          dashboard_widgets ? JSON.stringify(dashboard_widgets) : null,
          collapsed_sections ? JSON.stringify(collapsed_sections) : null,
          include_child_bookmarks || 0,
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating settings:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  },
);

// ============== DASHBOARD VIEWS =============

// Get all dashboard views
app.get("/api/dashboard/views", authenticateTokenMiddleware, (req, res) => {
  try {
    const views = db
      .prepare(
        "SELECT * FROM dashboard_views WHERE user_id = ? ORDER BY position, name",
      )
      .all(req.user.id);
    res.json(views.map((v) => ({ ...v, config: JSON.parse(v.config) })));
  } catch (err) {
    console.error("Error fetching dashboard views:", err);
    res.status(500).json({ error: "Failed to fetch dashboard views" });
  }
});

// Create dashboard view
app.post("/api/dashboard/views", authenticateTokenMiddleware, (req, res) => {
  try {
    const { name, config } = req.body;
    if (!name || !config)
      return res.status(400).json({ error: "Name and config required" });

    const id = uuidv4();
    const maxPos = db
      .prepare(
        "SELECT MAX(position) as max FROM dashboard_views WHERE user_id = ?",
      )
      .get(req.user.id);
    const position = (maxPos.max || 0) + 1;

    db.prepare(
      "INSERT INTO dashboard_views (id, user_id, name, config, position) VALUES (?, ?, ?, ?, ?)",
    ).run(id, req.user.id, name, JSON.stringify(config), position);

    const view = db
      .prepare("SELECT * FROM dashboard_views WHERE id = ?")
      .get(id);
    res.json({ ...view, config: JSON.parse(view.config) });
  } catch (err) {
    console.error("Error creating dashboard view:", err);
    res.status(500).json({ error: "Failed to create dashboard view" });
  }
});

// Update dashboard view
app.put("/api/dashboard/views/:id", authenticateTokenMiddleware, (req, res) => {
  try {
    const { name, config, position } = req.body;

    db.prepare(
      `
            UPDATE dashboard_views SET 
                name = COALESCE(?, name),
                config = COALESCE(?, config),
                position = COALESCE(?, position),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `,
    ).run(
      name,
      config ? JSON.stringify(config) : null,
      position,
      req.params.id,
      req.user.id,
    );

    const view = db
      .prepare("SELECT * FROM dashboard_views WHERE id = ?")
      .get(req.params.id);
    res.json({ ...view, config: JSON.parse(view.config) });
  } catch (err) {
    console.error("Error updating dashboard view:", err);
    res.status(500).json({ error: "Failed to update dashboard view" });
  }
});

// Delete dashboard view
app.delete(
  "/api/dashboard/views/:id",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      db.prepare(
        "DELETE FROM dashboard_views WHERE id = ? AND user_id = ?",
      ).run(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting dashboard view:", err);
      res.status(500).json({ error: "Failed to delete dashboard view" });
    }
  },
);

// Restore dashboard view (apply to settings)
app.post(
  "/api/dashboard/views/:id/restore",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      const view = db
        .prepare("SELECT * FROM dashboard_views WHERE id = ? AND user_id = ?")
        .get(req.params.id, req.user.id);
      if (!view) {
        return res.status(404).json({ error: "View not found" });
      }

      const config = JSON.parse(view.config);

      // Update user settings with view config INCLUDING current_view
      db.prepare(
        `
            UPDATE user_settings 
            SET dashboard_mode = ?, 
                dashboard_tags = ?, 
                dashboard_sort = ?,
                widget_order = ?,
                dashboard_widgets = ?,
                include_child_bookmarks = ?,
                current_view = 'dashboard',
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        `,
      ).run(
        config.dashboard_mode || "folder",
        config.dashboard_tags ? JSON.stringify(config.dashboard_tags) : null,
        config.dashboard_sort || "recently_added",
        config.widget_order ? JSON.stringify(config.widget_order) : null,
        config.dashboard_widgets
          ? JSON.stringify(config.dashboard_widgets)
          : null,
        config.include_child_bookmarks || 0,
        req.user.id,
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Error restoring dashboard view:", err);
      res.status(500).json({ error: "Failed to restore dashboard view" });
    }
  },
);

// ============== BOOKMARK VIEWS ROUTES ==============

// Get all bookmark views for user
app.get("/api/bookmark/views", authenticateTokenMiddleware, (req, res) => {
  try {
    const views = db
      .prepare(
        "SELECT * FROM bookmark_views WHERE user_id = ? ORDER BY position ASC, created_at DESC",
      )
      .all(req.user.id);
    res.json(views);
  } catch (err) {
    console.error("Error fetching bookmark views:", err);
    res.status(500).json({ error: "Failed to fetch bookmark views" });
  }
});

// Create new bookmark view
app.post("/api/bookmark/views", authenticateTokenMiddleware, (req, res) => {
  try {
    const { name, config } = req.body;
    if (!name || !config) {
      return res.status(400).json({ error: "Name and config are required" });
    }

    const id = uuidv4();
    db.prepare(
      `
            INSERT INTO bookmark_views (id, user_id, name, config)
            VALUES (?, ?, ?, ?)
        `,
    ).run(id, req.user.id, name, JSON.stringify(config));

    const view = db
      .prepare("SELECT * FROM bookmark_views WHERE id = ?")
      .get(id);
    res.json(view);
  } catch (err) {
    console.error("Error creating bookmark view:", err);
    res.status(500).json({ error: "Failed to create bookmark view" });
  }
});

// Update bookmark view
app.put("/api/bookmark/views/:id", authenticateTokenMiddleware, (req, res) => {
  try {
    const { name, config } = req.body;
    const view = db
      .prepare("SELECT * FROM bookmark_views WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);

    if (!view) {
      return res.status(404).json({ error: "View not found" });
    }

    db.prepare(
      `
            UPDATE bookmark_views 
            SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `,
    ).run(
      name || view.name,
      config ? JSON.stringify(config) : view.config,
      req.params.id,
      req.user.id,
    );

    const updated = db
      .prepare("SELECT * FROM bookmark_views WHERE id = ?")
      .get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error("Error updating bookmark view:", err);
    res.status(500).json({ error: "Failed to update bookmark view" });
  }
});

// Delete bookmark view
app.delete(
  "/api/bookmark/views/:id",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      const result = db
        .prepare("DELETE FROM bookmark_views WHERE id = ? AND user_id = ?")
        .run(req.params.id, req.user.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "View not found" });
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting bookmark view:", err);
      res.status(500).json({ error: "Failed to delete bookmark view" });
    }
  },
);

// Restore bookmark view
app.post(
  "/api/bookmark/views/:id/restore",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      const view = db
        .prepare("SELECT * FROM bookmark_views WHERE id = ? AND user_id = ?")
        .get(req.params.id, req.user.id);
      if (!view) {
        return res.status(404).json({ error: "View not found" });
      }

      // Just return the config - frontend will apply it
      res.json({ success: true, config: JSON.parse(view.config) });
    } catch (err) {
      console.error("Error restoring bookmark view:", err);
      res.status(500).json({ error: "Failed to restore bookmark view" });
    }
  },
);

// ============== USER SETTINGS ROUTES ==============

// Reset bookmarks to example bookmarks
app.post(
  "/api/settings/reset-bookmarks",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      const userId = req.user.id;

      // Delete all existing bookmarks for this user
      db.prepare("DELETE FROM bookmarks WHERE user_id = ?").run(userId);

      // Delete all existing folders for this user
      db.prepare("DELETE FROM folders WHERE user_id = ?").run(userId);

      // Create default folder
      const defaultFolderId = uuidv4();
      db.prepare(
        "INSERT INTO folders (id, user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(defaultFolderId, userId, "My Bookmarks", "#6366f1", "folder", 1);

      // Create example bookmarks
      const bookmarks = createExampleBookmarks(userId, defaultFolderId);

      res.json({
        success: true,
        message: "Bookmarks reset to examples",
        bookmarks_created: bookmarks.length,
        folder_id: defaultFolderId,
      });
    } catch (err) {
      console.error("Reset bookmarks error:", err);
      res.status(500).json({ error: "Failed to reset bookmarks" });
    }
  },
);

// ============== FOLDER ROUTES ==============

// Get all folders with bookmark counts
app.get("/api/folders", authenticateTokenMiddleware, (req, res) => {
  try {
    const folders = db
      .prepare(
        `
    SELECT 
      f.*, 
      COUNT(b.id) AS bookmark_count
    FROM folders f
    LEFT JOIN bookmarks b ON b.folder_id = f.id AND b.user_id = f.user_id
    WHERE f.user_id = ?
    GROUP BY f.id
    ORDER BY f.position
  `,
      )
      .all(req.user.id);

    return res.json(folders);
  } catch (err) {
    console.error("Error fetching folders:", err);
    return res.status(500).json({ error: "Failed to fetch folders" });
  }
});

// Update folder
app.put("/api/folders/:id", authenticateTokenMiddleware, (req, res) => {
  const { name, parent_id, color, icon, position } = req.body;

  db.prepare(
    `
    UPDATE folders SET 
      name = COALESCE(?, name),
      parent_id = COALESCE(?, parent_id),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      position = COALESCE(?, position),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
  ).run(name, parent_id, color, icon, position, req.params.id, req.user.id);

  const folder = db
    .prepare("SELECT * FROM folders WHERE id = ?")
    .get(req.params.id);
  res.json(folder);
});

// Delete folder
app.delete("/api/folders/:id", authenticateTokenMiddleware, (req, res) => {
  db.prepare(
    "UPDATE bookmarks SET folder_id = NULL WHERE folder_id = ? AND user_id = ?",
  ).run(req.params.id, req.user.id);

  db.prepare("DELETE FROM folders WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.user.id,
  );
  res.json({ success: true });
});

// ============== TAGS ==============

// Get all tags for user with bookmark counts (supports hierarchy by name delimiter e.g. parent/child)
app.get("/api/tags", authenticateTokenMiddleware, (req, res) => {
  // Use normalized tag system with bookmark_tags junction table
  const tags = getUserTags(db, req.user.id);
  res.json(tags);
});

// Create tag
app.post("/api/tags", authenticateTokenMiddleware, (req, res) => {
  const { name, color, icon } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Tag name is required" });
  }

  const id = uuidv4();
  const maxPos = db
    .prepare("SELECT MAX(position) as max FROM tags WHERE user_id = ?")
    .get(req.user.id);
  const position = (maxPos.max || 0) + 1;

  try {
    db.prepare(
      "INSERT INTO tags (id, user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      req.user.id,
      name.trim(),
      color || "#f59e0b",
      icon || "tag",
      position,
    );

    const tag = db
      .prepare("SELECT *, 0 as count FROM tags WHERE id = ?")
      .get(id);
    res.json(tag);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(409).json({ error: "Tag already exists" });
    }
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// Update tag
app.put("/api/tags/:id", authenticateTokenMiddleware, (req, res) => {
  const { name, color, icon, position } = req.body;

  db.prepare(
    `
        UPDATE tags SET 
            name = COALESCE(?, name),
            color = COALESCE(?, color),
            icon = COALESCE(?, icon),
            position = COALESCE(?, position),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
    `,
  ).run(name, color, icon, position, req.params.id, req.user.id);

  const tag = db
    .prepare(
      `
        SELECT 
            t.*,
            COUNT(bt.bookmark_id) as count
        FROM tags t
        LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
        WHERE t.id = ?
        GROUP BY t.id
    `,
    )
    .get(req.params.id);

  if (!tag) {
    return res.status(404).json({ error: "Tag not found" });
  }

  res.json(tag);
});

// Delete tag
app.delete("/api/tags/:id", authenticateTokenMiddleware, (req, res) => {
  db.prepare("DELETE FROM bookmark_tags WHERE tag_id = ?").run(req.params.id);
  db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.user.id,
  );

  res.json({ success: true });
});

// ============== SMART COLLECTIONS ==============

// Get all smart collections
app.get("/api/collections", authenticateTokenMiddleware, (req, res) => {
  const collections = db
    .prepare(
      "SELECT * FROM smart_collections WHERE user_id = ? ORDER BY position",
    )
    .all(req.user.id);
  res.json(collections.map((c) => ({ ...c, filters: JSON.parse(c.filters) })));
});

// Create smart collection
app.post("/api/collections", authenticateTokenMiddleware, (req, res) => {
  const { name, icon, color, filters } = req.body;
  const id = uuidv4();

  const maxPos = db
    .prepare(
      "SELECT MAX(position) as max FROM smart_collections WHERE user_id = ?",
    )
    .get(req.user.id);
  const position = (maxPos.max || 0) + 1;

  db.prepare(
    "INSERT INTO smart_collections (id, user_id, name, icon, color, filters, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    req.user.id,
    name,
    icon || "filter",
    color || "#6366f1",
    JSON.stringify(filters),
    position,
  );

  const collection = db
    .prepare("SELECT * FROM smart_collections WHERE id = ?")
    .get(id);
  res.json({ ...collection, filters: JSON.parse(collection.filters) });
});

// Update smart collection
app.put("/api/collections/:id", authenticateTokenMiddleware, (req, res) => {
  const { name, icon, color, filters, position } = req.body;

  db.prepare(
    `
    UPDATE smart_collections SET 
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      color = COALESCE(?, color),
      filters = COALESCE(?, filters),
      position = COALESCE(?, position)
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    name,
    icon,
    color,
    filters ? JSON.stringify(filters) : null,
    position,
    req.params.id,
    req.user.id,
  );

  const collection = db
    .prepare("SELECT * FROM smart_collections WHERE id = ?")
    .get(req.params.id);
  res.json({ ...collection, filters: JSON.parse(collection.filters) });
});

// Delete smart collection
app.delete("/api/collections/:id", authenticateTokenMiddleware, (req, res) => {
  db.prepare("DELETE FROM smart_collections WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.user.id,
  );
  res.json({ success: true });
});

// Get bookmarks matching a smart collection
app.get(
  "/api/collections/:id/bookmarks",
  authenticateTokenMiddleware,
  (req, res) => {
    const collection = db
      .prepare("SELECT * FROM smart_collections WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const filters = JSON.parse(collection.filters);
    let query = `
      SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed
      FROM bookmarks b
      LEFT JOIN (
        SELECT bt.bookmark_id,
               GROUP_CONCAT(t.name, ', ') as tags_joined,
               json_group_array(
                 json_object(
                   'name', t.name,
                   'tag_id', t.id,
                   'color', t.color,
                   'color_override', bt.color_override
                 )
               ) as tags_detailed
        FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.user_id = ?
        GROUP BY bt.bookmark_id
      ) tg ON tg.bookmark_id = b.id
      WHERE b.user_id = ?`;
    const params = [req.user.id, req.user.id];

    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags
        .map(() => "tg.tags_joined LIKE ?")
        .join(" OR ");
      query += ` AND (${tagConditions})`;
      filters.tags.forEach((tag) => params.push(`%${tag}%`));
    }

    if (filters.search) {
      query += " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.domain) {
      query += " AND b.url LIKE ?";
      params.push(`%${filters.domain}%`);
    }

    if (filters.favorites) {
      query += " AND b.is_favorite = 1";
    }

    if (filters.untagged) {
      query +=
        " AND NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id)";
    }

    query += " ORDER BY created_at DESC";

    const bookmarks = db.prepare(query).all(...params);
    bookmarks.forEach((b) => {
      b.tags_detailed = parseTagsDetailed(b.tags_detailed);
    });
    res.json(bookmarks);
  },
);

// ============== BOOKMARK ROUTES ==============

// Get all bookmarks (with optional pagination)
app.get("/api/bookmarks", authenticateTokenMiddleware, (req, res) => {
  const { folder_id, search, favorites, tags, sort, limit, offset } = req.query;

  let baseSelect = `
    FROM bookmarks b
    LEFT JOIN (
      SELECT bt.bookmark_id,
             GROUP_CONCAT(t.name, ', ') as tags_joined,
             json_group_array(
               json_object(
                 'name', t.name,
                 'tag_id', t.id,
                 'color', t.color,
                 'color_override', bt.color_override
               )
             ) as tags_detailed
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY bt.bookmark_id
    ) tg ON tg.bookmark_id = b.id
    WHERE b.user_id = ?`;
  let query = `SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed ${baseSelect}`;
  let countQuery = `SELECT COUNT(*) as total ${baseSelect}`;
  const params = [req.user.id, req.user.id];

  if (folder_id) {
    if (req.query.include_children === "true") {
      // Recursive CTE to find all descendant folders
      query += ` AND (folder_id = ? OR folder_id IN (
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE parent_id = ?
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT id FROM subfolders
            ))`;
      countQuery += ` AND (folder_id = ? OR folder_id IN (
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE parent_id = ?
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT id FROM subfolders
            ))`;
      params.push(folder_id, folder_id); // Push twice because of the CTE structure
    } else {
      query += " AND b.folder_id = ?";
      countQuery += " AND b.folder_id = ?";
      params.push(folder_id);
    }
  }

  if (favorites === "true") {
    query += " AND b.is_favorite = 1";
    countQuery += " AND b.is_favorite = 1";
  }

  if (search) {
    query +=
      " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ? OR tg.tags_joined LIKE ?)";
    countQuery +=
      " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ? OR tg.tags_joined LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (tags) {
    query += " AND tg.tags_joined LIKE ?";
    countQuery += " AND tg.tags_joined LIKE ?";
    params.push(`%${tags}%`);
  }

  // Apply sorting
  let orderClause = " ORDER BY position, created_at DESC";
  if (sort) {
    switch (sort.toLowerCase()) {
      case "recently_added":
        orderClause = " ORDER BY created_at DESC";
        break;
      case "oldest_first":
        orderClause = " ORDER BY created_at ASC";
        break;
      case "most_visited":
        orderClause = " ORDER BY click_count DESC, created_at DESC";
        break;
      case "a_z":
      case "a-z":
        orderClause = " ORDER BY title COLLATE NOCASE ASC";
        break;
      case "z_a":
      case "z-a":
        orderClause = " ORDER BY title COLLATE NOCASE DESC";
        break;
      default:
        orderClause = " ORDER BY position, created_at DESC";
    }
  }

  query += orderClause;

  // If pagination requested, add LIMIT and OFFSET
  if (limit) {
    const total = db.prepare(countQuery).get(...params).total;
    query += ` LIMIT ${parseInt(limit)}`;
    if (offset) {
      query += ` OFFSET ${parseInt(offset)}`;
    }
    const bookmarks = db.prepare(query).all(...params);
    bookmarks.forEach((b) => {
      b.tags_detailed = parseTagsDetailed(b.tags_detailed);
    });
    return res.json({
      bookmarks,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset) || 0,
    });
  }

  const bookmarks = db.prepare(query).all(...params);
  bookmarks.forEach((b) => {
    b.tags_detailed = parseTagsDetailed(b.tags_detailed);
  });
  res.json(bookmarks);
});

// Get single bookmark
app.get("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
  const bookmark = db
    .prepare(
      `SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed
       FROM bookmarks b
       LEFT JOIN (
         SELECT bt.bookmark_id,
                GROUP_CONCAT(t.name, ', ') as tags_joined,
                json_group_array(
                  json_object(
                    'name', t.name,
                    'tag_id', t.id,
                    'color', t.color,
                    'color_override', bt.color_override
                  )
                ) as tags_detailed
         FROM bookmark_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE t.user_id = ?
         GROUP BY bt.bookmark_id
       ) tg ON tg.bookmark_id = b.id
       WHERE b.id = ? AND b.user_id = ?`,
    )
    .get(req.user.id, req.params.id, req.user.id);

  if (!bookmark) {
    return res.status(404).json({ error: "Bookmark not found" });
  }
  bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
  res.json(bookmark);
});

// Fetch metadata from URL (title, description, favicon)
app.post(
  "/api/bookmarks/fetch-metadata",
  authenticateTokenMiddleware,
  async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const urlObj = new URL(url);
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return res.status(400).json({ error: "Invalid URL protocol" });
      }

      // Block private/loopback targets in production to avoid SSRF
      if (config.NODE_ENV === "production" && (await isPrivateAddress(url))) {
        return res
          .status(403)
          .json({ error: "Cannot fetch metadata from private addresses" });
      }

      const metadata = await fetchUrlMetadata(url);
      res.json(metadata);
    } catch (err) {
      console.error("Metadata fetch error:", err.message);
      // Fallback to basic info instead of 500ing
      try {
        const fallback = {
          title: new URL(url).hostname,
          description: "",
          url: url,
        };
        res.json(fallback);
      } catch (e) {
        res
          .status(500)
          .json({ error: "Failed to fetch metadata", message: err.message });
      }
    }
  },
);

// Helper function to fetch URL metadata
async function fetchUrlMetadata(url, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const options = {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    };

    const request = protocol.get(url, options, (response) => {
      // Follow redirects
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        try {
          const redirectUrl = new URL(
            response.headers.location,
            url,
          ).toString();
          return fetchUrlMetadata(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        } catch (e) {
          return reject(e);
        }
      }

      if (response.statusCode !== 200) {
        // If fails, resolving with null will let us handle fallback in the caller or here
        // But for now, let's just reject and handle fallback in the route handler
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      const contentType = response.headers["content-type"] || "";
      if (!contentType.includes("text/html")) {
        // Not HTML, return basic info
        return resolve({
          title: new URL(url).hostname,
          description: "",
          url: url,
        });
      }

      let html = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        html += chunk;
        // Stop after we have enough data for metadata (typically in <head>)
        if (html.length > 500000) {
          // 500KB limit
          response.destroy();
        }
      });

      response.on("end", () => {
        // If stream was destroyed (truncated), we might still have useful data
        const metadata = parseHtmlMetadata(html, url);
        resolve(metadata);
      });
    });

    request.on("error", (err) => {
      reject(err);
    });

    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// Parse HTML for metadata
function parseHtmlMetadata(html, url) {
  const metadata = {
    title: "",
    description: "",
    url: url,
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Extract meta description
  const descMatch =
    html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) {
    metadata.description = decodeHtmlEntities(descMatch[1].trim());
  }

  // Try Open Graph tags
  const ogTitleMatch =
    html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  const ogDescMatch =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i,
    );
  if (ogDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(ogDescMatch[1].trim());
  }

  // Try Twitter Card tags
  const twitterTitleMatch =
    html.match(
      /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i,
    );
  if (twitterTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(twitterTitleMatch[1].trim());
  }

  const twitterDescMatch =
    html.match(
      /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:description["']/i,
    );
  if (twitterDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(twitterDescMatch[1].trim());
  }

  // Fallback to hostname if no title found
  if (!metadata.title) {
    try {
      metadata.title = new URL(url).hostname;
    } catch {
      metadata.title = url;
    }
  }

  return metadata;
}

// Decode common HTML entities
function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&nbsp;": " ",
  };
  return text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match);
}

// Create bookmark
app.post("/api/bookmarks", authenticateTokenMiddleware, async (req, res) => {
  const { title, url, description, folder_id, tags } = req.body;
  const id = uuidv4();

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  const maxPos = db
    .prepare("SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?")
    .get(req.user.id);
  const position = (maxPos.max || 0) + 1;

  // Favicons are fetched asynchronously and served from the local cache
  const faviconUrl = null;

  // Auto-detect content type
  const contentType = detectContentType(url);

  db.prepare(
    `
    INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, position, content_type) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    req.user.id,
    folder_id || null,
    title || url,
    url,
    description || null,
    faviconUrl,
    position,
    contentType,
  );

  // Handle tags via normalized bookmark_tags table
  let tagResult = { tagIds: [], tagMap: {} };
  if (tags && tags.trim()) {
    tagResult = ensureTagsExist(db, req.user.id, tags, { returnMap: true });
    const overrides = normalizeTagColorOverrides(
      req.body.tag_colors || req.body.tagColorOverrides,
      tagResult.tagMap,
    );
    updateBookmarkTags(db, id, tagResult.tagIds, {
      colorOverridesByTagId: overrides,
    });
  }

  // Trigger async favicon fetch
  fetchFaviconWrapper(url, id).catch(console.error);

  const bookmark = db
    .prepare(
      `SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed
       FROM bookmarks b
       LEFT JOIN (
         SELECT bt.bookmark_id,
                GROUP_CONCAT(t.name, ', ') as tags_joined,
                json_group_array(
                  json_object(
                    'name', t.name,
                    'tag_id', t.id,
                    'color', t.color,
                    'color_override', bt.color_override
                  )
                ) as tags_detailed
         FROM bookmark_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE t.user_id = ?
         GROUP BY bt.bookmark_id
       ) tg ON tg.bookmark_id = b.id
       WHERE b.id = ?`,
    )
    .get(req.user.id, id);
  bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
  res.json(bookmark);
});

// Detect content type from URL
function detectContentType(url) {
  try {
    const urlLower = url.toLowerCase();
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Video platforms
    if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("vimeo.com") ||
      hostname.includes("dailymotion.com") ||
      hostname.includes("twitch.tv")
    ) {
      return "video";
    }

    // Social/tweets
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return "tweet";
    }

    // PDF
    if (pathname.endsWith(".pdf")) {
      return "pdf";
    }

    // Images
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathname)) {
      return "image";
    }

    // GitHub
    if (hostname.includes("github.com")) {
      return "repo";
    }

    // News/articles
    if (
      hostname.includes("medium.com") ||
      hostname.includes("dev.to") ||
      hostname.includes("substack.com") ||
      hostname.includes("hackernews") ||
      hostname.includes("reddit.com")
    ) {
      return "article";
    }

    // Documentation
    if (
      hostname.includes("docs.") ||
      pathname.includes("/docs/") ||
      pathname.includes("/documentation/")
    ) {
      return "docs";
    }

    // Default
    return "link";
  } catch (e) {
    return "link";
  }
}

// Tag helpers
function parseTags(tagsString) {
  if (!tagsString) return [];
  if (Array.isArray(tagsString))
    return tagsString.map((t) => String(t).trim()).filter(Boolean);
  return tagsString
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function mergeTags(existing, incoming) {
  const set = new Set([...parseTags(existing), ...parseTags(incoming)]);
  return Array.from(set);
}

function stringifyTags(tagsArray) {
  return parseTags(tagsArray).join(", ");
}

function parseTagsDetailed(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function normalizeTagColorOverrides(raw, tagMap = {}) {
  const overrides = {};
  if (!raw) return overrides;

  const isValidHex = (color) =>
    typeof color === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());

  const assignOverride = (name, color) => {
    if (!name || !isValidHex(color)) return;
    const tagId = tagMap[name] || tagMap[name.trim()] || null;
    if (tagId) {
      overrides[tagId] = color.trim();
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (entry && typeof entry === "object") {
        assignOverride(
          entry.name || entry.tag,
          entry.color || entry.color_override,
        );
      }
    });
  } else if (typeof raw === "object") {
    Object.entries(raw).forEach(([name, color]) => assignOverride(name, color));
  }

  return overrides;
}

// Update bookmark
app.put("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
  const {
    title,
    url,
    description,
    folder_id,
    tags,
    is_favorite,
    position,
    favicon,
  } = req.body;

  db.prepare(
    `
    UPDATE bookmarks SET 
      title = COALESCE(?, title),
      url = COALESCE(?, url),
      description = COALESCE(?, description),
      folder_id = COALESCE(?, folder_id),
      is_favorite = COALESCE(?, is_favorite),
      position = COALESCE(?, position),
      favicon = COALESCE(?, favicon),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    title,
    url,
    description,
    folder_id,
    is_favorite,
    position,
    favicon,
    req.params.id,
    req.user.id,
  );

  // Handle tags via new bookmark_tags table if provided
  if (tags !== undefined) {
    if (tags && tags.trim()) {
      const tagResult = ensureTagsExist(db, req.user.id, tags, {
        returnMap: true,
      });
      const overrides = normalizeTagColorOverrides(
        req.body.tag_colors || req.body.tagColorOverrides,
        tagResult.tagMap,
      );
      updateBookmarkTags(db, req.params.id, tagResult.tagIds, {
        colorOverridesByTagId: overrides,
      });
    } else {
      // Clear all tags if empty string provided
      updateBookmarkTags(db, req.params.id, []);
    }
  }

  const bookmark = db
    .prepare(
      `SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed
       FROM bookmarks b
       LEFT JOIN (
         SELECT bt.bookmark_id,
                GROUP_CONCAT(t.name, ', ') as tags_joined,
                json_group_array(
                  json_object(
                    'name', t.name,
                    'tag_id', t.id,
                    'color', t.color,
                    'color_override', bt.color_override
                  )
                ) as tags_detailed
         FROM bookmark_tags bt
         JOIN tags t ON t.id = bt.tag_id
         WHERE t.user_id = ?
         GROUP BY bt.bookmark_id
       ) tg ON tg.bookmark_id = b.id
       WHERE b.id = ?`,
    )
    .get(req.user.id, req.params.id);
  bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
  res.json(bookmark);
});

// Refresh favicon for a bookmark
app.post(
  "/api/bookmarks/:id/refresh-favicon",
  authenticateTokenMiddleware,
  async (req, res) => {
    const bookmark = db
      .prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.user.id);

    if (!bookmark) {
      return res.status(404).json({ error: "Bookmark not found" });
    }

    // Reset local favicon to trigger re-fetch
    db.prepare("UPDATE bookmarks SET favicon_local = NULL WHERE id = ?").run(
      bookmark.id,
    );

    const newFavicon = await fetchFaviconWrapper(bookmark.url, bookmark.id);
    res.json({ favicon: newFavicon });
  },
);

// Delete bookmark
app.delete("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
  db.prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?").run(
    req.params.id,
    req.user.id,
  );
  res.json({ success: true });
});

// ============== TAG ROUTES ==============

// Suggest tags from URL/domain and prior usage
app.get("/api/tags/suggest", authenticateTokenMiddleware, (req, res) => {
  const { url } = req.query;
  if (!url) return res.json([]);

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    const counts = {};
    const bump = (tag, weight = 1) => {
      if (!tag) return;
      const key = tag.toLowerCase();
      counts[key] = (counts[key] || 0) + weight;
    };

    // Fetch a slice of bookmarks for TF-IDF style scoring
    const allRows = db
      .prepare(
        `SELECT b.title, b.url, COALESCE(tg.tags_joined, '') as tags
         FROM bookmarks b
         LEFT JOIN (
           SELECT bt.bookmark_id, GROUP_CONCAT(t.name, ', ') as tags_joined
           FROM bookmark_tags bt
           JOIN tags t ON t.id = bt.tag_id
           WHERE t.user_id = ?
           GROUP BY bt.bookmark_id
         ) tg ON tg.bookmark_id = b.id
         WHERE b.user_id = ?
         LIMIT 800`,
      )
      .all(req.user.id, req.user.id);

    // Existing tags on same domain + compute doc frequencies for title terms
    const docFreq = {};
    const tokenizer = (text) => {
      return (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s\-/]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && t.length < 30);
    };

    allRows.forEach((row) => {
      const tokens = new Set(tokenizer(row.title));
      tokens.forEach((tok) => {
        docFreq[tok] = (docFreq[tok] || 0) + 1;
      });
    });

    const totalDocs = allRows.length || 1;

    allRows.forEach((row) => {
      const urlMatch = row.url && row.url.includes(hostname);
      if (urlMatch) {
        parseTags(row.tags).forEach((t) => bump(t, 2.5));
        try {
          const rowHost = new URL(row.url).hostname.replace(/^www\./, "");
          if (rowHost === hostname) {
            parseTags(row.tags).forEach((t) => bump(t, 3.5));
          }
        } catch {
          /* ignore */
        }
      }

      // TF-IDF style weights from titles
      const tfCounts = {};
      tokenizer(row.title).forEach((tok) => {
        tfCounts[tok] = (tfCounts[tok] || 0) + 1;
      });
      Object.entries(tfCounts).forEach(([tok, tf]) => {
        const df = docFreq[tok] || 1;
        const idf = Math.log((totalDocs + 1) / (df + 1)) + 1; // smoothed
        const weight = tf * idf;
        if (urlMatch) bump(tok, weight * 1.2);
        else bump(tok, weight * 0.6);
      });
    });

    // Domain-derived keywords
    const stopwords = new Set(["www", "com", "net", "org", "app", "io", "dev"]);
    hostname.split(".").forEach((part) => {
      if (part && part.length > 2 && !stopwords.has(part)) bump(part, 1.5);
    });

    // Path-derived keywords
    urlObj.pathname
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p && p.length > 2 && p.length < 40)
      .slice(0, 4)
      .forEach((part) => {
        const clean = part.replace(/[-_]+/g, " ").toLowerCase();
        clean.split(" ").forEach((seg) => {
          if (seg && seg.length > 2) bump(seg, 1);
        });
      });

    const suggestions = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 15);

    res.json(suggestions);
  } catch (err) {
    res.json([]);
  }
});

// Tag analytics and co-occurrence
app.get("/api/tags/analytics", authenticateTokenMiddleware, (req, res) => {
  try {
    const tags = db
      .prepare(
        `
      SELECT t.name, COUNT(bt.tag_id) as count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
    `,
      )
      .all(req.user.id);

    const cooccurrence = db
      .prepare(
        `
      SELECT 
        t1.name AS tag_name_a,
        t2.name AS tag_name_b,
        COUNT(*) AS count
      FROM bookmark_tags bt1
      JOIN bookmark_tags bt2 ON bt1.bookmark_id = bt2.bookmark_id AND bt1.tag_id < bt2.tag_id
      JOIN tags t1 ON t1.id = bt1.tag_id
      JOIN tags t2 ON t2.id = bt2.tag_id
      WHERE t1.user_id = ? AND t2.user_id = ?
      GROUP BY bt1.tag_id, bt2.tag_id
      ORDER BY count DESC
    `,
      )
      .all(req.user.id, req.user.id);

    res.json({ success: true, tags, cooccurrence });
  } catch (err) {
    console.error("Tag analytics error:", err);
    res.status(500).json({ error: "Failed to compute tag analytics" });
  }
});

// Bulk add tags to bookmarks
app.post("/api/tags/bulk-add", authenticateTokenMiddleware, (req, res) => {
  const { bookmark_ids, tags } = req.body;
  if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
    return res
      .status(400)
      .json({ error: "bookmark_ids and tags are required" });
  }

  const normalizedTags = parseTags(tags);
  const updated = [];

  bookmark_ids.forEach((id) => {
    const current = getBookmarkTagsString(db, id);
    const merged = mergeTags(current, normalizedTags);
    const tagsString = stringifyTags(merged);
    const tagIds = ensureTagsExist(db, req.user.id, tagsString);
    updateBookmarkTags(db, id, tagIds);
    updated.push(id);
  });

  res.json({ updated });
});

// Bulk remove tags from bookmarks
app.post("/api/tags/bulk-remove", authenticateTokenMiddleware, (req, res) => {
  const { bookmark_ids, tags } = req.body;
  if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
    return res
      .status(400)
      .json({ error: "bookmark_ids and tags are required" });
  }

  const removeSet = new Set(parseTags(tags).map((t) => t.toLowerCase()));
  const updated = [];

  bookmark_ids.forEach((id) => {
    const current = getBookmarkTagsString(db, id);
    if (!current) {
      updateBookmarkTags(db, id, []);
      return;
    }
    const filtered = parseTags(current).filter(
      (t) => !removeSet.has(t.toLowerCase()),
    );
    const tagsString = filtered.length ? stringifyTags(filtered) : null;

    if (tagsString) {
      const tagIds = ensureTagsExist(db, req.user.id, tagsString);
      updateBookmarkTags(db, id, tagIds);
    } else {
      updateBookmarkTags(db, id, []);
    }

    updated.push(id);
  });

  res.json({ updated });
});

// Rename/merge a tag across all bookmarks
app.post("/api/tags/rename", authenticateTokenMiddleware, (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required" });
  }

  const sourceTag = db
    .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
    .get(req.user.id, from);

  if (!sourceTag) {
    return res.status(404).json({ error: "Tag not found" });
  }

  const destinationTag = db
    .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
    .get(req.user.id, to);

  const sourceRelations = db
    .prepare(
      "SELECT bookmark_id, color_override FROM bookmark_tags WHERE tag_id = ?",
    )
    .all(sourceTag.id);

  const bookmarkIds = sourceRelations.map((row) => row.bookmark_id);

  let updated = 0;

  const runMerge = db.transaction(() => {
    if (destinationTag) {
      // Merge relationships onto destination tag and drop the source tag row.
      const insertRel = db.prepare(
        "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id, color_override) VALUES (?, ?, ?)",
      );
      sourceRelations.forEach((rel) => {
        const info = insertRel.run(
          rel.bookmark_id,
          destinationTag.id,
          rel.color_override || null,
        );
        if (info.changes > 0) updated += 1;
      });
      db.prepare("DELETE FROM bookmark_tags WHERE tag_id = ?").run(
        sourceTag.id,
      );
      db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(
        sourceTag.id,
        req.user.id,
      );
    } else {
      // Pure rename: update the existing tag row.
      db.prepare(
        "UPDATE tags SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      ).run(to, sourceTag.id, req.user.id);
      updated = bookmarkIds.length;
    }
  });

  runMerge();

  res.json({ updated });
});

// Track bookmark click
app.post(
  "/api/bookmarks/:id/click",
  authenticateTokenMiddleware,
  (req, res) => {
    db.prepare(
      `
    UPDATE bookmarks SET 
      click_count = click_count + 1,
      last_clicked = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
    ).run(req.params.id, req.user.id);

    res.json({ success: true });
  },
);

// ============== IMconfig.PORT/EXconfig.PORT ROUTES ==============

app.post("/api/import/html", authenticateTokenMiddleware, (req, res) => {
  try {
    const { html } = req.body;
    const imported = parseBookmarkHtml(html, req.user.id);
    res.json({ imported: imported.length, bookmarks: imported });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to parse bookmarks" });
  }
});

app.post("/api/import/json", authenticateTokenMiddleware, (req, res) => {
  try {
    const { bookmarks = [], folders = [] } = req.body;
    const imported = [];

    // Map source folder IDs to newly created (or matched) folder IDs
    const folderIdMap = new Map();

    // Helper to create/match folder respecting parent mapping
    const ensureFolder = (folder) => {
      if (folderIdMap.has(folder.id)) return folderIdMap.get(folder.id);

      const mappedParent = folder.parent_id
        ? folderIdMap.get(folder.parent_id) || null
        : null;

      // Reuse existing folder with same name under same parent when present
      const existing = db
        .prepare(
          "SELECT id FROM folders WHERE user_id = ? AND name = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
        )
        .get(req.user.id, folder.name, mappedParent, mappedParent);

      if (existing) {
        folderIdMap.set(folder.id, existing.id);
        return existing.id;
      }

      const maxPos = db
        .prepare(
          "SELECT MAX(position) as max FROM folders WHERE user_id = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
        )
        .get(req.user.id, mappedParent, mappedParent);
      const position = (maxPos.max || 0) + 1;

      const newId = uuidv4();
      db.prepare(
        "INSERT INTO folders (id, user_id, parent_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        newId,
        req.user.id,
        mappedParent,
        folder.name || "Imported",
        folder.color || "#6366f1",
        folder.icon || "folder",
        position,
      );

      folderIdMap.set(folder.id, newId);
      return newId;
    };

    // Insert folders in a dependency-safe order (parent before child when possible)
    const pending = [...folders];
    let guard = 0;
    while (pending.length && guard < 1000) {
      const next = pending.shift();
      const parentMapped = next.parent_id
        ? folderIdMap.get(next.parent_id)
        : null;
      if (
        next.parent_id &&
        next.parent_id !== null &&
        parentMapped === undefined
      ) {
        // Parent not processed yet; retry later
        pending.push(next);
      } else {
        ensureFolder(next);
      }
      guard++;
    }

    for (const bm of bookmarks) {
      const id = uuidv4();
      const faviconUrl = null;

      const mappedFolder = bm.folder_id
        ? folderIdMap.get(bm.folder_id) || null
        : null;

      db.prepare(
        `
        INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        id,
        req.user.id,
        mappedFolder,
        bm.title || bm.url,
        bm.url,
        bm.description || null,
        faviconUrl,
      );

      // Attach normalized tags if provided
      const normalizedTags = bm.tags ? stringifyTags(parseTags(bm.tags)) : null;
      if (normalizedTags) {
        const tagIds = ensureTagsExist(db, req.user.id, normalizedTags);
        updateBookmarkTags(db, id, tagIds);
      }

      // Trigger async favicon fetch
      fetchFaviconWrapper(bm.url, id).catch(console.error);

      const bookmarkRecord = db
        .prepare("SELECT * FROM bookmarks WHERE id = ?")
        .get(id);
      bookmarkRecord.tags = getBookmarkTagsString(db, id);
      imported.push(bookmarkRecord);
    }

    res.json({ imported: imported.length, bookmarks: imported });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to import bookmarks" });
  }
});

app.get("/api/export", authenticateTokenMiddleware, (req, res) => {
  const { format } = req.query;
  const bookmarks = db
    .prepare(
      `
    SELECT 
      b.*, 
      COALESCE(tags_joined.tags, '') as tags,
      COALESCE(tags_joined.tags_detailed, '[]') as tags_detailed
    FROM bookmarks b
    LEFT JOIN (
      SELECT bt.bookmark_id,
             GROUP_CONCAT(t.name, ', ') as tags,
             json_group_array(
               json_object(
                 'name', t.name,
                 'tag_id', t.id,
                 'color', t.color,
                 'color_override', bt.color_override
               )
             ) as tags_detailed
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY bt.bookmark_id
    ) tags_joined ON tags_joined.bookmark_id = b.id
    WHERE b.user_id = ?
  `,
    )
    .all(req.user.id, req.user.id);
  bookmarks.forEach((b) => {
    b.tags_detailed = parseTagsDetailed(b.tags_detailed);
  });
  const folders = db
    .prepare("SELECT * FROM folders WHERE user_id = ?")
    .all(req.user.id);

  if (format === "html") {
    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=anchormarks-bookmarks.html",
    );
    res.send(generateBookmarkHtml(bookmarks, folders));
  } else {
    res.json({ bookmarks, folders });
  }
});

// ============== SYNC ROUTES ==============

app.get("/api/sync/status", authenticateTokenMiddleware, (req, res) => {
  const bookmarkCount = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
    .get(req.user.id);
  const folderCount = db
    .prepare("SELECT COUNT(*) as count FROM folders WHERE user_id = ?")
    .get(req.user.id);
  const lastUpdated = db
    .prepare("SELECT MAX(updated_at) as last FROM bookmarks WHERE user_id = ?")
    .get(req.user.id);

  res.json({
    bookmarks: bookmarkCount.count,
    folders: folderCount.count,
    last_updated: lastUpdated.last,
  });
});

app.post("/api/sync/push", authenticateTokenMiddleware, (req, res) => {
  const { bookmarks, folders } = req.body;
  const results = { created: 0, updated: 0, errors: [] };

  if (folders && folders.length) {
    for (const folder of folders) {
      try {
        const existing = db
          .prepare("SELECT * FROM folders WHERE id = ? AND user_id = ?")
          .get(folder.id, req.user.id);

        if (existing) {
          db.prepare(
            "UPDATE folders SET name = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).run(folder.name, folder.color, folder.parent_id, folder.id);
          results.updated++;
        } else {
          db.prepare(
            "INSERT INTO folders (id, user_id, name, color, parent_id) VALUES (?, ?, ?, ?, ?)",
          ).run(
            folder.id || uuidv4(),
            req.user.id,
            folder.name,
            folder.color || "#6366f1",
            folder.parent_id,
          );
          results.created++;
        }
      } catch (err) {
        results.errors.push({ folder: folder.name, error: err.message });
      }
    }
  }

  if (bookmarks && bookmarks.length) {
    for (const bm of bookmarks) {
      try {
        const existing = db
          .prepare("SELECT * FROM bookmarks WHERE url = ? AND user_id = ?")
          .get(bm.url, req.user.id);

        if (existing) {
          db.prepare(
            "UPDATE bookmarks SET title = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).run(bm.title, bm.folder_id, existing.id);
          if (bm.tags) {
            const tagsString = stringifyTags(parseTags(bm.tags));
            const tagIds = ensureTagsExist(db, req.user.id, tagsString);
            updateBookmarkTags(db, existing.id, tagIds);
          }
          results.updated++;
        } else {
          const id = uuidv4();
          const faviconUrl = null;

          db.prepare(
            "INSERT INTO bookmarks (id, user_id, folder_id, title, url, favicon) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(
            id,
            req.user.id,
            bm.folder_id,
            bm.title || bm.url,
            bm.url,
            faviconUrl,
          );

          if (bm.tags) {
            const tagsString = stringifyTags(parseTags(bm.tags));
            const tagIds = ensureTagsExist(db, req.user.id, tagsString);
            updateBookmarkTags(db, id, tagIds);
          }

          // Trigger async favicon fetch
          fetchFaviconWrapper(bm.url, id).catch(console.error);
          results.created++;
        }
      } catch (err) {
        results.errors.push({ url: bm.url, error: err.message });
      }
    }
  }

  res.json(results);
});

app.get("/api/sync/pull", authenticateTokenMiddleware, (req, res) => {
  const bookmarks = db
    .prepare(
      `
    SELECT 
      b.*, 
      COALESCE(tags_joined.tags, '') as tags,
      COALESCE(tags_joined.tags_detailed, '[]') as tags_detailed
    FROM bookmarks b
    LEFT JOIN (
      SELECT bt.bookmark_id,
             GROUP_CONCAT(t.name, ', ') as tags,
             json_group_array(
               json_object(
                 'name', t.name,
                 'tag_id', t.id,
                 'color', t.color,
                 'color_override', bt.color_override
               )
             ) as tags_detailed
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY bt.bookmark_id
    ) tags_joined ON tags_joined.bookmark_id = b.id
    WHERE b.user_id = ?
    ORDER BY b.position
  `,
    )
    .all(req.user.id, req.user.id);
  bookmarks.forEach((b) => {
    b.tags_detailed = parseTagsDetailed(b.tags_detailed);
  });
  const folders = db
    .prepare("SELECT * FROM folders WHERE user_id = ? ORDER BY position")
    .all(req.user.id);
  res.json({ bookmarks, folders });
});

// ============== QUICK SEARCH (Flow Launcher) ==============

app.get("/api/quick-search", authenticateTokenMiddleware, (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q) {
    const bookmarks = db
      .prepare(
        `
    SELECT id, title, url, favicon_local as favicon, click_count 
      FROM bookmarks 
      WHERE user_id = ? 
      ORDER BY click_count DESC, last_clicked DESC, created_at DESC 
      LIMIT ?
    `,
      )
      .all(req.user.id, parseInt(limit));
    return res.json(bookmarks);
  }

  const searchTerm = `%${q}%`;
  const bookmarks = db
    .prepare(
      `
    SELECT DISTINCT b.id, b.title, b.url, b.favicon_local as favicon, b.click_count 
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t ON t.id = bt.tag_id
    WHERE b.user_id = ? AND (b.title LIKE ? OR b.url LIKE ? OR t.name LIKE ?)
    ORDER BY 
      CASE WHEN b.title LIKE ? THEN 0 ELSE 1 END,
      b.click_count DESC
    LIMIT ?
  `,
    )
    .all(
      req.user.id,
      searchTerm,
      searchTerm,
      searchTerm,
      `${q}%`,
      parseInt(limit),
    );

  res.json(bookmarks);
});

// ============== STATS ==============

app.get("/api/stats", authenticateTokenMiddleware, (req, res) => {
  const bookmarkCount = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
    .get(req.user.id);
  const folderCount = db
    .prepare("SELECT COUNT(*) as count FROM folders WHERE user_id = ?")
    .get(req.user.id);
  const favoriteCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_favorite = 1",
    )
    .get(req.user.id);
  const topClicked = db
    .prepare(
      `
    SELECT title, url, favicon_local as favicon, click_count 
    FROM bookmarks 
    WHERE user_id = ? AND click_count > 0 
    ORDER BY click_count DESC 
    LIMIT 5
  `,
    )
    .all(req.user.id);

  // Get tag stats from normalized tables
  const tagCounts = db
    .prepare(
      `
      SELECT t.name, COUNT(bt.bookmark_id) as count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC, t.name ASC
    `,
    )
    .all(req.user.id);

  const usedTags = tagCounts.filter((t) => t.count > 0);

  res.json({
    total_bookmarks: bookmarkCount.count,
    total_folders: folderCount.count,
    total_tags: usedTags.length,
    favorites: favoriteCount.count,
    top_clicked: topClicked,
    top_tags: usedTags
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((t) => [t.name, t.count]),
  });
});

// ============== HEALTH CHECK / CLEANUP ==============

// Find duplicate bookmarks (same URL)
app.get("/api/health/duplicates", authenticateTokenMiddleware, (req, res) => {
  const duplicates = db
    .prepare(
      `
        SELECT url, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(title, '|||') as titles
        FROM bookmarks 
        WHERE user_id = ?
        GROUP BY url 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    `,
    )
    .all(req.user.id);

  res.json({
    total_duplicates: duplicates.length,
    duplicates: duplicates.map((d) => ({
      url: d.url,
      count: d.count,
      ids: d.ids.split(","),
      titles: d.titles.split("|||"),
    })),
  });
});

// Delete duplicate bookmarks (keep the first one)
app.post(
  "/api/health/duplicates/cleanup",
  authenticateTokenMiddleware,
  (req, res) => {
    const duplicates = db
      .prepare(
        `
        SELECT url, GROUP_CONCAT(id) as ids
        FROM bookmarks 
        WHERE user_id = ?
        GROUP BY url 
        HAVING COUNT(*) > 1
    `,
      )
      .all(req.user.id);

    let deleted = 0;
    for (const dup of duplicates) {
      const ids = dup.ids.split(",");
      // Keep first, delete rest
      for (let i = 1; i < ids.length; i++) {
        db.prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?").run(
          ids[i],
          req.user.id,
        );
        deleted++;
      }
    }

    res.json({ deleted, message: `Removed ${deleted} duplicate bookmarks` });
  },
);

// Check for dead links (async - returns job status)
app.get(
  "/api/health/deadlinks",
  authenticateTokenMiddleware,
  async (req, res) => {
    const { check } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    // Get bookmarks that haven't been checked recently or never checked
    const bookmarks = db
      .prepare(
        `
        SELECT id, url, title, last_checked, is_dead
        FROM bookmarks 
        WHERE user_id = ?
        ORDER BY last_checked ASC NULLS FIRST
        LIMIT ?
    `,
      )
      .all(req.user.id, limit);

    if (check !== "true") {
      // Just return current status
      const deadCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_dead = 1",
        )
        .get(req.user.id);
      return res.json({
        dead_links: deadCount.count,
        unchecked: bookmarks.filter((b) => !b.last_checked).length,
        bookmarks: bookmarks
          .filter((b) => b.is_dead === 1)
          .map((b) => ({ id: b.id, url: b.url, title: b.title })),
      });
    }

    // Actually check the links
    const results = [];
    const https = require("https");
    const http = require("http");

    for (const bookmark of bookmarks.slice(0, 20)) {
      // Check max 20 at a time
      try {
        const urlObj = new URL(bookmark.url);
        if (
          config.NODE_ENV === "production" &&
          (await isPrivateAddress(bookmark.url))
        ) {
          continue;
        }
        const protocol = urlObj.protocol === "https:" ? https : http;

        const isDead = await new Promise((resolve) => {
          const req = protocol.request(
            bookmark.url,
            { method: "HEAD", timeout: 5000 },
            (response) => {
              resolve(response.statusCode >= 400);
            },
          );
          req.on("error", () => resolve(true));
          req.on("timeout", () => {
            req.destroy();
            resolve(true);
          });
          req.end();
        });

        db.prepare(
          "UPDATE bookmarks SET is_dead = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(isDead ? 1 : 0, bookmark.id);

        if (isDead) {
          results.push({
            id: bookmark.id,
            url: bookmark.url,
            title: bookmark.title,
          });
        }
      } catch (e) {
        // Invalid URL, mark as dead
        db.prepare(
          "UPDATE bookmarks SET is_dead = 1, last_checked = CURRENT_TIMESTAMP WHERE id = ?",
        ).run(bookmark.id);
        results.push({
          id: bookmark.id,
          url: bookmark.url,
          title: bookmark.title,
          error: e.message,
        });
      }
    }

    res.json({
      checked: Math.min(20, bookmarks.length),
      dead_links_found: results.length,
      dead_links: results,
    });
  },
);

// Get bookmarks by domain
app.get("/api/bookmarks/by-domain", authenticateTokenMiddleware, (req, res) => {
  const bookmarks = db
    .prepare("SELECT url FROM bookmarks WHERE user_id = ?")
    .all(req.user.id);

  const domainCounts = {};
  bookmarks.forEach((b) => {
    try {
      const domain = new URL(b.url).hostname.replace("www.", "");
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    } catch (e) {}
  });

  const sorted = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([domain, count]) => ({ domain, count }));

  res.json(sorted);
});

// ============== EXAMPLE BOOKMARKS ==============

const EXAMPLE_BOOKMARKS = [
  // Productivity
  {
    title: "Google",
    url: "https://www.google.com",
    description: "Search the web",
    tags: "search,productivity",
  },
  {
    title: "Gmail",
    url: "https://mail.google.com",
    description: "Google email service",
    tags: "email,productivity",
  },
  {
    title: "Google Calendar",
    url: "https://calendar.google.com",
    description: "Manage your schedule",
    tags: "calendar,productivity",
  },
  {
    title: "Google Drive",
    url: "https://drive.google.com",
    description: "Cloud storage and collaboration",
    tags: "storage,productivity",
  },
  {
    title: "Notion",
    url: "https://www.notion.so",
    description: "All-in-one workspace",
    tags: "notes,productivity",
  },

  // Development
  {
    title: "GitHub",
    url: "https://github.com",
    description: "Code hosting and collaboration",
    tags: "development,git",
  },
  {
    title: "Stack Overflow",
    url: "https://stackoverflow.com",
    description: "Programming Q&A community",
    tags: "development,help",
  },
  {
    title: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    description: "Web development documentation",
    tags: "development,docs",
  },
  {
    title: "CodePen",
    url: "https://codepen.io",
    description: "Frontend code playground",
    tags: "development,sandbox",
  },

  // Learning
  {
    title: "Wikipedia",
    url: "https://www.wikipedia.org",
    description: "Free encyclopedia",
    tags: "learning,reference",
  },
  {
    title: "YouTube",
    url: "https://www.youtube.com",
    description: "Video streaming platform",
    tags: "learning,entertainment",
  },
  {
    title: "Coursera",
    url: "https://www.coursera.org",
    description: "Online courses and degrees",
    tags: "learning,education",
  },

  // News & Social
  {
    title: "Reddit",
    url: "https://www.reddit.com",
    description: "Social news and discussion",
    tags: "social,news",
  },
  {
    title: "Hacker News",
    url: "https://news.ycombinator.com",
    description: "Tech news and discussion",
    tags: "news,tech",
  },
  {
    title: "Twitter / X",
    url: "https://twitter.com",
    description: "Social microblogging",
    tags: "social,news",
  },
];

// Create example bookmarks for a user
function createExampleBookmarks(userId, folderId = null) {
  const created = [];

  for (let i = 0; i < EXAMPLE_BOOKMARKS.length; i++) {
    const bm = EXAMPLE_BOOKMARKS[i];
    const id = uuidv4();
    const faviconUrl = null;

    db.prepare(
      `
            INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, position) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
    ).run(
      id,
      userId,
      folderId,
      bm.title,
      bm.url,
      bm.description,
      faviconUrl,
      i + 1,
    );

    if (bm.tags) {
      const tagsString = stringifyTags(parseTags(bm.tags));
      const tagIds = ensureTagsExist(db, userId, tagsString);
      updateBookmarkTags(db, id, tagIds);
    }

    // Trigger async favicon fetch
    fetchFaviconWrapper(bm.url, id).catch(console.error);

    created.push({ id, ...bm, favicon: faviconUrl, tags: bm.tags });
  }

  return created;
}

// ============== HELPER FUNCTIONS ==============

// const cheerio = require('cheerio'); // Removed as not available
// Since we don't have cheerio, we'll stick to regex/parsing but handle nesting.
// The previous logic flatten import.
// To support nesting, we need to respect the <DL> hierarchy.
// Netscape bookmark file format uses recursive <DL><p><DT><H3>...</H3><DL>...</DL></DT> ... </DL>

function parseBookmarkHtml(html, userId) {
  const imported = [];

  // Using simple regex for flat structure wasn't enough.
  // Let's implement a recursive parser or simulate a DOM parser.
  // Given the constraints and likely input size, a stateful parser is safer.

  // However, writing a full HTML parser in one block is error-prone.
  // Let's refine the regex approach to be recursive if possible, or use a stack-based parser.
  // Or simpler: Use a library if available. Assuming no external libs besides what's in package.json.
  // package.json likely has no cheerio.

  // Let's try a stack-based approach assuming valid Netscape format
  // Tokens: <DT>, <H3>, <A>, <DL>, </DL>

  // Helper to create folder
  function createFolder(name, parentId) {
    const id = uuidv4();
    // Check duplicate name in same parent not strictly required but polite.
    // For simpler logic, just creates new one or returns existing if identical name/parent exists?
    // Let's create new to avoid merging mess unless name match in same parent.

    const existing = db
      .prepare(
        "SELECT id FROM folders WHERE user_id = ? AND name = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
      )
      .get(userId, name, parentId || null, parentId || null);

    if (existing) return existing.id;

    const maxPos = db
      .prepare(
        "SELECT MAX(position) as max FROM folders WHERE user_id = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
      )
      .get(userId, parentId || null, parentId || null);
    const position = (maxPos.max || 0) + 1;

    db.prepare(
      "INSERT INTO folders (id, user_id, name, color, icon, position, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, userId, name, "#6366f1", "folder", position, parentId || null);

    return id;
  }

  // We will simple-parse line by line or tag by tag?
  // Regex-based recursive parser for specific structure:

  // 1. Normalize
  let content = html.replace(/[\r\n]+/g, " ").replace(/>\s+</g, "><");

  // 2. We need to find <DT><H3...>(.*?)</H3>...<DL>(.*?)</DL> pattern and <DT><A...>(.*?)</A> pattern.
  // The previous implementation was too greedy.

  // Let's use a scanning function that processes a string and recursively calls itself for DL blocks

  function parseBlock(blockHtml, currentParentId) {
    // Regex to find items in this block.
    // Items are either <DT><H3>...<DL>...</DL> (Folder) or <DT><A>...</A> (Bookmark)
    // Since regex doesn't support balanced tags easily, this is hard.

    // Alternative: Use 'cheerio' if available? No.
    // Let's use a makeshift parser index-based.

    let i = 0;
    const len = blockHtml.length;

    while (i < len) {
      // Find next <DT>
      const dtIndex = blockHtml.indexOf("<DT>", i);
      if (dtIndex === -1) break;

      i = dtIndex + 4; // Past <DT>

      // Check if it's an H3 (Folder) or A (Bookmark)
      if (blockHtml.startsWith("<H3", i)) {
        // Folder
        const h3End = blockHtml.indexOf("</H3>", i);
        const h3Start = blockHtml.indexOf(">", i) + 1;
        const folderName = blockHtml.substring(h3Start, h3End);

        const dlStart = blockHtml.indexOf("<DL>", h3End);
        const dlEnd = findClosingTag(blockHtml, dlStart, "DL"); // Helpers needed

        if (dlStart !== -1 && dlEnd !== -1) {
          const folderId = createFolder(folderName, currentParentId);
          // Recurse inner DL content
          const innerHtml = blockHtml.substring(dlStart + 4, dlEnd); // +4 skip <p> usually? Netscape adds <p> after DL or inside?
          // Usually <DL><p>...
          parseBlock(innerHtml, folderId);
          i = dlEnd + 5; // Past </DL>
        } else {
          i = h3End + 5;
        }
      } else if (blockHtml.startsWith("<A", i)) {
        // Bookmark
        const aEnd = blockHtml.indexOf("</A>", i);
        const aTagEnd = blockHtml.indexOf(">", i);
        const aHtml = blockHtml.substring(i, aEnd + 4); // Full <A...>...</A>

        // Parse attributes
        const attributes = blockHtml.substring(i, aTagEnd);
        const title = blockHtml.substring(aTagEnd + 1, aEnd);

        // Extract HREF
        const hrefMatch = attributes.match(/HREF="([^"]+)"/i);
        if (hrefMatch) {
          const url = hrefMatch[1];
          // Extract TAGS
          const tagsMatch = attributes.match(/TAGS=["']([^"']+)["']/i);
          const tags = tagsMatch ? tagsMatch[1] : null;

          if (!url.startsWith("javascript:") && !url.startsWith("place:")) {
            const id = uuidv4();
            const faviconUrl = null;
            const tagsString = tags ? stringifyTags(parseTags(tags)) : null;

            db.prepare(
              "INSERT INTO bookmarks (id, user_id, folder_id, title, url, favicon) VALUES (?, ?, ?, ?, ?, ?)",
            ).run(id, userId, currentParentId, title, url, faviconUrl);

            if (tagsString) {
              const tagIds = ensureTagsExist(db, userId, tagsString);
              updateBookmarkTags(db, id, tagIds);
            }

            fetchFaviconWrapper(url, id).catch(console.error);
            imported.push({ id, title, url, tags: tagsString || null });
          }
        }
        i = aEnd + 4;
      } else {
        i++;
      }
    }
  }

  // Helper to find balancing </DL>
  function findClosingTag(str, start, tagName) {
    let depth = 1;
    let pos = start + tagName.length + 2; // Past <DL>
    const openTag = `<${tagName}`;
    const closeTag = `</${tagName}>`;

    while (depth > 0 && pos < str.length) {
      const nextOpen = str.indexOf(openTag, pos);
      const nextClose = str.indexOf(closeTag, pos);

      if (nextClose === -1) return -1; // Malformed

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTag.length;
      } else {
        depth--;
        pos = nextClose + closeTag.length;
      }
      if (depth === 0) return nextClose;
    }
    return -1;
  }

  // Strip DOCTYPE/HTML wrapper if possible or just search body
  parseBlock(html, null);

  return imported;
}

function generateBookmarkHtml(bookmarks, folders) {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>AnchorMarks Bookmarks</TITLE>
<H1>AnchorMarks Bookmarks</H1>
<DL><p>\n`;

  for (const bm of bookmarks) {
    const tagsAttr = bm.tags ? ` TAGS="${bm.tags}"` : "";
    html += `    <DT><A HREF="${bm.url}"${tagsAttr}>${bm.title}</A>\n`;
  }

  html += `</DL><p>`;
  return html;
}

// ============== SMART ORGANIZATION ENDPOINTS ==============
// Note: Must be BEFORE the catch-all route to prevent interference

// GET /api/tags/suggest-smart - Smart tag suggestions for a URL
app.get("/api/tags/suggest-smart", authenticateTokenMiddleware, (req, res) => {
  const { url, limit = 10 } = req.query;
  const include_domain = req.query.include_domain !== "false";
  const include_activity = req.query.include_activity !== "false";
  const include_similar = req.query.include_similar !== "false";

  if (!url) {
    return res.status(400).json({ error: "URL parameter required" });
  }

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const domain = urlObj.hostname.replace(/^www\./, "");

    // Get domain category info
    const categoryInfo = smartOrg.getDomainCategory(url);
    const domainStats = smartOrg.getDomainStats(db, req.user.id, domain);

    // Collect all possible tags to score
    const tagsToScore = new Set();

    // Add domain category tags
    if (include_domain && categoryInfo.tags) {
      categoryInfo.tags.forEach((t) => tagsToScore.add(t));
    }

    // Add existing tags from user's bookmarks
    const userTags = db
      .prepare("SELECT DISTINCT name FROM tags WHERE user_id = ?")
      .all(req.user.id);
    userTags.forEach((row) => tagsToScore.add(row.name));

    // Add tags from domain bookmarks
    const domainTags = db
      .prepare(
        `
            SELECT DISTINCT t.name as tag
            FROM bookmarks b
            JOIN bookmark_tags bt ON bt.bookmark_id = b.id
            JOIN tags t ON t.id = bt.tag_id
            WHERE b.user_id = ? AND b.url LIKE ?
        `,
      )
      .all(req.user.id, `%${domain}%`);

    domainTags.forEach((row) => {
      if (row.tag) tagsToScore.add(row.tag);
    });

    // Score all tags
    const suggestions = [];
    tagsToScore.forEach((tag) => {
      const scores = smartOrg.calculateTagScore(db, req.user.id, url, tag, {
        domain: include_domain ? 0.35 : 0,
        activity: include_activity ? 0.4 : 0,
        similarity: include_similar ? 0.25 : 0,
      });

      if (scores.score > 0.1) {
        suggestions.push({
          tag,
          score: Math.round(scores.score * 100) / 100,
          source: smartOrg.getTopSource
            ? smartOrg.getTopSource(scores)
            : "domain",
          reason: smartOrg.generateReason
            ? smartOrg.generateReason(tag, domain, scores, db, req.user.id)
            : "Suggested tag",
        });
      }
    });

    // Sort by score and limit
    suggestions.sort((a, b) => b.score - a.score);

    res.json({
      suggestions: suggestions.slice(0, parseInt(limit)),
      domain_info: {
        domain,
        category: categoryInfo.category,
        ...domainStats,
      },
    });
  } catch (err) {
    console.error("Smart tag suggestions error:", err.message || err);
    return res.status(400).json({ error: err.message || "Invalid URL" });
  }
});

// GET /api/smart-collections/suggest - Get collection suggestions
app.get(
  "/api/smart-collections/suggest",
  authenticateTokenMiddleware,
  (req, res) => {
    const { type, limit = 5 } = req.query;

    try {
      let suggestions = [];

      // Get tag clusters
      if (!type || type === "tag_cluster") {
        const clusters = smartOrg.getTagClusters(db, req.user.id);
        suggestions = suggestions.concat(clusters.slice(0, 2));
      }

      // Get activity-based collections
      if (!type || type === "activity") {
        const activityCollections = smartOrg.getActivityCollections(
          db,
          req.user.id,
        );
        suggestions = suggestions.concat(activityCollections.slice(0, 2));
      }

      // Get domain-based collections
      if (!type || type === "domain") {
        const domainCollections = smartOrg.getDomainCollections(
          db,
          req.user.id,
        );
        suggestions = suggestions.concat(domainCollections.slice(0, 2));
      }

      // Deduplicate by name and limit
      const seen = new Set();
      const unique = suggestions.filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });

      res.json({
        collections: unique.slice(0, parseInt(limit)),
      });
    } catch (err) {
      console.error("Smart collections suggest error:", err);
      return res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/smart-collections/create - Create a collection from suggestion
app.post(
  "/api/smart-collections/create",
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  (req, res) => {
    const {
      name,
      type = "tag_cluster",
      icon,
      color,
      tags,
      domain,
      filters,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    if (type === "tag_cluster" && (!tags || !tags.length)) {
      return res
        .status(400)
        .json({ error: "Rules are required for tag cluster collections" });
    }

    try {
      const id = uuidv4();

      // Convert to filters object for smart_collections table
      let filterObj = {};

      if (type === "tag_cluster" && tags && tags.length) {
        filterObj = { tags };
      } else if (type === "domain" && domain) {
        filterObj = { domain };
      } else if (type === "activity" && filters) {
        filterObj = filters;
      }

      db.prepare(
        `
            INSERT INTO smart_collections (id, user_id, name, icon, color, filters)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        id,
        req.user.id,
        name,
        icon || "filter",
        color || "#6366f1",
        JSON.stringify(filterObj),
      );

      res.json({
        id,
        name,
        type,
        icon: icon || "filter",
        color: color || "#6366f1",
        filters: filterObj,
        created: true,
      });
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to create collection: " + err.message });
    }
  },
);

// GET /api/smart-collections/domain-stats - Domain statistics
app.get(
  "/api/smart-collections/domain-stats",
  authenticateTokenMiddleware,
  (req, res) => {
    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({ error: "Domain parameter required" });
    }

    try {
      const stats = smartOrg.getDomainStats(db, req.user.id, domain);
      const category = smartOrg.getDomainCategory(`https://${domain}`);

      // Get recent bookmarks
      const recentBookmarks = db
        .prepare(
          `
            SELECT COUNT(*) as count FROM bookmarks
            WHERE user_id = ? AND url LIKE ? AND datetime(created_at) > datetime('now', '-7 days')
        `,
        )
        .get(req.user.id, `%${domain}%`).count;

      // Get most clicked
      const mostClicked = db
        .prepare(
          `
            SELECT title, click_count FROM bookmarks
            WHERE user_id = ? AND url LIKE ?
            ORDER BY click_count DESC
            LIMIT 5
        `,
        )
        .all(req.user.id, `%${domain}%`);

      res.json({
        domain: stats.domain,
        bookmark_count: stats.bookmarkCount,
        tag_distribution: stats.tagDistribution,
        category: category.category,
        recentBookmarks,
        mostClicked,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/smart-collections/tag-clusters - Get tag clusters
app.get(
  "/api/smart-collections/tag-clusters",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      const clusters = smartOrg.getTagClusters(db, req.user.id);
      res.json({ clusters });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/smart-insights - Comprehensive insights dashboard
app.get("/api/smart-insights", authenticateTokenMiddleware, (req, res) => {
  try {
    const totalBookmarks = db
      .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
      .get(req.user.id).count;

    const totalTags = db
      .prepare("SELECT COUNT(*) as count FROM tags WHERE user_id = ?")
      .get(req.user.id).count;

    // Top domains
    //     SELECT
    //         REPLACE(REPLACE(url, 'https://', ''), 'http://', '') as full_domain,
    //         COUNT(*) as count
    //     FROM bookmarks
    //     WHERE user_id = ? AND url IS NOT NULL
    //     GROUP BY full_domain
    //     ORDER BY count DESC
    //     LIMIT 5
    // `).all(req.user.id).map(row => ({
    //     domain: row.full_domain ? row.full_domain.split('/')[0].replace(/^www\./, '') : 'unknown',
    //     count: row.count
    // }));

    // Top tags
    // const topTags = db.prepare(`
    //     SELECT name, COUNT(bt.tag_id) as count
    //     FROM tags t
    //     LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
    //     WHERE t.user_id = ?
    //     GROUP BY t.id
    //     ORDER BY count DESC
    //     LIMIT 5
    // `).all(req.user.id);

    // Recent activity
    const thisWeek = db
      .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
      .get(req.user.id).count;

    const thisMonth = db
      .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
      .get(req.user.id).count;

    const lastAdded = db
      .prepare(
        "SELECT created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(req.user.id);

    // Engagement
    const totalClicks = db
      .prepare(
        "SELECT COALESCE(SUM(click_count), 0) as total FROM bookmarks WHERE user_id = ?",
      )
      .get(req.user.id).total;

    const unread = db
      .prepare(
        "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count = 0",
      )
      .get(req.user.id).count;

    const frequentlyUsed = db
      .prepare(
        "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 5",
      )
      .get(req.user.id).count;

    // Suggestions
    // const suggestedCollections = smartOrg.getActivityCollections(db, req.user.id).slice(0, 2);
    // const suggestedClusters = smartOrg.getTagClusters(db, req.user.id).slice(0, 2);

    res.json({
      total_bookmarks: totalBookmarks,
      total_tags: totalTags,
      top_domains: [], // topDomains.map(d => ({
      //     domain: d.domain,
      //     count: d.count,
      //     percentage: totalBookmarks > 0 ? Math.round((d.count / totalBookmarks) * 100) : 0
      // })),
      top_tags: [], // topTags.map(t => ({
      //     tag: t.name,
      //     count: t.count,
      //     percentage: totalBookmarks > 0 ? Math.round((t.count / totalBookmarks) * 100) : 0
      // })),
      recent_activity: {
        bookmarks_this_week: thisWeek,
        bookmarks_this_month: thisMonth,
        last_bookmark_added: lastAdded?.created_at || null,
      },
      engagement: {
        total_clicks: totalClicks,
        unread_bookmarks: unread,
        frequently_used: frequentlyUsed,
      },
      suggestions: {
        create_these_collections: [], // suggestedCollections,
        organize_these_tags: [], // suggestedClusters
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend for all other routes
app.all(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

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

// Start server
if (config.NODE_ENV !== "test") {
  app.listen(config.PORT, config.HOST, () => {
    console.log(`
╔═════════════════════════════════════════════════════════════════╗
║                                                                 ║
║   AnchorMarks v1.0.0                                            ║
║                                                                 ║
║   Server:   http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}                               ║
║   API:      http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}/api                           ║
║   Mode:     ${config.NODE_ENV.padEnd(52)}║
║   Database: ${config.DB_PATH.padEnd(52)}║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝
    `);
  });
}

// Expose helpers for tests
app._isPrivateAddress = isPrivateAddress;
app.db = db;

module.exports = app;
