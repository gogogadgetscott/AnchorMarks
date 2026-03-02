/**
 * Metadata Queue - Background processing for bookmark metadata (favicons & thumbnails)
 *
 * This module provides a queue system for deferred metadata fetching.
 * Instead of fetching metadata immediately during import (which blocks),
 * bookmark IDs are queued and processed in the background.
 */

const { logger } = require("../lib/logger");

// Queue of { bookmarkId, userId } for tenant-scoped metadata fetch (SEC-005)
let metadataQueue = [];

// Processing state
let isProcessing = false;
let intervalId = null;

// Dependencies (set via initialize)
let db = null;
let fetchFaviconFn = null;
let captureScreenshotFn = null;

// Configuration
const BATCH_SIZE = 5; // Process 5 bookmarks at a time
const PROCESS_INTERVAL_MS = 2000; // Check queue every 2 seconds
const FETCH_DELAY_MS = 500; // Delay between fetches to avoid rate limiting

/**
 * Initialize the metadata queue with dependencies
 * @param {Object} database - The database instance
 * @param {Function} fetchFavicon - The favicon fetch wrapper function
 * @param {Function} [captureScreenshot] - Optional thumbnail capture function
 */
function initialize(database, fetchFavicon, captureScreenshot = null) {
  db = database;
  fetchFaviconFn = fetchFavicon;
  captureScreenshotFn = captureScreenshot;
}

/**
 * Queue bookmark IDs for metadata fetching (tenant-scoped; SEC-005)
 * @param {string[]} bookmarkIds - Array of bookmark IDs to process
 * @param {string} userId - Owner of the bookmarks (required for tenant-scoped processing)
 */
function queueMetadataFetch(bookmarkIds, userId) {
  if (!userId) {
    logger.warn(
      "MetadataQueue: userId required for queueMetadataFetch, skipping",
    );
    return;
  }
  if (!Array.isArray(bookmarkIds)) {
    bookmarkIds = [bookmarkIds];
  }

  // Add to queue (avoid duplicates by bookmarkId+userId)
  const existing = new Set(
    metadataQueue.map((e) => `${e.bookmarkId}:${e.userId}`),
  );
  for (const bookmarkId of bookmarkIds) {
    const key = `${bookmarkId}:${userId}`;
    if (!existing.has(key)) {
      existing.add(key);
      metadataQueue.push({ bookmarkId, userId });
    }
  }

  logger.info(
    `MetadataQueue: queued ${bookmarkIds.length} bookmarks, queue size: ${metadataQueue.length}`,
  );
}

/**
 * Process the next batch of bookmarks in the queue
 */
async function processBatch() {
  if (isProcessing || metadataQueue.length === 0) {
    return;
  }

  if (!db || !fetchFaviconFn) {
    logger.warn("MetadataQueue: not initialized, skipping batch");
    return;
  }

  isProcessing = true;

  // Get next batch
  const batch = metadataQueue.splice(0, BATCH_SIZE);
  logger.info(
    `MetadataQueue: processing batch of ${batch.length}, remaining: ${metadataQueue.length}`,
  );

  const getBookmark = db.prepare(
    "SELECT id, url FROM bookmarks WHERE id = ? AND user_id = ?",
  );

  for (const { bookmarkId, userId } of batch) {
    try {
      // Tenant-scoped lookup (SEC-005): only process if bookmark belongs to this user
      const bookmark = getBookmark.get(bookmarkId, userId);

      if (bookmark && bookmark.url) {
        // Fetch favicon (pass userId for tenant-scoped UPDATE)
        await fetchFaviconFn(bookmark.url, bookmark.id, userId);

        // Capture thumbnail if enabled
        if (captureScreenshotFn) {
          try {
            const result = await captureScreenshotFn(bookmark.url, bookmark.id);
            if (result.success) {
              logger.debug(
                `MetadataQueue: thumbnail captured for ${bookmarkId}`,
              );
            } else if (
              result.error &&
              result.error !== "Thumbnail generation is disabled"
            ) {
              logger.warn(
                `MetadataQueue: thumbnail failed for ${bookmarkId}: ${result.error}`,
              );
            }
          } catch (thumbnailErr) {
            logger.error(
              `MetadataQueue: thumbnail error for ${bookmarkId}`,
              thumbnailErr,
            );
          }
        }

        // Small delay between fetches to be nice to external services
        await sleep(FETCH_DELAY_MS);
      }
    } catch (err) {
      logger.error(
        `MetadataQueue: error fetching metadata for ${bookmarkId}`,
        err,
      );
    }
  }

  isProcessing = false;
}

/**
 * Start the background queue processor
 */
function startProcessor() {
  if (intervalId) {
    return; // Already running
  }

  intervalId = setInterval(processBatch, PROCESS_INTERVAL_MS);
  logger.info("MetadataQueue: background processor started");
}

/**
 * Stop the background queue processor
 */
function stopProcessor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("MetadataQueue: background processor stopped");
  }
}

/**
 * Get current queue status
 * @returns {Object} Queue status info
 */
function getStatus() {
  return {
    queueLength: metadataQueue.length,
    isProcessing,
    isRunning: intervalId !== null,
    thumbnailsEnabled: captureScreenshotFn !== null,
  };
}

/**
 * Clear the queue (for testing)
 */
function clearQueue() {
  metadataQueue = [];
}

// Helper function
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  initialize,
  queueMetadataFetch,
  startProcessor,
  stopProcessor,
  getStatus,
  clearQueue,
  processBatch,
};
