const { checkUrlHealth } = require("../services/linkHealthService");
const { logger } = require("../lib/logger");
const bookmarkModel = require("../models/bookmark");
const { broadcast } = require("../services/websocketService");

async function checkLink(req, res) {
  const data = req.validated;
  if (!data) return res.status(400).json({ error: "Validation required" });
  const result = await checkUrlHealth(data.url);
  res.json({
    status: result.httpCode || 0,
    ok: ["ok", "redirect"].includes(result.status),
    health_status: result.status,
    error: result.error,
  });
}

function findDuplicates(req, res) {
  const db = req.app.get("db");
  try {
    const duplicates = db
      .prepare(
        `
      SELECT url, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM bookmarks WHERE user_id = ? GROUP BY url HAVING count > 1
    `,
      )
      .all(req.user.id);
    const count = duplicates.length;
    res.json({
      duplicates,
      message:
        count === 0 ? "No duplicates found" : `Found ${count} duplicate URL(s)`,
    });
  } catch (err) {
    logger.error("Error listing duplicates", err);
    res.status(500).json({ error: "Failed to list duplicates" });
  }
}

function optimizeDatabase(req, res) {
  const db = req.app.get("db");
  try {
    db.exec("VACUUM");
    res.json({ success: true, message: "Database optimized" });
  } catch (err) {
    logger.error("Error optimizing database", err);
    res.status(500).json({ error: "Failed to optimize database" });
  }
}

async function checkLinks(req, res) {
  const db = req.app.get("db");
  try {
    const bookmarks = db
      .prepare(
        `SELECT id, url
         FROM bookmarks
         WHERE user_id = ?
         ORDER BY last_checked ASC NULLS FIRST
         LIMIT 100`,
      )
      .all(req.user.id);
    let ok = 0;
    let broken = 0;
    for (const bookmark of bookmarks) {
      const result = await checkUrlHealth(bookmark.url);
      bookmarkModel.setLinkHealth(db, req.user.id, bookmark.id, result);
      if (["ok", "redirect"].includes(result.status)) ok++;
      else broken++;
    }
    broadcast(req.user.id, { type: "bookmarks:changed" });
    res.json({
      success: true,
      message: `${ok} reachable, ${broken} need attention in this batch`,
      checked: ok + broken,
    });
  } catch (err) {
    logger.error("Error checking links", err);
    res.status(500).json({ error: "Failed to check links" });
  }
}

async function refreshFavicons(req, res) {
  const db = req.app.get("db");
  const fetchFaviconWrapper = req.app.get("fetchFaviconWrapper");
  try {
    const { bookmarks } = bookmarkModel.listBookmarks(db, req.user.id);
    const total = bookmarks.length;
    const userId = req.user.id;

    // Respond immediately — favicon fetching runs in the background
    res.json({
      success: true,
      message: `Refreshing ${total} favicon(s) in background`,
    });

    for (const bookmark of bookmarks) {
      try {
        bookmarkModel.updateBookmark(db, userId, bookmark.id, {
          favicon: null,
        });
        await fetchFaviconWrapper(bookmark.url, bookmark.id, userId);
      } catch (e) {
        logger.warn("Favicon refresh failed for bookmark", {
          id: bookmark.id,
          err: e,
        });
      }
    }
  } catch (err) {
    logger.error("Error refreshing favicons", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to refresh favicons" });
    }
  }
}

module.exports = {
  checkLink,
  checkLinks,
  findDuplicates,
  optimizeDatabase,
  refreshFavicons,
};
