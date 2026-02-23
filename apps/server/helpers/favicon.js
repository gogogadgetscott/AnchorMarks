function makeFetchFaviconWrapper(fetchFavicon, db, faviconsDir, nodeEnv) {
  return (url, bookmarkId, userId) =>
    fetchFavicon(url, bookmarkId, db, faviconsDir, nodeEnv, userId);
}

module.exports = { makeFetchFaviconWrapper };
