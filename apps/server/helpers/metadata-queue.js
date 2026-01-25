/**
 * Metadata Queue - Background processing for bookmark metadata (favicons)
 *
 * This module provides a queue system for deferred metadata fetching.
 * Instead of fetching metadata immediately during import (which blocks),
 * bookmark IDs are queued and processed in the background.
 */

// Queue of bookmark IDs awaiting metadata fetch
let metadataQueue = [];

// Processing state
let isProcessing = false;
let intervalId = null;

// Dependencies (set via initialize)
let db = null;
let fetchFaviconFn = null;

// Configuration
const BATCH_SIZE = 5; // Process 5 bookmarks at a time
const PROCESS_INTERVAL_MS = 2000; // Check queue every 2 seconds
const FETCH_DELAY_MS = 500; // Delay between fetches to avoid rate limiting

/**
 * Initialize the metadata queue with dependencies
 * @param {Object} database - The database instance
 * @param {Function} fetchFavicon - The favicon fetch wrapper function
 */
function initialize(database, fetchFavicon) {
  db = database;
  fetchFaviconFn = fetchFavicon;
}

/**
 * Queue bookmark IDs for metadata fetching
 * @param {string[]} bookmarkIds - Array of bookmark IDs to process
 */
function queueMetadataFetch(bookmarkIds) {
  if (!Array.isArray(bookmarkIds)) {
    bookmarkIds = [bookmarkIds];
  }

  // Add to queue (avoid duplicates)
  const existingIds = new Set(metadataQueue);
  for (const id of bookmarkIds) {
    if (!existingIds.has(id)) {
      metadataQueue.push(id);
    }
  }

  console.log(
    `[MetadataQueue] Queued ${bookmarkIds.length} bookmarks. Queue size: ${metadataQueue.length}`,
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
    console.warn("[MetadataQueue] Not initialized. Skipping batch.");
    return;
  }

  isProcessing = true;

  // Get next batch
  const batch = metadataQueue.splice(0, BATCH_SIZE);
  console.log(
    `[MetadataQueue] Processing batch of ${batch.length}. Remaining: ${metadataQueue.length}`,
  );

  for (const bookmarkId of batch) {
    try {
      // Get bookmark URL from database
      const bookmark = db
        .prepare("SELECT id, url FROM bookmarks WHERE id = ?")
        .get(bookmarkId);

      if (bookmark && bookmark.url) {
        await fetchFaviconFn(bookmark.url, bookmark.id);
        // Small delay between fetches to be nice to external services
        await sleep(FETCH_DELAY_MS);
      }
    } catch (err) {
      console.error(
        `[MetadataQueue] Error fetching metadata for ${bookmarkId}:`,
        err.message,
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
  console.log("[MetadataQueue] Background processor started");
}

/**
 * Stop the background queue processor
 */
function stopProcessor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[MetadataQueue] Background processor stopped");
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
