module.exports = function setupCollectionsRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware } = helpers;
  const smartCollectionsModel = require('../models/smartCollections');
  const { parseTagsDetailed } = require('../helpers/tags');

  app.get('/api/collections', authenticateTokenMiddleware, (req, res) => {
    try {
      const collections = smartCollectionsModel.listCollections(db, req.user.id);
      res.json(collections.map((c) => ({ ...c, filters: JSON.parse(c.filters) })));
    } catch (err) {
      console.error('Error listing smart collections:', err);
      res.status(500).json({ error: 'Failed to list collections' });
    }
  });

  app.post('/api/collections', authenticateTokenMiddleware, (req, res) => {
    try {
      const { name, icon, color, filters } = req.body;
      if (!name || !filters) return res.status(400).json({ error: 'Name and filters required' });
      const collection = smartCollectionsModel.createCollection(db, req.user.id, { name, icon, color, filters });
      res.json({ ...collection, filters: JSON.parse(collection.filters) });
    } catch (err) {
      console.error('Error creating collection:', err);
      res.status(500).json({ error: 'Failed to create collection' });
    }
  });

  app.put('/api/collections/:id', authenticateTokenMiddleware, (req, res) => {
    try {
      const { name, icon, color, filters, position } = req.body;
      const updated = smartCollectionsModel.updateCollection(db, req.params.id, req.user.id, { name, icon, color, filters, position });
      res.json({ ...updated, filters: JSON.parse(updated.filters) });
    } catch (err) {
      console.error('Error updating collection:', err);
      res.status(500).json({ error: 'Failed to update collection' });
    }
  });

  app.delete('/api/collections/:id', authenticateTokenMiddleware, (req, res) => {
    try {
      smartCollectionsModel.deleteCollection(db, req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting collection:', err);
      res.status(500).json({ error: 'Failed to delete collection' });
    }
  });

  app.get('/api/collections/:id/bookmarks', authenticateTokenMiddleware, (req, res) => {
    try {
      const collection = smartCollectionsModel.getCollection(db, req.params.id, req.user.id);
      if (!collection) return res.status(404).json({ error: 'Collection not found' });
      const bookmarks = smartCollectionsModel.getBookmarksForCollection(db, collection, req.user.id);
      bookmarks.forEach((b) => { b.tags_detailed = parseTagsDetailed(b.tags_detailed); });
      res.json(bookmarks);
    } catch (err) {
      console.error('Error fetching collection bookmarks:', err);
      res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
  });
};