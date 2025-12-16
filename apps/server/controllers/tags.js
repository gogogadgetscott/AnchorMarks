const { v4: uuidv4 } = require('uuid');

function setupTagsRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware } = helpers;
  const tagModel = require('../models/tag');

  app.get('/api/tags', authenticateTokenMiddleware, (req, res) => {
    try {
      const tags = tagModel.listTags(db, req.user.id);
      res.json(tags);
    } catch (err) {
      console.error('Error fetching tags:', err);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  });

  app.post('/api/tags', authenticateTokenMiddleware, (req, res) => {
    const { name, color, icon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Tag name is required' });
    const id = uuidv4();
    const maxPos = db.prepare('SELECT MAX(position) as max FROM tags WHERE user_id = ?').get(req.user.id);
    const position = (maxPos.max || 0) + 1;
    try {
      tagModel.createTag(db, { id, user_id: req.user.id, name: name.trim(), color: color || '#f59e0b', icon: icon || 'tag', position });
      const tag = db.prepare('SELECT *, 0 as count FROM tags WHERE id = ?').get(id);
      res.json(tag);
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Tag already exists' });
      res.status(500).json({ error: 'Failed to create tag' });
    }
  });

  app.put('/api/tags/:id', authenticateTokenMiddleware, (req, res) => {
    const { name, color, icon, position } = req.body;
    try {
      tagModel.updateTag(db, req.params.id, req.user.id, { name, color, icon, position });
      const tag = db.prepare(`
        SELECT t.*, COUNT(bt.bookmark_id) as count
        FROM tags t
        LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(req.params.id);
      if (!tag) return res.status(404).json({ error: 'Tag not found' });
      res.json(tag);
    } catch (err) {
      console.error('Error updating tag:', err);
      res.status(500).json({ error: 'Failed to update tag' });
    }
  });

  app.delete('/api/tags/:id', authenticateTokenMiddleware, (req, res) => {
    try {
      tagModel.deleteTag(db, req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting tag:', err);
      res.status(500).json({ error: 'Failed to delete tag' });
    }
  });
}

module.exports = { setupTagsRoutes };
