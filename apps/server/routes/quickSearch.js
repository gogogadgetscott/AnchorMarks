const quickSearchModel = require("../models/quickSearch");
const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function setupQuickSearchRoutes(
  app,
  db,
  { authenticateTokenMiddleware, validateQuery },
) {
  app.get(
    "/api/quick-search",
    authenticateTokenMiddleware,
    ...(validateQuery ? [validateQuery(schemas.quickSearchQuery)] : []),
    (req, res) => {
      try {
        const { q, limit = 10 } = req.validatedQuery || req.query;
        if (!q) {
          const bookmarks = quickSearchModel.listRecent(db, req.user.id, limit);
          return res.json(bookmarks);
        }
        const bookmarks = quickSearchModel.search(db, req.user.id, q, limit);
        res.json(bookmarks);
      } catch (err) {
        return reportAndSend(res, err, logger, "Quick search error");
      }
    },
  );
}

module.exports = setupQuickSearchRoutes;
