const { Router } = require("express");
const ctrl = require("../controllers/bookmarkController");
const healthCtrl = require("../controllers/healthController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createBookmarksRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/", auth, ctrl.listBookmarks);
  router.get("/counts", auth, ctrl.getBookmarkCounts);
  router.get("/by-domain", auth, healthCtrl.getBookmarksByDomain);
  router.post(
    "/fetch-metadata",
    auth,
    csrf,
    validateBody(schemas.fetchMetadata),
    ctrl.fetchMetadata,
  );
  router.post(
    "/",
    auth,
    csrf,
    validateBody(schemas.bookmarkCreate),
    ctrl.createBookmark,
  );
  router.post(
    "/bulk/archive",
    auth,
    csrf,
    validateBody(schemas.bulkIds),
    ctrl.bulkArchive,
  );
  router.post(
    "/bulk/unarchive",
    auth,
    csrf,
    validateBody(schemas.bulkIds),
    ctrl.bulkUnarchive,
  );
  router.get("/:id", auth, ctrl.getBookmark);
  router.put(
    "/:id",
    auth,
    csrf,
    validateBody(schemas.bookmarkUpdate),
    ctrl.updateBookmark,
  );
  router.delete("/:id", auth, csrf, ctrl.deleteBookmark);
  router.post("/:id/archive", auth, csrf, ctrl.archiveBookmark);
  router.post("/:id/unarchive", auth, csrf, ctrl.unarchiveBookmark);
  router.post("/:id/refresh-favicon", auth, csrf, ctrl.refreshFavicon);
  router.post("/:id/click", auth, csrf, ctrl.trackClick);
  router.post("/:id/thumbnail", auth, csrf, ctrl.generateThumbnail);

  return router;
};
