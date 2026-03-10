const { v4: uuidv4 } = require("uuid");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../services/tagService");
const { normalizeTagColorOverrides } = require("../utils/tagUtils");
const bookmarkModel = require("../models/bookmark");
const { isPrivateAddress } = require("../utils/ssrfUtils");
const config = require("../config");
const { broadcast } = require("../services/websocketService");
const {
  fetchUrlMetadata,
  detectContentType,
} = require("../services/metadataService");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function parseTagsDetailed(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function listBookmarks(req, res) {
  const db = req.app.get("db");
  const {
    folder_id,
    include_children,
    search,
    favorites,
    most_used,
    tags,
    tagMode,
    sort,
    limit,
    offset,
    archived,
  } = req.query;
  try {
    // Prevent browser caching of bookmark list to ensure fresh data on filter changes
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    
    const result = bookmarkModel.listBookmarks(db, req.user.id, {
      folder_id,
      include_children,
      search,
      favorites,
      most_used,
      tags,
      tagMode,
      sort,
      limit,
      offset,
      archived,
    });
    if (result.total !== undefined) {
      result.bookmarks.forEach((b) => {
        b.tags_detailed = parseTagsDetailed(b.tags_detailed);
      });
      const safeOffset = parseInt(offset) || 0;
      if (safeOffset === 0) {
        const viewOpts = { folder_id, include_children, favorites, archived, most_used, tags, tagMode };
        const responseTags = bookmarkModel.listViewTags(db, req.user.id, viewOpts);
        const viewFolderIds = bookmarkModel.listViewFolderIds(db, req.user.id, viewOpts);
        return res.json({
          bookmarks: result.bookmarks,
          total: result.total,
          limit: parseInt(limit) || undefined,
          offset: safeOffset,
          tags: responseTags,
          viewFolderIds,
        });
      }
      return res.json({
        bookmarks: result.bookmarks,
        total: result.total,
        limit: parseInt(limit) || undefined,
        offset: safeOffset,
      });
    }
    result.bookmarks.forEach((b) => {
      b.tags_detailed = parseTagsDetailed(b.tags_detailed);
    });
    res.json(result.bookmarks);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error listing bookmarks");
  }
}

function getBookmarkCounts(req, res) {
  const db = req.app.get("db");
  try {
    const userId = req.user.id;
    const allCount = Number(
      db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_archived = 0",
        )
        .get(userId)?.count || 0,
    );
    const favoritesCount = Number(
      db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_favorite = 1 AND is_archived = 0",
        )
        .get(userId)?.count || 0,
    );
    const recentCount = Math.min(allCount, 20);
    const archivedCount = Number(
      db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_archived = 1",
        )
        .get(userId)?.count || 0,
    );
    const mostUsedCount = Number(
      db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 0 AND is_archived = 0",
        )
        .get(userId)?.count || 0,
    );
    res.json({
      all: allCount,
      favorites: favoritesCount,
      recent: recentCount,
      archived: archivedCount,
      most_used: mostUsedCount,
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching bookmark counts");
  }
}

function getBookmark(req, res) {
  const db = req.app.get("db");
  try {
    const bookmark = bookmarkModel.getBookmarkById(
      db,
      req.user.id,
      req.params.id,
    );
    if (!bookmark) return res.status(404).json({ error: "Bookmark not found" });
    bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
    res.json(bookmark);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching bookmark");
  }
}

