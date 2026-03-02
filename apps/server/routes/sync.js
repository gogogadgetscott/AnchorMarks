const { Router } = require("express");
const ctrl = require("../controllers/syncController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createSyncRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/status", auth, ctrl.getSyncStatus);
  router.post(
    "/push",
    auth,
    csrf,
    validateBody(schemas.syncPush),
    ctrl.syncPush,
  );
  router.get("/pull", auth, ctrl.syncPull);

  return router;
};
