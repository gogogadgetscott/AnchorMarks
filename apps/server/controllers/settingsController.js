const userSettingsModel = require("../models/userSettings");
const {
  EXAMPLE_BOOKMARKS,
  STARTER_FOLDER,
} = require("../utils/exampleBookmarks");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../services/tagService");
const { v4: uuidv4 } = require("uuid");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function formatSettings(settings) {
  let extra = {};
  try {
    extra = settings.settings_json ? JSON.parse(settings.settings_json) : {};
  } catch {
    extra = {};
  }
  return {
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
  };
}

const DEFAULT_SETTINGS = {
  view_mode: "grid",
  hide_favicons: false,
  hide_sidebar: false,
  ai_suggestions_enabled: true,
  rich_link_previews_enabled: true,
  theme: "dark",
  dashboard_mode: "folder",
  dashboard_tags: [],
  dashboard_sort: "updated_desc",
  widget_order: {},
  collapsed_sections: [],
  tour_completed: false,
};

function getSettings(req, res) {
  const db = req.app.get("db");
  try {
    const settings = db
      .prepare("SELECT * FROM user_settings WHERE user_id = ?")
      .get(req.user.id);
    if (!settings) return res.json(DEFAULT_SETTINGS);
    res.json(formatSettings(settings));
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching settings");
  }
}

function updateSettings(req, res) {
  const db = req.app.get("db");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    logger.debug(`Saving settings for user ${req.user.id}`, data);
    userSettingsModel.upsertUserSettings(db, req.user.id, data);
    const settings = db
      .prepare("SELECT * FROM user_settings WHERE user_id = ?")
      .get(req.user.id);
    if (!settings) return res.json({});
    res.json(formatSettings(settings));
  } catch (err) {
    return reportAndSend(res, err, logger, "Error saving settings");
  }
}

async function resetBookmarks(req, res) {
  const db = req.app.get("db");
  const fetchFaviconWrapper = req.app.get("fetchFaviconWrapper");
  try {
    const userId = req.user.id;
    db.prepare(
      `DELETE FROM bookmark_tags WHERE bookmark_id IN (SELECT id FROM bookmarks WHERE user_id = ?)`,
    ).run(userId);
    db.prepare("DELETE FROM bookmarks WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM folders WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM tags WHERE user_id = ?").run(userId);
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
    let bookmarksCreated = 0;
    for (const bm of EXAMPLE_BOOKMARKS) {
      const id = uuidv4();
      const bookmarkFolderId = bm.inStarterFolder ? folderId : null;
      db.prepare(
        `INSERT INTO bookmarks (id, user_id, folder_id, title, url, description) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, userId, bookmarkFolderId, bm.title, bm.url, bm.description);
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
      if (fetchFaviconWrapper)
        fetchFaviconWrapper(bm.url, id, userId).catch((e) =>
          logger.warn("Favicon fetch failed during bookmark reset", e),
        );
      bookmarksCreated++;
    }
    res.json({
      success: true,
      bookmarks_created: bookmarksCreated,
      message: "Bookmarks reset successfully",
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error resetting bookmarks");
  }
}

function getApiHealth(req, res) {
  const config = require("../config");
  res.json({
    status: "ok",
    version: req.app.get("appVersion") || "1.0.0",
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getSettings, updateSettings, resetBookmarks, getApiHealth };
