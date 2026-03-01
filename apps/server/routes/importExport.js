const importExportModel = require("../models/importExport");
const { parseBookmarkHtml } = require("../helpers/import");
const { parseTagsDetailed } = require("../helpers/tags");
const { generateBookmarkHtml } = require("../helpers/html");
const { queueMetadataFetch } = require("../helpers/metadata-queue");
const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function setupImportExportRoutes(
  app,
  db,
  {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody,
    validateQuery,
  },
) {
  /**
   * @swagger
   * /import/html:
   *   post:
   *     summary: Import bookmarks from HTML file content
   *     tags: [Import/Export]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [html]
   *             properties:
   *               html:
   *                 type: string
   *     responses:
   *       200:
   *         description: Import results
   */
  app.post(
    "/api/import/html",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.importHtml)] : []),
    async (req, res) => {
      try {
        const data = req.validated;
        if (!data)
          return res.status(400).json({ error: "Validation required" });
        const { html } = data;
        const { bookmarks, folders } = await parseBookmarkHtml(html);
        const result = importExportModel.importJson(db, req.user.id, {
          bookmarks,
          folders,
        });

        // Queue imported bookmarks for background metadata processing (favicons + thumbnails)
        const bookmarkIds = result.imported.map((b) => b.id);
        if (bookmarkIds.length > 0) {
          queueMetadataFetch(bookmarkIds, req.user.id);
        }

        res.json({
          imported: result.imported.length,
          skipped: result.skipped || 0,
          import_log: result.importLog || [],
          bookmarks: result.imported,
        });
      } catch (err) {
        return reportAndSend(
          res,
          err,
          logger,
          "Error importing HTML bookmarks",
        );
      }
    },
  );

  /**
   * @swagger
   * /import/json:
   *   post:
   *     summary: Import bookmarks from JSON format
   *     tags: [Import/Export]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               bookmarks:
   *                 type: array
   *                 items:
   *                   type: object
   *               folders:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Import results
   */
  app.post(
    "/api/import/json",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.importJson)] : []),
    (req, res) => {
      try {
        const data = req.validated;
        if (!data)
          return res.status(400).json({ error: "Validation required" });
        const { bookmarks = [], folders = [] } = data;
        const result = importExportModel.importJson(db, req.user.id, {
          bookmarks,
          folders,
        });

        // Queue imported bookmarks for background metadata processing (favicons + thumbnails)
        const bookmarkIds = result.imported.map((b) => b.id);
        if (bookmarkIds.length > 0) {
          queueMetadataFetch(bookmarkIds, req.user.id);
        }

        res.json({
          imported: result.imported.length,
          skipped: result.skipped || 0,
          import_log: result.importLog || [],
          bookmarks: result.imported,
        });
      } catch (err) {
        return reportAndSend(
          res,
          err,
          logger,
          "Error importing JSON bookmarks",
        );
      }
    },
  );

  /**
   * @swagger
   * /export:
   *   get:
   *     summary: Export bookmarks and folders
   *     tags: [Import/Export]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: format
   *         description: Export format (json or html)
   *         schema:
   *           type: string
   *           enum: [json, html]
   *     responses:
   *       200:
   *         description: Export data
   */
  app.get(
    "/api/export",
    authenticateTokenMiddleware,
    ...(validateQuery ? [validateQuery(schemas.exportQuery)] : []),
    (req, res) => {
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
    },
  );
}

module.exports = setupImportExportRoutes;
