const importExportModel = require("../models/importExport");
const { parseBookmarkHtml } = require("../helpers/import");
const { parseTagsDetailed } = require("../helpers/tags");
const { generateBookmarkHtml } = require("../helpers/html");
const { queueMetadataFetch } = require("../helpers/metadata-queue");

function setupImportExportRoutes(app, db, { authenticateTokenMiddleware }) {
  app.post(
    "/api/import/html",
    authenticateTokenMiddleware,
    async (req, res) => {
      try {
        const { html } = req.body;
        const { bookmarks, folders } = await parseBookmarkHtml(html);
        const result = importExportModel.importJson(db, req.user.id, {
          bookmarks,
          folders,
        });

        // Queue imported bookmarks for background metadata processing (favicons + thumbnails)
        const bookmarkIds = result.imported.map((b) => b.id);
        if (bookmarkIds.length > 0) {
          queueMetadataFetch(bookmarkIds);
        }

        res.json({
          imported: result.imported.length,
          skipped: result.skipped || 0,
          import_log: result.importLog || [],
          bookmarks: result.imported,
        });
      } catch (err) {
        console.error(err);
        res.status(400).json({ error: "Failed to parse bookmarks" });
      }
    },
  );

  app.post("/api/import/json", authenticateTokenMiddleware, (req, res) => {
    try {
      const { bookmarks = [], folders = [] } = req.body;
      const result = importExportModel.importJson(db, req.user.id, {
        bookmarks,
        folders,
      });

      // Queue imported bookmarks for background metadata processing (favicons + thumbnails)
      const bookmarkIds = result.imported.map((b) => b.id);
      if (bookmarkIds.length > 0) {
        queueMetadataFetch(bookmarkIds);
      }

      res.json({
        imported: result.imported.length,
        skipped: result.skipped || 0,
        import_log: result.importLog || [],
        bookmarks: result.imported,
      });
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Failed to import bookmarks" });
    }
  });

  app.get("/api/export", authenticateTokenMiddleware, (req, res) => {
    try {
      const { format } = req.query;
      const data = importExportModel.exportData(db, req.user.id);
      data.bookmarks.forEach((b) => {
        b.tags_detailed = parseTagsDetailed(b.tags_detailed);
      });
      if (format === "html") {
        res.setHeader("Content-Type", "text/html");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=anchormarks-bookmarks.html",
        );
        res.send(generateBookmarkHtml(data.bookmarks, data.folders));
      } else {
        res.json({ bookmarks: data.bookmarks, folders: data.folders });
      }
    } catch (err) {
      console.error("Export error:", err);
      res.status(500).json({ error: "Failed to export data" });
    }
  });
}

module.exports = setupImportExportRoutes;
