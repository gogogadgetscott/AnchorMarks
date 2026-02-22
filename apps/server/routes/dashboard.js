module.exports = function setupDashboardRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware, validateCsrfTokenMiddleware } = helpers;
  const dashboardModel = require("../models/dashboard");
  const userSettingsModel = require("../models/userSettings");

  app.get("/api/dashboard/views", authenticateTokenMiddleware, (req, res) => {
    try {
      const views = dashboardModel.listDashboardViews(db, req.user.id);
      res.json(views);
    } catch (err) {
      console.error("Error fetching dashboard views:", err);
      res.status(500).json({ error: "Failed to fetch dashboard views" });
    }
  });

  app.post(
    "/api/dashboard/views",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        const { name, config } = req.body;
        if (!name || !config)
          return res.status(400).json({ error: "Name and config required" });
        const view = dashboardModel.createDashboardView(
          db,
          req.user.id,
          name,
          config,
        );
        res.json({ ...view, config: JSON.parse(view.config) });
      } catch (err) {
        console.error("Error creating dashboard view:", err);
        res.status(500).json({ error: "Failed to create dashboard view" });
      }
    },
  );

  app.put(
    "/api/dashboard/views/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      try {
        const { name, config, position } = req.body;
        const view = dashboardModel.updateDashboardView(
          db,
          req.params.id,
          req.user.id,
          { name, config, position },
        );
        if (!view) return res.status(404).json({ error: "View not found" });
        res.json({ ...view, config: JSON.parse(view.config) });
      } catch (err) {
        console.error("Error updating dashboard view:", err);
        res.status(500).json({ error: "Failed to update dashboard view" });
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
        console.error("Error deleting dashboard view:", err);
        res.status(500).json({ error: "Failed to delete dashboard view" });
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
        console.error("Error restoring dashboard view:", err);
        res.status(500).json({ error: "Failed to restore dashboard view" });
      }
    },
  );
};
