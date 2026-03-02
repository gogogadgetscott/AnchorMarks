const { Router } = require("express");
const ctrl = require("../controllers/bookmarkViewController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createBookmarkViewsRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/", auth, ctrl.listViews);
  router.post(
    "/",
    auth,
    csrf,
    validateBody(schemas.bookmarkViewCreate),
    ctrl.createView,
  );
  router.put(
    "/:id",
    auth,
    csrf,
    validateBody(schemas.bookmarkViewUpdate),
    ctrl.updateView,
  );
  router.delete("/:id", auth, csrf, ctrl.deleteView);
  router.post("/:id/restore", auth, csrf, ctrl.restoreView);

  return router;
};
