const syncModel = require("../models/sync");
const bookmarkModel = require("../models/bookmark");

function setupSyncRoutes(
  app,
  db,
  { authenticateTokenMiddleware, fetchFaviconWrapper },
) {
  app.get("/api/sync/status", authenticateTokenMiddleware, (req, res) => {
    try {
      res.json(syncModel.getStatus(db, req.user.id));
    } catch (err) {
      console.error("Sync status error:", err);
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  app.post("/api/sync/push", authenticateTokenMiddleware, (req, res) => {
    try {
      const { bookmarks, folders } = req.body;
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
            if (id) fetchFaviconWrapper(bm.url, id).catch(console.error);
          } catch (e) {
            // ignore
          }
        }
      }

      res.json(results);
    } catch (err) {
      console.error("Sync push error:", err);
      res.status(500).json({ error: "Failed to push sync data" });
    }
  });

  app.get("/api/sync/pull", authenticateTokenMiddleware, (req, res) => {
    try {
      const data = syncModel.pull(db, req.user.id);
      data.bookmarks.forEach((b) => {
        if (b.tags_detailed && typeof b.tags_detailed === "string") {
          try {
            b.tags_detailed = JSON.parse(b.tags_detailed);
          } catch {
            /* noop */
          }
        }
      });
      res.json(data);
    } catch (err) {
      console.error("Sync pull error:", err);
      res.status(500).json({ error: "Failed to pull sync data" });
    }
  });
}

module.exports = setupSyncRoutes;
