const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function listViews(req, res) {
  const db = req.app.get("db");
  const bookmarkViewModel = require("../models/bookmarkView");
  try {
    res.json(bookmarkViewModel.listBookmarkViews(db, req.user.id));
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching bookmark views");
  }
}

function createView(req, res) {
  const db = req.app.get("db");
  const bookmarkViewModel = require("../models/bookmarkView");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { name, config } = data;
    res.json(
      bookmarkViewModel.createBookmarkView(db, req.user.id, name, config),
    );
  } catch (err) {
    return reportAndSend(res, err, logger, "Error creating bookmark view");
  }
}

function updateView(req, res) {
  const db = req.app.get("db");
  const bookmarkViewModel = require("../models/bookmarkView");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { name, config } = data;
    const updated = bookmarkViewModel.updateBookmarkView(
      db,
      req.params.id,
      req.user.id,
      name,
      config,
    );
    if (!updated) return res.status(404).json({ error: "View not found" });
    res.json(updated);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error updating bookmark view");
  }
}

function deleteView(req, res) {
  const db = req.app.get("db");
  const bookmarkViewModel = require("../models/bookmarkView");
  try {
    const result = bookmarkViewModel.deleteBookmarkView(
      db,
      req.params.id,
      req.user.id,
    );
    if (result.changes === 0)
      return res.status(404).json({ error: "View not found" });
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error deleting bookmark view");
  }
}

function restoreView(req, res) {
  const db = req.app.get("db");
  const bookmarkViewModel = require("../models/bookmarkView");
  try {
    const view = bookmarkViewModel.getBookmarkView(
      db,
      req.params.id,
      req.user.id,
    );
    if (!view) return res.status(404).json({ error: "View not found" });
    res.json({ success: true, config: JSON.parse(view.config) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error restoring bookmark view");
  }
}

module.exports = { listViews, createView, updateView, deleteView, restoreView };
