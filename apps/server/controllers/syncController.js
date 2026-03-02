const syncModel = require("../models/sync");
const bookmarkModel = require("../models/bookmark");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function getSyncStatus(req, res) {
  const db = req.app.get("db");
  try {
    res.json(syncModel.getStatus(db, req.user.id));
  } catch (err) {
    return reportAndSend(res, err, logger, "Sync status error");
  }
}

function syncPush(req, res) {
  const db = req.app.get("db");
  const fetchFaviconWrapper = req.app.get("fetchFaviconWrapper");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { bookmarks, folders } = data;
    const results = syncModel.push(db, req.user.id, { bookmarks, folders });
    if (bookmarks && bookmarks.length) {
      for (const bm of bookmarks) {
        if (!bm.url) continue;
        try {
          const id = bookmarkModel.findBookmarkIdByUrl(db, req.user.id, bm.url);
          if (id)
            fetchFaviconWrapper(bm.url, id, req.user.id).catch((e) =>
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
}

function syncPull(req, res) {
  const db = req.app.get("db");
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
}

module.exports = { getSyncStatus, syncPush, syncPull };
