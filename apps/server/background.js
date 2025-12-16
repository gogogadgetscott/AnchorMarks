const fs = require("fs");
const path = require("path");

function createBackgroundJobs({ db, ensureDirectories, fetchFavicon, isPrivateAddress, config }) {
  const { FAVICONS_DIR, THUMBNAILS_DIR } = ensureDirectories();

  // Favicon queue processor
  async function processFaviconQueue() {
    const bookmarks = db
      .prepare(
        `
    SELECT id, url FROM bookmarks 
    WHERE favicon_local IS NULL AND url IS NOT NULL 
    LIMIT 10
  `,
      )
      .all();

    for (const bookmark of bookmarks) {
      fetchFavicon(bookmark.url, bookmark.id).catch(console.error);
    }
  }

  if (config.ENABLE_BACKGROUND_JOBS && config.ENABLE_FAVICON_BACKGROUND_JOBS) {
    setInterval(processFaviconQueue, 30000);
    setTimeout(processFaviconQueue, 5000);
  }

  // Thumbnail caching (deduplicating in-flight fetches)
  const thumbnailFetchQueue = new Map();

  async function cacheThumbnail(url, bookmarkId) {
    try {
      const urlObj = new URL(url);
      if (!["http:", "https:"].includes(urlObj.protocol)) return null;

      if (config.NODE_ENV === "production" && (await isPrivateAddress(url))) {
        return null;
      }

      const domain = urlObj.hostname;
      const thumbnailFilename = `${bookmarkId.substring(0, 8)}_${domain.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
      const localPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
      const publicPath = `/thumbnails/${thumbnailFilename}`;

      if (fs.existsSync(localPath)) {
        db.prepare("UPDATE bookmarks SET thumbnail_local = ? WHERE id = ?").run(publicPath, bookmarkId);
        return publicPath;
      }

      if (thumbnailFetchQueue.has(bookmarkId)) {
        return thumbnailFetchQueue.get(bookmarkId);
      }

      const fetchPromise = new Promise((resolve) => {
        db.prepare("UPDATE bookmarks SET thumbnail_local = ? WHERE id = ?").run(null, bookmarkId);
        thumbnailFetchQueue.delete(bookmarkId);
        resolve(null);
      });

      thumbnailFetchQueue.set(bookmarkId, fetchPromise);
      return fetchPromise;
    } catch (err) {
      console.error("Thumbnail cache error:", err);
      return null;
    }
  }

  return { processFaviconQueue, cacheThumbnail };
}

module.exports = { createBackgroundJobs };
