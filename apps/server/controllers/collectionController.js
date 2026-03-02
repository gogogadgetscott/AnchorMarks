const { parseTagsDetailed } = require("../utils/tagUtils");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function listCollections(req, res) {
  const db = req.app.get("db");
  const smartCollectionsModel = require("../models/smartCollections");
  try {
    const collections = smartCollectionsModel.listCollections(db, req.user.id);
    res.json(
      collections.map((c) => ({ ...c, filters: JSON.parse(c.filters) })),
    );
  } catch (err) {
    return reportAndSend(res, err, logger, "Error listing smart collections");
  }
}

function getCollection(req, res) {
  const db = req.app.get("db");
  const smartCollectionsModel = require("../models/smartCollections");
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
}

function createCollection(req, res) {
  const db = req.app.get("db");
  const smartCollectionsModel = require("../models/smartCollections");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { name, icon, color, filters } = data;
    const collection = smartCollectionsModel.createCollection(db, req.user.id, {
      name,
      icon,
      color,
      filters,
    });
    res.json({ ...collection, filters: JSON.parse(collection.filters) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error creating collection");
  }
}

function updateCollection(req, res) {
  const db = req.app.get("db");
  const smartCollectionsModel = require("../models/smartCollections");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { name, icon, color, filters, position } = data;
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
}

function deleteCollection(req, res) {
  const db = req.app.get("db");
  const smartCollectionsModel = require("../models/smartCollections");
  try {
    smartCollectionsModel.deleteCollection(db, req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error deleting collection");
  }
}

function getCollectionBookmarks(req, res) {
  const db = req.app.get("db");
  const smartCollectionsModel = require("../models/smartCollections");
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
}

module.exports = {
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollectionBookmarks,
};
