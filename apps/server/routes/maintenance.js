const express = require("express");
const router = express.Router();
const https = require("https");
const http = require("http");
const { URL } = require("url");
const { isPrivateAddress } = require("../helpers/utils");
const { schemas } = require("../validation");
const { logger } = require("../lib/logger");

module.exports = function (
  db,
  authenticateToken,
  validateCsrfToken = (_, __, next) => next(),
  validationHelpers = {},
) {
  const { validateBody } = validationHelpers;
  // Check a single URL status
  /**
   * @swagger
   * /maintenance/check-link:
   *   post:
   *     summary: Check if a URL is alive
   *     tags: [Maintenance]
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
   *     responses:
   *       200:
   *         description: Link status
   */
  router.post(
    "/check-link",
    authenticateToken,
    validateCsrfToken,
    ...(validateBody ? [validateBody(schemas.checkLink)] : []),
    async (req, res) => {
      const data = req.validated;
      if (!data) return res.status(400).json({ error: "Validation required" });
      const { url } = data;

      let responded = false;

      try {
        if (
          process.env.NODE_ENV === "production" &&
          (await isPrivateAddress(url))
        ) {
          return res
            .status(403)
            .json({ error: "Private networks not allowed" });
        }
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === "https:" ? https : http;

        const reqUrl = protocol.request(
          url,
          { method: "HEAD", timeout: 5000 },
          (response) => {
            if (responded) return;
            responded = true;
            res.json({
              status: response.statusCode,
              ok: response.statusCode >= 200 && response.statusCode < 400,
            });
          },
        );

        reqUrl.on("error", () => {
          if (responded) return;
          responded = true;
          res.json({ status: 0, ok: false, error: "Connection failed" });
        });

        reqUrl.on("timeout", () => {
          if (responded) return;
          responded = true;
          reqUrl.destroy();
          res.json({ status: 408, ok: false, error: "Timeout" });
        });

        reqUrl.end();
      } catch (err) {
        if (responded) return;
        responded = true;
        logger.warn("Link check failed for URL", err);
        res.json({ status: 0, ok: false, error: "Invalid URL" });
      }
    },
  );

  // Find duplicates
  /**
   * @swagger
   * /maintenance/duplicates:
   *   get:
   *     summary: Find duplicate bookmarks
   *     tags: [Maintenance]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: A list of duplicate groups
   */
  router.get("/duplicates", authenticateToken, (req, res) => {
    try {
      const duplicates = db
        .prepare(
          `
                SELECT url, COUNT(*) as count, GROUP_CONCAT(id) as ids
                FROM bookmarks
                WHERE user_id = ?
                GROUP BY url
                HAVING count > 1
            `,
        )
        .all(req.user.id);

      res.json(duplicates);
    } catch (err) {
      logger.error("Error listing duplicates", err);
      res.status(500).json({ error: "Failed to list duplicates" });
    }
  });

  // Vacuum database
  /**
   * @swagger
   * /maintenance/optimize:
   *   post:
   *     summary: Optimize the database (VACUUM)
   *     tags: [Maintenance]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Database optimized
   */
  router.post(
    "/optimize",
    authenticateToken,
    validateCsrfToken,
    (_req, res) => {
      try {
        db.exec("VACUUM");
        res.json({ success: true, message: "Database optimized" });
      } catch (err) {
        logger.error("Error optimizing database", err);
        res.status(500).json({ error: "Failed to optimize database" });
      }
    },
  );

  return router;
};
