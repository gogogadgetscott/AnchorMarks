const path = require("path");
const fs = require("fs");
const { makeFetchFaviconWrapper } = require("../helpers/favicon");

function createBackgroundJobs({
  db,
  ensureDirectories,
  fetchFavicon,
  isPrivateAddress,
  config,
}) {
  // Placeholder background job setup — moved from top-level background.js
  // Keep job startup idempotent for tests; real implementation runs on server start.
  function start() {
    // Example: ensure favicons dir exists
    ensureDirectories();
  }

  return { start };
}

module.exports = { createBackgroundJobs };
