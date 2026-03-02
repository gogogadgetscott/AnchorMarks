const { Router } = require("express");
const ctrl = require("../controllers/settingsController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createSettingsRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/", auth, ctrl.getSettings);
  router.put(
    "/",
    auth,
    csrf,
    validateBody(schemas.settingsUpdate),
    ctrl.updateSettings,
  );
  router.post("/reset-bookmarks", auth, csrf, ctrl.resetBookmarks);

  return router;
};
