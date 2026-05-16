const { v4: uuidv4 } = require("uuid");
const { broadcast } = require("../services/websocketService");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function listFolders(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  try {
    return res.json({ folders: folderModel.listFolders(db, req.user.id) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching folders");
  }
}

function createFolder(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  const { name, parent_id, color, icon, metadata } = req.validated;
  try {
    const id = uuidv4();
    const maxPos = db
      .prepare(
        "SELECT MAX(position) as max FROM folders WHERE user_id = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
      )
      .get(req.user.id, parent_id || null, parent_id || null);
    const position = (maxPos.max || 0) + 1;
    folderModel.createFolder(
      db,
      id,
      req.user.id,
      name.trim(),
      color || "#6366f1",
      icon || "folder",
      position,
      parent_id || null,
      metadata || null,
    );
    const folder = folderModel.getFolderById(db, id, req.user.id);
    broadcast(req.user.id, { type: "folders:changed" });
    res.json(folder);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error creating folder");
  }
}

function updateFolder(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  const { name, parent_id, color, icon, position, metadata } = req.validated;
  try {
    // Build fields object — only include keys that were actually provided
    const fields = {};
    if (name !== undefined) fields.name = name;
    if (parent_id !== undefined) fields.parent_id = parent_id || null;
    if (color !== undefined) fields.color = color;
    if (icon !== undefined) fields.icon = icon;
    if (position !== undefined) fields.position = position;
    if (metadata !== undefined) fields.metadata = metadata;

    folderModel.updateFolder(db, req.params.id, req.user.id, fields);
    const folder = folderModel.getFolderById(db, req.params.id, req.user.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    broadcast(req.user.id, { type: "folders:changed" });
    res.json(folder);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error updating folder");
  }
}

// PATCH /api/folders/:id/parent — explicitly set (or clear) a folder's parent.
// Enforces max-depth and cycle constraints.
function updateFolderParent(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  // parent_id may be null (move to top level) or a UUID string
  const { parent_id } = req.validated;
  try {
    const err = folderModel.setFolderParent(
      db,
      req.params.id,
      req.user.id,
      parent_id ?? null,
    );
    if (err) return res.status(422).json({ error: err });

    const folder = folderModel.getFolderById(db, req.params.id, req.user.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    broadcast(req.user.id, { type: "folders:changed" });
    res.json(folder);
  } catch (innerErr) {
    return reportAndSend(res, innerErr, logger, "Error updating folder parent");
  }
}

// POST /api/folders/bulk-move — move an array of folders to a new parent.
function bulkMoveParents(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  const { ids, parent_id } = req.validated;
  try {
    const result = folderModel.bulkUpdateParents(
      db,
      ids,
      req.user.id,
      parent_id ?? null,
    );
    broadcast(req.user.id, { type: "folders:changed" });
    res.json(result);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error bulk-moving folders");
  }
}

function deleteFolder(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  try {
    folderModel.deleteFolder(db, req.params.id, req.user.id);
    broadcast(req.user.id, { type: "folders:changed" });
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error deleting folder");
  }
}

// POST /api/folders/merge — merge source folders into a single target.
function mergeFoldersCtrl(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  const { source_ids, target_id } = req.validated;
  try {
    const target = folderModel.getFolderById(db, target_id, req.user.id);
    if (!target) return res.status(404).json({ error: "Target folder not found" });
    const sources = source_ids.filter((id) => id !== target_id);
    if (sources.length === 0)
      return res.status(422).json({ error: "No valid source folders" });
    folderModel.mergeFolders(db, sources, target_id, req.user.id);
    broadcast(req.user.id, { type: "folders:changed" });
    broadcast(req.user.id, { type: "bookmarks:changed" });
    res.json({ merged: sources.length, target_id });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error merging folders");
  }
}

// POST /api/folders/bulk-delete — delete multiple folders.
function bulkDeleteFoldersCtrl(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  const { ids } = req.validated;
  try {
    folderModel.bulkDeleteFolders(db, ids, req.user.id);
    broadcast(req.user.id, { type: "folders:changed" });
    res.json({ deleted: ids.length });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error bulk-deleting folders");
  }
}

module.exports = {
  listFolders,
  createFolder,
  updateFolder,
  updateFolderParent,
  bulkMoveParents,
  deleteFolder,
  mergeFolders: mergeFoldersCtrl,
  bulkDeleteFolders: bulkDeleteFoldersCtrl,
};
