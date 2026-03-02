const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function listViews(req, res) {
  const db = req.app.get("db");
  const dashboardModel = require("../models/dashboard");
  try {
    res.json(dashboardModel.listDashboardViews(db, req.user.id));
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching dashboard views");
  }
}

function createView(req, res) {
  const db = req.app.get("db");
  const dashboardModel = require("../models/dashboard");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { name, config } = data;
    const view = dashboardModel.createDashboardView(
      db,
      req.user.id,
      name,
      config,
    );
    res.json({ ...view, config: JSON.parse(view.config) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error creating dashboard view");
  }
}

function updateView(req, res) {
  const db = req.app.get("db");
  const dashboardModel = require("../models/dashboard");
  try {
    const data = req.validated;
    if (!data) return res.status(400).json({ error: "Validation required" });
    const { name, config, position } = data;
    const view = dashboardModel.updateDashboardView(
      db,
      req.params.id,
      req.user.id,
      { name, config, position },
    );
    if (!view) return res.status(404).json({ error: "View not found" });
    res.json({ ...view, config: JSON.parse(view.config) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error updating dashboard view");
  }
}

function deleteView(req, res) {
  const db = req.app.get("db");
  const dashboardModel = require("../models/dashboard");
  try {
    dashboardModel.deleteDashboardView(db, req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error deleting dashboard view");
  }
}

function restoreView(req, res) {
  const db = req.app.get("db");
  const dashboardModel = require("../models/dashboard");
  const userSettingsModel = require("../models/userSettings");
  try {
    const view = dashboardModel.getDashboardView(
      db,
      req.params.id,
      req.user.id,
    );
    if (!view) return res.status(404).json({ error: "View not found" });
    const config = JSON.parse(view.config);
    userSettingsModel.applyDashboardConfigToUser(db, req.user.id, config);
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error restoring dashboard view");
  }
}

module.exports = { listViews, createView, updateView, deleteView, restoreView };
