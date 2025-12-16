module.exports = function setupBookmarkViewsRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware } = helpers;
  const bookmarkViewModel = require('../models/bookmarkView');

  app.get('/api/bookmark/views', authenticateTokenMiddleware, (req, res) => {
    try {
      const views = bookmarkViewModel.listBookmarkViews(db, req.user.id);
      res.json(views);
    } catch (err) {
      console.error('Error fetching bookmark views:', err);
      res.status(500).json({ error: 'Failed to fetch bookmark views' });
    }
  });

  app.post('/api/bookmark/views', authenticateTokenMiddleware, (req, res) => {
    try {
      const { name, config } = req.body;
      if (!name || !config) return res.status(400).json({ error: 'Name and config are required' });
      const view = bookmarkViewModel.createBookmarkView(db, req.user.id, name, config);
      res.json(view);
    } catch (err) {
      console.error('Error creating bookmark view:', err);
      res.status(500).json({ error: 'Failed to create bookmark view' });
    }
  });

  app.put('/api/bookmark/views/:id', authenticateTokenMiddleware, (req, res) => {
    try {
      const { name, config } = req.body;
      const updated = bookmarkViewModel.updateBookmarkView(db, req.params.id, req.user.id, name, config);
      if (!updated) return res.status(404).json({ error: 'View not found' });
      res.json(updated);
    } catch (err) {
      console.error('Error updating bookmark view:', err);
      res.status(500).json({ error: 'Failed to update bookmark view' });
    }
  });

  app.delete('/api/bookmark/views/:id', authenticateTokenMiddleware, (req, res) => {
    try {
      const result = bookmarkViewModel.deleteBookmarkView(db, req.params.id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: 'View not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting bookmark view:', err);
      res.status(500).json({ error: 'Failed to delete bookmark view' });
    }
  });

  app.post('/api/bookmark/views/:id/restore', authenticateTokenMiddleware, (req, res) => {
    try {
      const view = bookmarkViewModel.getBookmarkView(db, req.params.id, req.user.id);
      if (!view) return res.status(404).json({ error: 'View not found' });
      res.json({ success: true, config: JSON.parse(view.config) });
    } catch (err) {
      console.error('Error restoring bookmark view:', err);
      res.status(500).json({ error: 'Failed to restore bookmark view' });
    }
  });
};