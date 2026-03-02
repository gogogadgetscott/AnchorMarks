const { Router } = require("express");
const ctrl = require("../controllers/authController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createAuthRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/csrf", ctrl.getCsrfToken);
  router.post("/register", validateBody(schemas.authRegister), ctrl.register);
  router.post("/login", validateBody(schemas.authLogin), ctrl.login);
  router.get("/me", auth, ctrl.getMe);
  router.post("/refresh", ctrl.refresh);
  router.post("/logout", auth, csrf, ctrl.logout);
  router.delete("/me", auth, csrf, ctrl.deleteAccount);
  router.post("/regenerate-key", auth, csrf, ctrl.regenerateApiKey);
  router.put(
    "/profile",
    auth,
    csrf,
    validateBody(schemas.authProfile),
    ctrl.updateProfile,
  );
  router.put(
    "/password",
    auth,
    csrf,
    validateBody(schemas.authPassword),
    ctrl.changePassword,
  );

  return router;
};
