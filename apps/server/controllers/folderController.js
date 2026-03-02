const { v4: uuidv4 } = require("uuid");
const { broadcast } = require("../services/websocketService");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function listFolders(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  try {
    return res.json(folderModel.listFolders(db, req.user.id));
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching folders");
  }
}

function createFolder(req, res) {
  const db = req.app.get("db");
  const folderModel = require("../models/folder");
  const { name, parent_id, color, icon } = req.validated;
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
  const { name, parent_id, color, icon, position } = req.validated;
  try {
    folderModel.updateFolder(db, req.params.id, req.user.id, {
      name,
      parent_id,
      color,
      icon,
      position,
    });
    const folder = folderModel.getFolderById(db, req.params.id, req.user.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    broadcast(req.user.id, { type: "folders:changed" });
    res.json(folder);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error updating folder");
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

module.exports = { listFolders, createFolder, updateFolder, deleteFolder };
