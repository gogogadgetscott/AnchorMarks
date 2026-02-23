const syncModel = require("../models/sync");
const bookmarkModel = require("../models/bookmark");
const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function setupSyncRoutes(
  app,
  db,
  {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    fetchFaviconWrapper,
    validateBody,
  },
) {
  app.get("/api/sync/status", authenticateTokenMiddleware, (req, res) => {
    try {
      res.json(syncModel.getStatus(db, req.user.id));
    } catch (err) {
      return reportAndSend(res, err, logger, "Sync status error");
    }
  });

  app.post(
    "/api/sync/push",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.syncPush)] : []),
    (req, res) => {
      try {
        const { bookmarks, folders } = req.validated || req.body;
        const results = syncModel.push(db, req.user.id, { bookmarks, folders });

        if (bookmarks && bookmarks.length) {
          for (const bm of bookmarks) {
            if (!bm.url) continue;
            try {
              const id = bookmarkModel.findBookmarkIdByUrl(
                db,
                req.user.id,
                bm.url,
              );
              if (id)
                fetchFaviconWrapper(bm.url, id).catch((e) =>
                  logger.warn("Favicon fetch failed during sync", e),
                );
            } catch (innerErr) {
              logger.debug("Sync favicon lookup failed", innerErr);
            }
          }
        }

        res.json(results);
      } catch (err) {
        return reportAndSend(res, err, logger, "Sync push error");
      }
    },
  );

  app.get("/api/sync/pull", authenticateTokenMiddleware, (req, res) => {
    try {
      const data = syncModel.pull(db, req.user.id);
      data.bookmarks.forEach((b) => {
        if (b.tags_detailed && typeof b.tags_detailed === "string") {
          try {
            b.tags_detailed = JSON.parse(b.tags_detailed);
          } catch (parseErr) {
            logger.debug("Sync pull tags_detailed parse failed", parseErr);
          }
        }
      });
      res.json(data);
    } catch (err) {
      return reportAndSend(res, err, logger, "Sync pull error");
    }
  });
}

module.exports = setupSyncRoutes;
