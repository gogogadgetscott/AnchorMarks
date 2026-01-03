function createBackgroundJobs({ ensureDirectories }) {
  // Placeholder background job setup — moved from top-level background.js
  // Keep job startup idempotent for tests; real implementation runs on server start.
  function start() {
    // Example: ensure favicons dir exists
    ensureDirectories();
  }

  return { start };
}

module.exports = { createBackgroundJobs };