async function fetchMetadata(req, res) {
  const { url } = req.validated;
  try {
    if (config.NODE_ENV === "production" && (await isPrivateAddress(url)))
      return res
        .status(403)
        .json({ error: "Cannot fetch metadata from private addresses" });
    const metadata = await fetchUrlMetadata(url);
    res.json(metadata);
  } catch (metaErr) {
    logger.warn(
      `Metadata fetch failed (${metaErr.message}), falling back to hostname`,
    );
    try {
      res.json({ title: new URL(url).hostname, description: "", url });
    } catch (parseErr) {
      logger.error("URL parsing also failed for metadata fallback", parseErr);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  }
}

async function createBookmark(req, res) {
  const db = req.app.get("db");
  const fetchFaviconWrapper = req.app.get("fetchFaviconWrapper");
  const raw = req.validated;
  let { title, url, description, folder_id, tags, color, og_image } = raw;
  const id = uuidv4();
  try {
    if (!title || !description || !og_image) {
      try {
        const metadata = await fetchUrlMetadata(url);
        if (metadata) {
          if (!title) title = metadata.title;
          if (!description) description = metadata.description;
          if (!og_image) og_image = metadata.og_image;
        }
      } catch (metaErr) {
        if (config.NODE_ENV !== "test")
          logger.warn(
            "Could not fetch metadata during bookmark creation",
            metaErr,
          );
      }
    }
    const maxPos = db
      .prepare("SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?")
      .get(req.user.id);
    const position = (maxPos.max || 0) + 1;
    const contentType = detectContentType(url);
    bookmarkModel.createBookmark(db, {
      id,
      user_id: req.user.id,
      folder_id,
      title: title || url,
      url,
      description,
      favicon: null,
      position,
      content_type: contentType,
      color: color || null,
      og_image: og_image || null,
    });
    if (tags && tags.trim()) {
      const tagResult = ensureTagsExist(db, req.user.id, tags, {
        returnMap: true,
      });
      const overrides = normalizeTagColorOverrides(
        raw.tag_colors || raw.tagColorOverrides,
        tagResult.tagMap,
      );
      updateBookmarkTags(db, id, tagResult.tagIds, {
        colorOverridesByTagId: overrides,
      });
    }
    fetchFaviconWrapper(url, id, req.user.id).catch((e) =>
      logger.error("Favicon fetch failed", e),
    );
    const bookmark = bookmarkModel.getBookmarkById(db, req.user.id, id);
    bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
    broadcast(req.user.id, { type: "bookmarks:changed" });
    res.json(bookmark);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error creating bookmark");
  }
}

function updateBookmark(req, res) {
  const db = req.app.get("db");
  try {
    const fields = req.validated;
    bookmarkModel.updateBookmark(db, req.user.id, req.params.id, fields);
    if (fields.tags !== undefined) {
      if (fields.tags && fields.tags.trim && fields.tags.trim()) {
        const tagResult = ensureTagsExist(db, req.user.id, fields.tags, {
          returnMap: true,
        });
        const overrides = normalizeTagColorOverrides(
          fields.tag_colors || fields.tagColorOverrides,
          tagResult.tagMap,
        );
        updateBookmarkTags(db, req.params.id, tagResult.tagIds, {
          colorOverridesByTagId: overrides,
        });
      } else {
        updateBookmarkTags(db, req.params.id, []);
      }
      broadcast(req.user.id, { type: "bookmarks:changed" });
    }
    const updated = bookmarkModel.getBookmarkById(
      db,
      req.user.id,
      req.params.id,
    );
    if (updated)
      updated.tags_detailed = parseTagsDetailed(updated.tags_detailed);
    res.json(updated);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error updating bookmark");
  }
}

function deleteBookmark(req, res) {
  const db = req.app.get("db");
  try {
    bookmarkModel.deleteBookmark(db, req.user.id, req.params.id);
    broadcast(req.user.id, { type: "bookmarks:changed" });
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error deleting bookmark");
  }
}

function bulkArchive(req, res) {
  const db = req.app.get("db");
  const { ids } = req.validated;
  try {
    const stmt = db.prepare(
      "UPDATE bookmarks SET is_archived = 1 WHERE id = ? AND user_id = ?",
    );
    db.transaction((ids, userId) => {
      for (const id of ids) stmt.run(id, userId);
    })(ids, req.user.id);
    res.json({ success: true, archived: ids.length });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error bulk archiving bookmarks");
  }
}

function bulkUnarchive(req, res) {
  const db = req.app.get("db");
  const { ids } = req.validated;
  try {
    const stmt = db.prepare(
      "UPDATE bookmarks SET is_archived = 0 WHERE id = ? AND user_id = ?",
    );
    db.transaction((ids, userId) => {
      for (const id of ids) stmt.run(id, userId);
    })(ids, req.user.id);
    res.json({ success: true, unarchived: ids.length });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error bulk unarchiving bookmarks");
  }
}

function archiveBookmark(req, res) {
  const db = req.app.get("db");
  try {
    bookmarkModel.updateBookmark(db, req.user.id, req.params.id, {
      is_archived: 1,
    });
    broadcast(req.user.id, { type: "bookmarks:changed" });
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error archiving bookmark");
  }
}

function unarchiveBookmark(req, res) {
  const db = req.app.get("db");
  try {
    bookmarkModel.updateBookmark(db, req.user.id, req.params.id, {
      is_archived: 0,
    });
    broadcast(req.user.id, { type: "bookmarks:changed" });
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error unarchiving bookmark");
  }
}

async function refreshFavicon(req, res) {
  const db = req.app.get("db");
  const fetchFaviconWrapper = req.app.get("fetchFaviconWrapper");
  const bookmark = bookmarkModel.getBookmarkById(
    db,
    req.user.id,
    req.params.id,
  );
  if (!bookmark) return res.status(404).json({ error: "Bookmark not found" });
  bookmarkModel.updateBookmark(db, req.user.id, bookmark.id, { favicon: null });
  const newFavicon = await fetchFaviconWrapper(
    bookmark.url,
    bookmark.id,
    req.user.id,
  );
  res.json({ favicon: newFavicon });
}

function trackClick(req, res) {
  const db = req.app.get("db");
  try {
    bookmarkModel.incrementClick(db, req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error incrementing click");
  }
}

async function generateThumbnail(req, res) {
  const db = req.app.get("db");
  try {
    const bookmark = bookmarkModel.getBookmarkById(
      db,
      req.user.id,
      req.params.id,
    );
    if (!bookmark) return res.status(404).json({ error: "Bookmark not found" });
    if (bookmark.thumbnail_local)
      return res.json({ thumbnail_local: bookmark.thumbnail_local });
    if (isPrivateAddress(bookmark.url))
      return res
        .status(400)
        .json({ error: "Cannot generate thumbnail for private addresses" });
    const thumbnailService = require("../services/thumbnailService");
    const result = await thumbnailService.captureScreenshot(
      bookmark.url,
      req.user.id,
    );
    if (!result.success) return res.status(500).json({ error: result.error });
    bookmarkModel.updateBookmark(db, req.user.id, bookmark.id, {
      thumbnail_local: result.path,
    });
    res.json({ thumbnail_local: result.path });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error generating thumbnail");
  }
}

module.exports = {
  listBookmarks,
  getBookmarkCounts,
  getBookmark,
  fetchMetadata,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  bulkArchive,
  bulkUnarchive,
  archiveBookmark,
  unarchiveBookmark,
  refreshFavicon,
  trackClick,
  generateThumbnail,
  parseTagsDetailed,
};
