const { schemas } = require("../validation");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

module.exports = function setupBookmarkViewsRoutes(app, db, helpers = {}) {
  const {
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    validateBody,
  } = helpers;
  const bookmarkViewModel = require("../models/bookmarkView");

  app.get("/api/bookmark/views", authenticateTokenMiddleware, (req, res) => {
    try {
      const views = bookmarkViewModel.listBookmarkViews(db, req.user.id);
      res.json(views);
    } catch (err) {
      return reportAndSend(res, err, logger, "Error fetching bookmark views");
    }
  });

  app.post(
    "/api/bookmark/views",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.bookmarkViewCreate)] : []),
    (req, res) => {
      try {
        const data = req.validated;
        if (!data)
          return res.status(400).json({ error: "Validation required" });
        const { name, config } = data;
        const view = bookmarkViewModel.createBookmarkView(
          db,
          req.user.id,
          name,
          config,
        );
        res.json(view);
      } catch (err) {
        return reportAndSend(res, err, logger, "Error creating bookmark view");
      }
    },
  );

  app.put(
    "/api/bookmark/views/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    ...(validateBody ? [validateBody(schemas.bookmarkViewUpdate)] : []),
    (req, res) => {
      try {
        const data = req.validated;
        if (!data)
          return res.status(400).json({ error: "Validation required" });
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
    },
  );

  app.delete(
    "/api/bookmark/views/:id",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
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
    },
  );

  app.post(
    "/api/bookmark/views/:id/restore",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
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
    },
  );
};
