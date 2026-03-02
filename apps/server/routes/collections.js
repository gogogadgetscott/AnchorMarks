const { Router } = require("express");
const ctrl = require("../controllers/collectionController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createCollectionsRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/", auth, ctrl.listCollections);
  router.get("/:id", auth, ctrl.getCollection);
  router.post(
    "/",
    auth,
    csrf,
    validateBody(schemas.collectionCreate),
    ctrl.createCollection,
  );
  router.put(
    "/:id",
    auth,
    csrf,
    validateBody(schemas.collectionUpdate),
    ctrl.updateCollection,
  );
  router.delete("/:id", auth, csrf, ctrl.deleteCollection);
  router.get("/:id/bookmarks", auth, ctrl.getCollectionBookmarks);

  return router;
};
