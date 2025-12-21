const { v4: uuidv4 } = require("uuid");
const http = require("http");
const https = require("https");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../helpers/tag-helpers");
const bookmarkModel = require("../models/bookmark");
const { isPrivateAddress } = require("../helpers/utils");
const config = require("../config");

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
    if (tagId) overrides[tagId] = color.trim();
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

const { fetchUrlMetadata, detectContentType } = require("../helpers/metadata");

function setupBookmarksRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware, fetchFaviconWrapper } = helpers;

  // List bookmarks
  app.get("/api/bookmarks", authenticateTokenMiddleware, (req, res) => {
    const {
      folder_id,
      search,
      favorites,
      tags,
      sort,
      limit,
      offset,
      archived,
    } = req.query;
    const opts = {
      folder_id,
      search,
      favorites,
      tags,
      sort,
      limit,
      offset,
      archived,
    };
    try {
      const result = bookmarkModel.listBookmarks(db, req.user.id, opts);
      if (result.total !== undefined) {
        result.bookmarks.forEach((b) => {
          b.tags_detailed = parseTagsDetailed(b.tags_detailed);
        });
        return res.json({
          bookmarks: result.bookmarks,
          total: result.total,
          limit: parseInt(limit) || undefined,
          offset: parseInt(offset) || 0,
        });
      }
      result.bookmarks.forEach((b) => {
        b.tags_detailed = parseTagsDetailed(b.tags_detailed);
      });
      res.json(result.bookmarks);
    } catch (err) {
      console.error("Error listing bookmarks:", err);
      res.status(500).json({ error: "Failed to list bookmarks" });
    }
  });

  // Get bookmark counts for sidebar (must be before /:id route)
  app.get("/api/bookmarks/counts", authenticateTokenMiddleware, (req, res) => {
    try {
      const userId = req.user.id;

      // Total non-archived bookmarks
      // Ensure count is converted to number (SQLite may return string or bigint)
      const allCountResult = db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_archived = 0",
        )
        .get(userId);
      const allCount = Number(allCountResult?.count || 0);

      // Favorites (non-archived)
      const favoritesCountResult = db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_favorite = 1 AND is_archived = 0",
        )
        .get(userId);
      const favoritesCount = Number(favoritesCountResult?.count || 0);

      // Recent (top 20 non-archived)
      const recentCount = Math.min(allCount, 20);

      // Archived
      const archivedCountResult = db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_archived = 1",
        )
        .get(userId);
      const archivedCount = Number(archivedCountResult?.count || 0);

      res.json({
        all: allCount,
        favorites: favoritesCount,
        recent: recentCount,
        archived: archivedCount,
      });
    } catch (err) {
      console.error("Error fetching bookmark counts:", err);
      res.status(500).json({ error: "Failed to fetch counts" });
    }
  });

  // Get single bookmark
  app.get("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      const bookmark = bookmarkModel.getBookmarkById(
        db,
        req.user.id,
        req.params.id,
      );
      if (!bookmark)
        return res.status(404).json({ error: "Bookmark not found" });
      bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
      res.json(bookmark);
    } catch (err) {
      console.error("Error fetching bookmark:", err);
      res.status(500).json({ error: "Failed to fetch bookmark" });
    }
  });

  // Fetch metadata
  app.post(
    "/api/bookmarks/fetch-metadata",
    authenticateTokenMiddleware,
    async (req, res) => {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });
      try {
        const urlObj = new URL(url);
        if (!["http:", "https:"].includes(urlObj.protocol))
          return res.status(400).json({ error: "Invalid URL protocol" });
        if (config.NODE_ENV === "production" && (await isPrivateAddress(url)))
          return res
            .status(403)
            .json({ error: "Cannot fetch metadata from private addresses" });
        const metadata = await fetchUrlMetadata(url);
        res.json(metadata);
      } catch (err) {
        try {
          res.json({ title: new URL(url).hostname, description: "", url });
        } catch (e) {
          res.status(500).json({ error: "Failed to fetch metadata" });
        }
      }
    },
  );

  // Create bookmark
  app.post("/api/bookmarks", authenticateTokenMiddleware, async (req, res) => {
    let { title, url, description, folder_id, tags, color, og_image } =
      req.body;
    const id = uuidv4();
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
      // Fetch metadata if title or description is missing, or if we want to ensure we have og_image
      if (!title || !description || !og_image) {
        try {
          const metadata = await fetchUrlMetadata(url);
          if (metadata) {
            if (!title) title = metadata.title;
            if (!description) description = metadata.description;
            if (!og_image) og_image = metadata.og_image;
          }
        } catch (metaErr) {
          console.warn(
            "Could not fetch metadata during bookmark creation:",
            metaErr.message,
          );
        }
      }

      const maxPos = db
        .prepare("SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?")
        .get(req.user.id);
      const position = (maxPos.max || 0) + 1;
      const faviconUrl = null;
      const contentType = detectContentType(url);

      bookmarkModel.createBookmark(db, {
        id,
        user_id: req.user.id,
        folder_id,
        title: title || url,
        url,
        description,
        favicon: faviconUrl,
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
          req.body.tag_colors || req.body.tagColorOverrides,
          tagResult.tagMap,
        );
        updateBookmarkTags(db, id, tagResult.tagIds, {
          colorOverridesByTagId: overrides,
        });
      }

      fetchFaviconWrapper(url, id).catch(console.error);

      const bookmark = bookmarkModel.getBookmarkById(db, req.user.id, id);
      bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
      res.json(bookmark);
    } catch (err) {
      console.error("Error creating bookmark:", err);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  // Track click
  app.post(
    "/api/bookmarks/:id/click",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.incrementClick(db, req.params.id, req.user.id);
        res.json({ success: true });
      } catch (err) {
        console.error("Error incrementing click:", err);
        res.status(500).json({ error: "Failed to update click count" });
      }
    },
  );
}

module.exports = {
  setupBookmarksRoutes,
  fetchUrlMetadata,
  detectContentType,
  parseTagsDetailed,
  normalizeTagColorOverrides,
};
