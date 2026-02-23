const statsModel = require("../models/stats");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function setupStatsRoutes(app, db, { authenticateTokenMiddleware }) {
  /**
   * @swagger
   * /stats:
   *   get:
   *     summary: Get basic user statistics
   *     tags: [Stats]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Basic statistics
   */
  app.get("/api/stats", authenticateTokenMiddleware, (req, res) => {
    try {
      res.json(statsModel.getStats(db, req.user.id));
    } catch (err) {
      return reportAndSend(res, err, logger, "Stats error");
    }
  });

  /**
   * @swagger
   * /stats/advanced:
   *   get:
   *     summary: Get advanced user analytics
   *     tags: [Stats]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Advanced analytics including growth and engagement
   */
  app.get("/api/stats/advanced", authenticateTokenMiddleware, (req, res) => {
    try {
      const stats = statsModel.getStats(db, req.user.id);
      const engagement = statsModel.getEngagement(db, req.user.id);
      res.json({ ...stats, ...engagement });
    } catch (err) {
      return reportAndSend(res, err, logger, "Advanced stats error");
    }
  });
}

module.exports = setupStatsRoutes;
