const statsModel = require("../models/stats");
const bookmarkModel = require("../models/bookmark");
const { monitor } = require("../helpers/performance-monitor");
const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function setupHealthRoutes(
  app,
  db,
  {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper: _fetchFaviconWrapper,
    validateQuery,
  },
) {
  // Find duplicate bookmarks (same URL)
  app.get("/api/health/duplicates", authenticateTokenMiddleware, (req, res) => {
    try {
      const dups = statsModel.findDuplicates(db, req.user.id);
      res.json({ total_duplicates: dups.length, duplicates: dups });
    } catch (err) {
      return reportAndSend(res, err, logger, "Duplicates error");
    }
  });

  // Delete duplicate bookmarks (keep the first one)
  app.post(
    "/api/health/duplicates/cleanup",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        const result = statsModel.cleanupDuplicates(db, req.user.id);
        res.json(result);
      } catch (err) {
        return reportAndSend(res, err, logger, "Cleanup duplicates error");
      }
    },
  );

  // Check for dead links (async - returns job status)
  app.get(
    "/api/health/deadlinks",
    authenticateTokenMiddleware,
    ...(validateQuery ? [validateQuery(schemas.healthDeadlinksQuery)] : []),
    async (req, res) => {
      try {
        const q = req.validatedQuery || req.query;
        const { check } = q;
        const limit = q.limit ?? 50;

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
        return reportAndSend(res, err, logger, "Deadlinks error");
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
          } catch {}
        });
        const sorted = Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([domain, count]) => ({ domain, count }));
        res.json(sorted);
      } catch (err) {
        return reportAndSend(res, err, logger, "Error computing domains");
      }
    },
  );

  // Performance stats endpoint
  app.get(
    "/api/health/performance",
    authenticateTokenMiddleware,
    ...(validateQuery ? [validateQuery(schemas.healthPerformanceQuery)] : []),
    (req, res) => {
      try {
        const q = req.validatedQuery || req.query;
        const timeWindow = q.window ?? 3600000; // 1 hour default
        const stats = monitor.getStats(timeWindow);
        res.json(stats);
      } catch (err) {
        return reportAndSend(res, err, logger, "Performance stats error");
      }
    },
  );
}

module.exports = setupHealthRoutes;
