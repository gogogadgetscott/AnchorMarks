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

  // Bulk-move must come before /:id to avoid route shadowing
  router.post(
    "/bulk-move",
    auth,
    csrf,
    validateBody(schemas.folderBulkMove),
    ctrl.bulkMoveParents,
  );

  router.put(
    "/:id",
    auth,
    csrf,
    validateBody(schemas.folderUpdate),
    ctrl.updateFolder,
  );

  // Dedicated parent-change endpoint — handles null (top level) explicitly
  router.patch(
    "/:id/parent",
    auth,
    csrf,
    validateBody(schemas.folderParentUpdate),
    ctrl.updateFolderParent,
  );

  router.delete("/:id", auth, csrf, ctrl.deleteFolder);

  return router;
};
