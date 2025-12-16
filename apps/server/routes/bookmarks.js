module.exports = function setupBookmarksRoutes(app, db, helpers = {}) {
  const {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper,
    config,
  } = helpers;
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
        sort,
        limit,
        offset,
        include_children,
      } = req.query;
      const opts = {
        folder_id,
        include_children: include_children === "true",
        favorites,
        search,
        tags,
        sort,
        limit,
        offset,
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
        if (config.NODE_ENV === "production" && (await isPrivateAddress(url))) {
          return res
            .status(403)
            .json({ error: "Cannot fetch metadata from private addresses" });
        }

        const metadata = (await require("../app").fetchUrlMetadata)
          ? await require("../app").fetchUrlMetadata(url)
          : await (async () => {
              return { title: new URL(url).hostname, description: "", url };
            })();
        res.json(metadata);
      } catch (err) {
        console.error("Metadata fetch error:", err.message);
        try {
          res.json({ title: new URL(url).hostname, description: "", url });
        } catch (e) {
          res
            .status(500)
            .json({ error: "Failed to fetch metadata", message: err.message });
        }
      }
    },
  );

  app.put("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      const fields = req.body;
      const updated = bookmarkModel.updateBookmark(
        db,
        req.user.id,
        req.params.id,
        fields,
      );

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

  // Other bookmark routes (create/import/export) are handled in importExport model
};
