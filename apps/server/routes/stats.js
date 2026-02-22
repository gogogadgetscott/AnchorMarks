const statsModel = require("../models/stats");

function setupStatsRoutes(app, db, { authenticateTokenMiddleware }) {
  app.get("/api/stats", authenticateTokenMiddleware, (req, res) => {
    try {
      res.json(statsModel.getStats(db, req.user.id));
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ error: "Failed to compute stats" });
    }
  });
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
