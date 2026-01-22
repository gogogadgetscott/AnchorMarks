module.exports = function setupBookmarksRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware, fetchFaviconWrapper, config } = helpers;
  const bookmarkModel = require("../models/bookmark");
  const tagHelpers = require("../helpers/tag-helpers");
  const { parseTagsDetailed } = require("../helpers/tags");
  const { isPrivateAddress } = require("../helpers/utils");

  app.get("/api/bookmarks", authenticateTokenMiddleware, (req, res) => {
    try {
      const {
        folder_id,
        search,
        favorites,
        tags,
        tagMode,
        sort,
        limit,
        offset,
        include_children,
        archived,
      } = req.query;
      const opts = {
        folder_id,
        include_children: include_children === "true",
        favorites,
        search,
        tags,
        tagMode,
        sort,
        limit,
        offset,
        archived,
      };
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

  // Get bookmark counts for sidebar
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

  app.put("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      const fields = req.body;
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
            require("../helpers/tags").normalizeTagColorOverrides(
              fields.tag_colors || fields.tagColorOverrides,
              tagResult.tagMap,
            );
          tagHelpers.updateBookmarkTags(db, req.params.id, tagResult.tagIds, {
            colorOverridesByTagId: overrides,
          });
        } else {
          tagHelpers.updateBookmarkTags(db, req.params.id, []);
        }
      }

      const bookmark = bookmarkModel.getBookmarkById(
        db,
        req.user.id,
        req.params.id,
      );
      bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
      res.json(bookmark);
    } catch (err) {
      console.error("Error updating bookmark:", err);
      res.status(500).json({ error: "Failed to update bookmark" });
    }
  });

  app.post(
    "/api/bookmarks/:id/refresh-favicon",
    authenticateTokenMiddleware,
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
      const newFavicon = await fetchFaviconWrapper(bookmark.url, bookmark.id);
      res.json({ favicon: newFavicon });
    },
  );

  app.delete("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      bookmarkModel.deleteBookmark(db, req.user.id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting bookmark:", err);
      res.status(500).json({ error: "Failed to delete bookmark" });
    }
  });

  // Bulk Archive/Unarchive (MUST come before /:id/archive routes!)
  app.post(
    "/api/bookmarks/bulk/archive",
    authenticateTokenMiddleware,
    (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids))
        return res.status(400).json({ error: "IDs must be an array" });
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
        console.error("Error bulk archiving bookmarks:", err);
        res.status(500).json({ error: "Failed to bulk archive bookmarks" });
      }
    },
  );

  app.post(
    "/api/bookmarks/bulk/unarchive",
    authenticateTokenMiddleware,
    (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids))
        return res.status(400).json({ error: "IDs must be an array" });
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
        console.error("Error bulk unarchiving bookmarks:", err);
        res.status(500).json({ error: "Failed to bulk unarchive bookmarks" });
      }
    },
  );

  // Archive/Unarchive single bookmark
  app.post(
    "/api/bookmarks/:id/archive",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.updateBookmark(db, req.user.id, req.params.id, {
          is_archived: 1,
        });
        res.json({ success: true, message: "Bookmark archived" });
      } catch (err) {
        console.error("Error archiving bookmark:", err);
        res.status(500).json({ error: "Failed to archive bookmark" });
      }
    },
  );

  app.post(
    "/api/bookmarks/:id/unarchive",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.updateBookmark(db, req.user.id, req.params.id, {
          is_archived: 0,
        });
        res.json({ success: true, message: "Bookmark unarchived" });
      } catch (err) {
        console.error("Error unarchiving bookmark:", err);
        res.status(500).json({ error: "Failed to unarchive bookmark" });
      }
    },
  );

  // Generate thumbnail screenshot for a bookmark
  app.post(
    "/api/bookmarks/:id/thumbnail",
    authenticateTokenMiddleware,
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
            success: true,
            thumbnail_local: bookmark.thumbnail_local,
            cached: true,
          });
        }

        // Check for private addresses in production
        if (
          config &&
          config.NODE_ENV === "production" &&
          (await isPrivateAddress(bookmark.url))
        ) {
          return res.status(403).json({
            error: "Cannot generate thumbnail for private addresses",
          });
        }

        // Capture screenshot
        const thumbnailService = require("../helpers/thumbnail");
        const result = await thumbnailService.captureScreenshot(
          bookmark.url,
          bookmark.id,
        );

        if (result.success) {
          // Update bookmark with thumbnail path
          bookmarkModel.setThumbnailLocal(db, bookmark.id, result.path);

          return res.json({
            success: true,
            thumbnail_local: result.path,
            cached: result.cached || false,
          });
        } else {
          return res.status(500).json({
            success: false,
            error: result.error || "Failed to capture screenshot",
          });
        }
      } catch (err) {
        console.error("Error generating thumbnail:", err);
        res.status(500).json({ error: "Failed to generate thumbnail" });
      }
    },
  );

  // Other bookmark routes (create/import/export) are handled in importExport model
};
