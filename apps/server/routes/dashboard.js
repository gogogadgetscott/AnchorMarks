const { Router } = require("express");
const ctrl = require("../controllers/dashboardController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createDashboardRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/views", auth, ctrl.listViews);
  router.post(
    "/views",
    auth,
    csrf,
    validateBody(schemas.dashboardViewCreate),
    ctrl.createView,
  );
  router.put(
    "/views/:id",
    auth,
    csrf,
    validateBody(schemas.dashboardViewUpdate),
    ctrl.updateView,
  );
  router.delete("/views/:id", auth, csrf, ctrl.deleteView);
  router.post("/views/:id/restore", auth, csrf, ctrl.restoreView);

  return router;
};
