const statsModel = require("../models/stats");

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
      console.error("Stats error:", err);
      res.status(500).json({ error: "Failed to compute stats" });
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
      console.error("Advanced stats error:", err);
      res.status(500).json({ error: "Failed to compute advanced stats" });
    }
  });
}

module.exports = setupStatsRoutes;
