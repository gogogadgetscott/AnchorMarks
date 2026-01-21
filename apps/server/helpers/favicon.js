function makeFetchFaviconWrapper(fetchFavicon, db, faviconsDir, nodeEnv) {
  return (url, bookmarkId) =>
    fetchFavicon(url, bookmarkId, db, faviconsDir, nodeEnv);
}

module.exports = { makeFetchFaviconWrapper };
