const { Router } = require("express");
const ctrl = require("../controllers/healthController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateQuery, validateBody, schemas } = require("../validation");

module.exports = function createHealthRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/duplicates", auth, ctrl.findDuplicates);
  router.post("/duplicates/cleanup", auth, csrf, ctrl.cleanupDuplicates);
  router.post(
    "/duplicates/resolve",
    auth,
    csrf,
    validateBody(schemas.duplicateResolve),
    ctrl.resolveDuplicates,
  );
  router.get(
    "/deadlinks",
    auth,
    validateQuery(schemas.healthDeadlinksQuery),
    ctrl.checkDeadlinks,
  );
  router.post(
    "/deadlinks",
    auth,
    csrf,
    validateQuery(schemas.healthDeadlinksQuery),
    ctrl.checkDeadlinks,
  );
  router.get(
    "/performance",
    auth,
    validateQuery(schemas.healthPerformanceQuery),
    ctrl.getPerformanceStats,
  );

  return router;
};
