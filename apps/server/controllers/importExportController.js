const importExportModel = require("../models/importExport");
const { parseBookmarkHtml } = require("../services/importService");
const { parseTagsDetailed } = require("../utils/tagUtils");
const { generateBookmarkHtml } = require("../utils/htmlUtils");
const { queueMetadataFetch } = require("../services/metadataQueueService");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

async function importHtml(req, res) {
  const db = req.app.get("db");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { html } = data;
    const { bookmarks, folders } = await parseBookmarkHtml(html);
    const result = importExportModel.importJson(db, req.user.id, {
      bookmarks,
      folders,
    });
    const bookmarkIds = result.imported.map((b) => b.id);
    if (bookmarkIds.length > 0) queueMetadataFetch(bookmarkIds, req.user.id);
    res.json({
      imported: result.imported.length,
      skipped: result.skipped || 0,
      import_log: result.importLog || [],
      bookmarks: result.imported,
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error importing HTML bookmarks");
  }
}

function importJson(req, res) {
  const db = req.app.get("db");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { bookmarks = [], folders = [] } = data;
    const result = importExportModel.importJson(db, req.user.id, {
      bookmarks,
      folders,
    });
    const bookmarkIds = result.imported.map((b) => b.id);
    if (bookmarkIds.length > 0) queueMetadataFetch(bookmarkIds, req.user.id);
    res.json({
      imported: result.imported.length,
      skipped: result.skipped || 0,
      import_log: result.importLog || [],
      bookmarks: result.imported,
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error importing JSON bookmarks");
  }
}

function exportData(req, res) {
  const db = req.app.get("db");
  try {
    const { format } = req.validatedQuery || req.query;
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
    return reportAndSend(res, err, logger, "Export error");
  }
}

module.exports = { importHtml, importJson, exportData };
