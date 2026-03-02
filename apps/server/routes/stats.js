const { Router } = require("express");
const ctrl = require("../controllers/statsController");
const { authenticateToken } = require("../middleware/index");

module.exports = function createStatsRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);

  router.get("/", auth, ctrl.getStats);
  router.get("/advanced", auth, ctrl.getAdvancedStats);

  return router;
};
