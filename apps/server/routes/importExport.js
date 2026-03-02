const { Router } = require("express");
const ctrl = require("../controllers/importExportController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, validateQuery, schemas } = require("../validation");

module.exports = function createImportExportRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.post(
    "/import/html",
    auth,
    csrf,
    validateBody(schemas.importHtml),
    ctrl.importHtml,
  );
  router.post(
    "/import/json",
    auth,
    csrf,
    validateBody(schemas.importJson),
    ctrl.importJson,
  );
  router.get(
    "/export",
    auth,
    validateQuery(schemas.exportQuery),
    ctrl.exportData,
  );

  return router;
};
