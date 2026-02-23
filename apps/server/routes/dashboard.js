const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

module.exports = function setupDashboardRoutes(app, db, helpers = {}) {
  const {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody,
  } = helpers;
  const dashboardModel = require("../models/dashboard");
  const userSettingsModel = require("../models/userSettings");

  app.get("/api/dashboard/views", authenticateTokenMiddleware, (req, res) => {
    try {
      const views = dashboardModel.listDashboardViews(db, req.user.id);
      res.json(views);
    } catch (err) {
      return reportAndSend(res, err, logger, "Error fetching dashboard views");
    }
  });

  app.post(
    "/api/dashboard/views",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.dashboardViewCreate)] : []),
    (req, res) => {
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
    },
  );

  app.put(
    "/api/dashboard/views/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.dashboardViewUpdate)] : []),
    (req, res) => {
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
    },
  );

  app.delete(
    "/api/dashboard/views/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        dashboardModel.deleteDashboardView(db, req.params.id, req.user.id);
        res.json({ success: true });
      } catch (err) {
        return reportAndSend(res, err, logger, "Error deleting dashboard view");
      }
    },
  );

  app.post(
    "/api/dashboard/views/:id/restore",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
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
        return reportAndSend(
          res,
          err,
          logger,
          "Error restoring dashboard view",
        );
      }
    },
  );
};
