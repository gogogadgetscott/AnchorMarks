const { v4: uuidv4 } = require("uuid");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../services/tagService");
const { validateBody, schemas } = require("../validation");
const bookmarkModel = require("../models/bookmark");
const { isPrivateAddress } = require("../utils/ssrfUtils");
const config = require("../config");
const { broadcast } = require("../services/websocketService");
const tagHelpers = require("../services/tagService");
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

const {
  fetchUrlMetadata,
  detectContentType,
} = require("../services/metadataService");

function setupBookmarksRoutes(app, db, helpers = {}) {
  const {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper,
  } = helpers;

  /**
   * @swagger
   * /bookmarks:
   *   get:
   *     summary: List bookmarks
   *     tags: [Bookmarks]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: folder_id
   *         schema:
   *           type: string
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: favorites
   *         schema:
   *           type: boolean
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *       - in: query
   *         name: tagMode
   *         schema:
   *           type: string
   *           enum: [AND, OR]
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *       - in: query
   *         name: archived
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: A list of bookmarks
   */
  // List bookmarks
  app.get("/api/bookmarks", authenticateTokenMiddleware, (req, res) => {
    const {
      folder_id,
      search,
      favorites,
      tags,
      tagMode,
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
      tagMode,
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
      return reportAndSend(res, err, logger, "Error listing bookmarks");
    }
  });

  /**
   * @swagger
   * /bookmarks/counts:
   *   get:
   *     summary: Get bookmark counts for sidebar
   *     tags: [Bookmarks]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Counts for different bookmark views
   */
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

      // Most used (bookmarks clicked at least once, non-archived)
      const mostUsedCountResult = db
        .prepare(
          "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 0 AND is_archived = 0",
        )
        .get(userId);
      const mostUsedCount = Number(mostUsedCountResult?.count || 0);

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
  });

  /**
   * @swagger
   * /bookmarks/{id}:
   *   get:
   *     summary: Get a single bookmark
   *     tags: [Bookmarks]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Bookmark details
   *       404:
   *         description: Bookmark not found
   */
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
      return reportAndSend(res, err, logger, "Error fetching bookmark");
    }
  });

  /**
   * @swagger
   * /bookmarks/fetch-metadata:
   *   post:
   *     summary: Fetch metadata for a URL
   *     tags: [Bookmarks]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               url:
   *                 type: string
   *     responses:
   *       200:
   *         description: URL metadata
   */
  // Fetch metadata
  app.post(
    "/api/bookmarks/fetch-metadata",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody(schemas.fetchMetadata),
    async (req, res) => {
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
          logger.error(
            "URL parsing also failed for metadata fallback",
            parseErr,
          );
          res.status(500).json({ error: "Failed to fetch metadata" });
        }
      }
    },
  );

  /**
   * @swagger
   * /bookmarks:
   *   post:
   *     summary: Create a new bookmark
   *     tags: [Bookmarks]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [url]
   *             properties:
   *               url:
   *                 type: string
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               folder_id:
   *                 type: string
   *               tags:
   *                 type: string
   *               color:
   *                 type: string
   *               og_image:
   *                 type: string
   *     responses:
   *       200:
   *         description: Bookmark created successfully
   */
  // Create bookmark
  app.post(
    "/api/bookmarks",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody(schemas.bookmarkCreate),
    async (req, res) => {
      const raw = req.validated;
      let { title, url, description, folder_id, tags, color, og_image } = raw;
      const id = uuidv4();
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
            if (config.NODE_ENV !== "test") {
              logger.warn(
                "Could not fetch metadata during bookmark creation",
                metaErr,
              );
            }
          }
        }

        const maxPos = db
          .prepare(
            "SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?",
          )
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
    },
  );

  /**
   * @swagger
   * /bookmarks/{id}/click:
   *   post:
   *     summary: Track a click on a bookmark
   *     tags: [Bookmarks]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Click tracked successfully
   */
  // Update bookmark
  app.put(
    "/api/bookmarks/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody(schemas.bookmarkUpdate),
    (req, res) => {
      try {
        const fields = req.validated;
        bookmarkModel.updateBookmark(db, req.user.id, req.params.id, fields);

        if (fields.tags !== undefined) {
          if (fields.tags && fields.tags.trim && fields.tags.trim()) {
            const tagResult = tagHelpers.ensureTagsExist(
              db,
              req.user.id,
              fields.tags,
              { returnMap: true },
            );
            const overrides =
              require("../utils/tagUtils").normalizeTagColorOverrides(
                fields.tag_colors || fields.tagColorOverrides,
                tagResult.tagMap,
              );
            tagHelpers.updateBookmarkTags(db, req.params.id, tagResult.tagIds, {
              colorOverridesByTagId: overrides,
            });
          } else {
            tagHelpers.updateBookmarkTags(db, req.params.id, []);
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
    },
  );

  // Delete bookmark
  app.delete(
    "/api/bookmarks/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.deleteBookmark(db, req.user.id, req.params.id);
        broadcast(req.user.id, { type: "bookmarks:changed" });
        res.json({ success: true });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error deleting bookmark");
      }
    },
  );

  // Bulk Archive
  app.post(
    "/api/bookmarks/bulk/archive",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody(schemas.bulkIds),
    (req, res) => {
      const { ids } = req.validated;
      try {
        const stmt = db.prepare(
          "UPDATE bookmarks SET is_archived = 1 WHERE id = ? AND user_id = ?",
        );
        const transaction = db.transaction((ids, userId) => {
          for (const id of ids) {
            stmt.run(id, userId);
          }
        });
        transaction(ids, req.user.id);
        res.json({ success: true, archived: ids.length });
      } catch (err) {
        return reportAndSend(
          res,
          err,
          logger,
          "Error bulk archiving bookmarks",
        );
      }
    },
  );

  // Bulk Unarchive
  app.post(
    "/api/bookmarks/bulk/unarchive",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody(schemas.bulkIds),
    (req, res) => {
      const { ids } = req.validated;
      try {
        const stmt = db.prepare(
          "UPDATE bookmarks SET is_archived = 0 WHERE id = ? AND user_id = ?",
        );
        const transaction = db.transaction((ids, userId) => {
          for (const id of ids) stmt.run(id, userId);
        });
        transaction(ids, req.user.id);
        res.json({ success: true, unarchived: ids.length });
      } catch (err) {
        return reportAndSend(
          res,
          err,
          logger,
          "Error bulk unarchiving bookmarks",
        );
      }
    },
  );

  // Archive single bookmark
  app.post(
    "/api/bookmarks/:id/archive",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.updateBookmark(db, req.user.id, req.params.id, {
          is_archived: 1,
        });
        broadcast(req.user.id, { type: "bookmarks:changed" });
        res.json({ success: true });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error archiving bookmark");
      }
    },
  );

  // Unarchive single bookmark
  app.post(
    "/api/bookmarks/:id/unarchive",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.updateBookmark(db, req.user.id, req.params.id, {
          is_archived: 0,
        });
        broadcast(req.user.id, { type: "bookmarks:changed" });
        res.json({ success: true });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error unarchiving bookmark");
      }
    },
  );

  // Refresh favicon
  app.post(
    "/api/bookmarks/:id/refresh-favicon",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    async (req, res) => {
      const bookmark = bookmarkModel.getBookmarkById(
        db,
        req.user.id,
        req.params.id,
      );
      if (!bookmark)
        return res.status(404).json({ error: "Bookmark not found" });

      bookmarkModel.updateBookmark(db, req.user.id, bookmark.id, {
        favicon: null,
      });
      const newFavicon = await fetchFaviconWrapper(
        bookmark.url,
        bookmark.id,
        req.user.id,
      );
      res.json({ favicon: newFavicon });
    },
  );

  // Track click
  app.post(
    "/api/bookmarks/:id/click",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.incrementClick(db, req.params.id, req.user.id);
        res.json({ success: true });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error incrementing click");
      }
    },
  );

  // Generate thumbnail screenshot for a bookmark
  app.post(
    "/api/bookmarks/:id/thumbnail",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    async (req, res) => {
      try {
        const bookmark = bookmarkModel.getBookmarkById(
          db,
          req.user.id,
          req.params.id,
        );
        if (!bookmark) {
          return res.status(404).json({ error: "Bookmark not found" });
        }

        // Check if thumbnail already exists
        if (bookmark.thumbnail_local) {
          return res.json({
            thumbnail_local: bookmark.thumbnail_local,
          });
        }

        // Validate URL is not a private address
        if (isPrivateAddress(bookmark.url)) {
          return res.status(400).json({
            error: "Cannot generate thumbnail for private addresses",
          });
        }

        const thumbnailService = require("../services/thumbnailService");
        const result = await thumbnailService.captureScreenshot(
          bookmark.url,
          req.user.id,
        );

        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }

        // Update bookmark with thumbnail path
        bookmarkModel.updateBookmark(db, req.user.id, bookmark.id, {
          thumbnail_local: result.path,
        });

        res.json({
          thumbnail_local: result.path,
        });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error generating thumbnail");
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
