const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

module.exports = function setupCollectionsRoutes(app, db, helpers = {}) {
  const {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody,
  } = helpers;
  const smartCollectionsModel = require("../models/smartCollections");
  const { parseTagsDetailed } = require("../helpers/tags");

  app.get("/api/collections", authenticateTokenMiddleware, (req, res) => {
    try {
      const collections = smartCollectionsModel.listCollections(
        db,
        req.user.id,
      );
      res.json(
        collections.map((c) => ({ ...c, filters: JSON.parse(c.filters) })),
      );
    } catch (err) {
      return reportAndSend(res, err, logger, "Error listing smart collections");
    }
  });

  app.get("/api/collections/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      const collection = smartCollectionsModel.getCollection(
        db,
        req.params.id,
        req.user.id,
      );
      if (!collection)
        return res.status(404).json({ error: "Collection not found" });
      res.json({ ...collection, filters: JSON.parse(collection.filters) });
    } catch (err) {
      return reportAndSend(res, err, logger, "Error fetching collection");
    }
  });

  app.post(
    "/api/collections",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.collectionCreate)] : []),
    (req, res) => {
      try {
        const { name, icon, color, filters } = req.validated || req.body;
        const collection = smartCollectionsModel.createCollection(
          db,
          req.user.id,
          { name, icon, color, filters },
        );
        res.json({ ...collection, filters: JSON.parse(collection.filters) });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error creating collection");
      }
    },
  );

  app.put(
    "/api/collections/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.collectionUpdate)] : []),
    (req, res) => {
      try {
        const { name, icon, color, filters, position } =
          req.validated || req.body;
        const updated = smartCollectionsModel.updateCollection(
          db,
          req.params.id,
          req.user.id,
          { name, icon, color, filters, position },
        );
        if (!updated)
          return res.status(404).json({ error: "Collection not found" });
        res.json({ ...updated, filters: JSON.parse(updated.filters) });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error updating collection");
      }
    },
  );

  app.delete(
    "/api/collections/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        smartCollectionsModel.deleteCollection(db, req.params.id, req.user.id);
        res.json({ success: true });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error deleting collection");
      }
    },
  );

  app.get(
    "/api/collections/:id/bookmarks",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        const collection = smartCollectionsModel.getCollection(
          db,
          req.params.id,
          req.user.id,
        );
        if (!collection)
          return res.status(404).json({ error: "Collection not found" });
        const bookmarks = smartCollectionsModel.getBookmarksForCollection(
          db,
          collection,
          req.user.id,
        );
        bookmarks.forEach((b) => {
          b.tags_detailed = parseTagsDetailed(b.tags_detailed);
        });
        res.json(bookmarks);
      } catch (err) {
        return reportAndSend(
          res,
          err,
          logger,
          "Error fetching collection bookmarks",
        );
      }
    },
  );
};
