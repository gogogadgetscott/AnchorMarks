const importExportModel = require("../models/importExport");
const { parseBookmarkHtml } = require("../helpers/import");
const { parseTagsDetailed } = require("../helpers/tags");
const { generateBookmarkHtml } = require("../helpers/html");

function setupImportExportRoutes(
  app,
  db,
  { authenticateTokenMiddleware, fetchFaviconWrapper },
) {
  app.post(
    "/api/import/html",
    authenticateTokenMiddleware,
    async (req, res) => {
      try {
        const { html } = req.body;
        const { bookmarks, folders } = await parseBookmarkHtml(
          db,
          html,
          req.user.id,
          fetchFaviconWrapper,
        );
        const result = importExportModel.importJson(db, req.user.id, {
          bookmarks,
          folders,
        });
        result.imported.forEach((b) =>
          fetchFaviconWrapper(b.url, b.id).catch(console.error),
        );
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
      result.imported.forEach((b) =>
        fetchFaviconWrapper(b.url, b.id).catch(console.error),
      );
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
