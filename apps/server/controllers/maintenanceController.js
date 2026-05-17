const https = require("https");
const http = require("http");
const { URL } = require("url");
const { isPrivateAddress } = require("../utils/ssrfUtils");
const { logger } = require("../lib/logger");
const bookmarkModel = require("../models/bookmark");

async function checkLink(req, res) {
  const data = req.validated;
  if (!data) return res.status(400).json({ error: "Validation required" });
  const { url } = data;
  let responded = false;
  try {
    if (process.env.NODE_ENV === "production" && (await isPrivateAddress(url)))
      return res.status(403).json({ error: "Private networks not allowed" });
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === "https:" ? https : http;
    const reqUrl = protocol.request(
      url,
      { method: "HEAD", timeout: 5000 },
      (response) => {
        if (responded) return;
        responded = true;
        res.json({
          status: response.statusCode,
          ok: response.statusCode >= 200 && response.statusCode < 400,
        });
      },
    );
    reqUrl.on("error", () => {
      if (responded) return;
      responded = true;
      res.json({ status: 0, ok: false, error: "Connection failed" });
    });
    reqUrl.on("timeout", () => {
      if (responded) return;
      responded = true;
      reqUrl.destroy();
      res.json({ status: 408, ok: false, error: "Timeout" });
    });
    reqUrl.end();
  } catch (err) {
    if (responded) return;
    responded = true;
    logger.warn("Link check failed for URL", err);
    res.json({ status: 0, ok: false, error: "Invalid URL" });
  }
}

function findDuplicates(req, res) {
  const db = req.app.get("db");
  try {
    const duplicates = db
      .prepare(
        `
      SELECT url, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM bookmarks WHERE user_id = ? GROUP BY url HAVING count > 1
    `,
      )
      .all(req.user.id);
    const count = duplicates.length;
    res.json({
      duplicates,
      message:
        count === 0 ? "No duplicates found" : `Found ${count} duplicate URL(s)`,
    });
  } catch (err) {
    logger.error("Error listing duplicates", err);
    res.status(500).json({ error: "Failed to list duplicates" });
  }
}

function optimizeDatabase(req, res) {
  const db = req.app.get("db");
  try {
    db.exec("VACUUM");
    res.json({ success: true, message: "Database optimized" });
  } catch (err) {
    logger.error("Error optimizing database", err);
    res.status(500).json({ error: "Failed to optimize database" });
  }
}

async function checkLinks(req, res) {
  const db = req.app.get("db");
  try {
    const { bookmarks } = bookmarkModel.listBookmarks(db, req.user.id);
    let ok = 0;
    let broken = 0;
    for (const bookmark of bookmarks) {
      try {
        const parsedUrl = new URL(bookmark.url);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          continue;
        }
        if (
          process.env.NODE_ENV === "production" &&
          (await isPrivateAddress(bookmark.url))
        ) {
          continue;
        }
        const isOk = await new Promise((resolve) => {
          const protocol = parsedUrl.protocol === "https:" ? https : http;
          const req = protocol.request(
            bookmark.url,
            { method: "HEAD", timeout: 5000 },
            (response) => {
              resolve(response.statusCode >= 200 && response.statusCode < 400);
            },
          );
          req.on("error", () => resolve(false));
          req.on("timeout", () => {
            req.destroy();
            resolve(false);
          });
          req.end();
        });
        if (isOk) ok++;
        else broken++;
      } catch {
        broken++;
      }
    }
    res.json({
      success: true,
      message: `${ok} reachable, ${broken} broken`,
    });
  } catch (err) {
    logger.error("Error checking links", err);
    res.status(500).json({ error: "Failed to check links" });
  }
}

async function refreshFavicons(req, res) {
  const db = req.app.get("db");
  const fetchFaviconWrapper = req.app.get("fetchFaviconWrapper");
  try {
    const { bookmarks } = bookmarkModel.listBookmarks(db, req.user.id);
    const total = bookmarks.length;
    const userId = req.user.id;

    // Respond immediately — favicon fetching runs in the background
    res.json({
      success: true,
      message: `Refreshing ${total} favicon(s) in background`,
    });

    for (const bookmark of bookmarks) {
      try {
        bookmarkModel.updateBookmark(db, userId, bookmark.id, {
          favicon: null,
        });
        await fetchFaviconWrapper(bookmark.url, bookmark.id, userId);
      } catch (e) {
        logger.warn("Favicon refresh failed for bookmark", {
          id: bookmark.id,
          err: e,
        });
      }
    }
  } catch (err) {
    logger.error("Error refreshing favicons", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to refresh favicons" });
    }
  }
}

module.exports = {
  checkLink,
  checkLinks,
  findDuplicates,
  optimizeDatabase,
  refreshFavicons,
};
