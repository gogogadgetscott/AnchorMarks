const { Router } = require("express");
const ctrl = require("../controllers/maintenanceController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createMaintenanceRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.post(
    "/check-link",
    auth,
    csrf,
    validateBody(schemas.checkLink),
    ctrl.checkLink,
  );
  router.get("/duplicates", auth, ctrl.findDuplicates);
  router.post("/duplicates", auth, csrf, ctrl.findDuplicates);
  router.post("/optimize", auth, csrf, ctrl.optimizeDatabase);
  router.post("/refresh-favicons", auth, csrf, ctrl.refreshFavicons);
  router.post("/check-links", auth, csrf, ctrl.checkLinks);

  return router;
};
