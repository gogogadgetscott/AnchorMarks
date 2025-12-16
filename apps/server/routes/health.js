const statsModel = require("../models/stats");
const bookmarkModel = require("../models/bookmark");

function setupHealthRoutes(
  app,
  db,
  { authenticateTokenMiddleware, fetchFaviconWrapper },
) {
  // Find duplicate bookmarks (same URL)
  app.get("/api/health/duplicates", authenticateTokenMiddleware, (req, res) => {
    try {
      const dups = statsModel.findDuplicates(db, req.user.id);
      res.json({ total_duplicates: dups.length, duplicates: dups });
    } catch (err) {
      console.error("Duplicates error:", err);
      res.status(500).json({ error: "Failed to list duplicates" });
    }
  });

  // Delete duplicate bookmarks (keep the first one)
  app.post(
    "/api/health/duplicates/cleanup",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        const result = statsModel.cleanupDuplicates(db, req.user.id);
        res.json(result);
      } catch (err) {
        console.error("Cleanup duplicates error:", err);
        res.status(500).json({ error: "Failed to cleanup duplicates" });
      }
    },
  );

  // Check for dead links (async - returns job status)
  app.get(
    "/api/health/deadlinks",
    authenticateTokenMiddleware,
    async (req, res) => {
      try {
        const { check } = req.query;
        const limit = parseInt(req.query.limit) || 50;

        if (check !== "true") {
          const info = statsModel.getDeadlinksInfo(db, req.user.id, limit);
          return res.json({
            dead_links: info.dead_links,
            unchecked: info.unchecked,
            bookmarks: info.bookmarks,
          });
        }

        // Run checks
        const result = await statsModel.runDeadlinkChecks(
          db,
          req.user.id,
          limit,
        );
        res.json(result);
      } catch (err) {
        console.error("Deadlinks error:", err);
        res.status(500).json({ error: "Failed to run deadlink checks" });
      }
    },
  );

  // Get bookmarks by domain
  app.get(
    "/api/bookmarks/by-domain",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        const urls = bookmarkModel.listUrls(db, req.user.id);
        const domainCounts = {};
        urls.forEach((u) => {
          try {
            const domain = new URL(u).hostname.replace("www.", "");
            domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          } catch (e) {}
        });
        const sorted = Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([domain, count]) => ({ domain, count }));
        res.json(sorted);
      } catch (err) {
        console.error("Error computing domains:", err);
        res.status(500).json({ error: "Failed to compute domains" });
      }
    },
  );
}

module.exports = setupHealthRoutes;
