const { Router } = require("express");
const ctrl = require("../controllers/folderController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, schemas } = require("../validation");

module.exports = function createFoldersRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/", auth, ctrl.listFolders);
  router.post(
    "/",
    auth,
    csrf,
    validateBody(schemas.folderCreate),
    ctrl.createFolder,
  );
  router.put(
    "/:id",
    auth,
    csrf,
    validateBody(schemas.folderUpdate),
    ctrl.updateFolder,
  );
  router.delete("/:id", auth, csrf, ctrl.deleteFolder);

  return router;
};
