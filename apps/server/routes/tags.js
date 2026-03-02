const { Router } = require("express");
const ctrl = require("../controllers/tagController");
const { authenticateToken, validateCsrfToken } = require("../middleware/index");
const { validateBody, validateQuery, schemas } = require("../validation");

module.exports = function createTagsRouter(db) {
  const router = Router();
  const auth = authenticateToken(db);
  const csrf = validateCsrfToken(db);

  router.get("/", auth, ctrl.listTags);
  router.post("/", auth, csrf, validateBody(schemas.tagCreate), ctrl.createTag);
  router.put(
    "/:id",
    auth,
    csrf,
    validateBody(schemas.tagUpdate),
    ctrl.updateTag,
  );
  router.delete("/:id", auth, csrf, ctrl.deleteTag);
  router.get(
    "/suggest",
    auth,
    validateQuery(schemas.tagsSuggestQuery),
    ctrl.suggestTags,
  );
  router.get("/analytics", auth, ctrl.getTagAnalytics);
  router.post(
    "/bulk-add",
    auth,
    csrf,
    validateBody(schemas.tagsBulkAddRemove),
    ctrl.bulkAddTags,
  );
  router.post(
    "/bulk-remove",
    auth,
    csrf,
    validateBody(schemas.tagsBulkAddRemove),
    ctrl.bulkRemoveTags,
  );
  router.post(
    "/rename",
    auth,
    csrf,
    validateBody(schemas.tagsRename),
    ctrl.renameTag,
  );
  router.get(
    "/suggest-ai",
    auth,
    validateQuery(schemas.tagsSuggestAiQuery),
    ctrl.suggestTagsAI,
  );

  return router;
};
