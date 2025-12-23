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
}

module.exports = setupStatsRoutes;
