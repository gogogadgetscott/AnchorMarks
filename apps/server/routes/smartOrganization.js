const { Router } = require("express");
const ctrl = require("../controllers/smartOrgController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, validateQuery, schemas } = require("../validation");

module.exports = function createSmartOrganizationRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get(
    "/tags/suggest-smart",
    auth,
    validateQuery(schemas.smartOrgSuggestQuery),
    ctrl.suggestSmartTags,
  );
  router.get(
    "/smart-collections/suggest",
    auth,
    validateQuery(schemas.smartCollectionsSuggestQuery),
    ctrl.suggestCollections,
  );
  router.post(
    "/smart-collections/create",
    auth,
    csrf,
    validateBody(schemas.smartCollectionCreate),
    ctrl.createSmartCollection,
  );
  router.get(
    "/smart-collections/domain-stats",
    auth,
    validateQuery(schemas.domainQuery),
    ctrl.getDomainStats,
  );
  router.get("/smart-collections/tag-clusters", auth, ctrl.getTagClusters);
  router.get("/smart-insights", auth, ctrl.getSmartInsights);

  return router;
};
