const { Router } = require("express");
const ctrl = require("../controllers/quickSearchController");
const { authenticateToken } = require("../middleware/index");
const { validateQuery, schemas } = require("../validation");

module.exports = function createQuickSearchRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);

  router.get("/", auth, validateQuery(schemas.quickSearchQuery), ctrl.search);

  return router;
};
