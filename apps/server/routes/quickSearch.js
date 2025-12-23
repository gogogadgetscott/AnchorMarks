const quickSearchModel = require("../models/quickSearch");

function setupQuickSearchRoutes(app, db, { authenticateTokenMiddleware }) {
  app.get("/api/quick-search", authenticateTokenMiddleware, (req, res) => {
    try {
      const { q, limit = 10 } = req.query;
      if (!q) {
        const bookmarks = quickSearchModel.listRecent(db, req.user.id, limit);
        return res.json(bookmarks);
      }
      const bookmarks = quickSearchModel.search(db, req.user.id, q, limit);
      res.json(bookmarks);
    } catch (err) {
      console.error("Quick search error:", err);
      res.status(500).json({ error: "Failed to search" });
    }
  });
}

module.exports = setupQuickSearchRoutes;
