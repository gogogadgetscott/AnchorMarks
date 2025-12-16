const { v4: uuidv4 } = require('uuid');

function listBookmarkViews(db, userId) {
  return db.prepare('SELECT * FROM bookmark_views WHERE user_id = ? ORDER BY position ASC, created_at DESC').all(userId);
}

function createBookmarkView(db, userId, name, config) {
  const id = uuidv4();
  db.prepare('INSERT INTO bookmark_views (id, user_id, name, config) VALUES (?, ?, ?, ?)').run(id, userId, name, JSON.stringify(config));
  return db.prepare('SELECT * FROM bookmark_views WHERE id = ?').get(id);
}

function getBookmarkView(db, id, userId) {
  return db.prepare('SELECT * FROM bookmark_views WHERE id = ? AND user_id = ?').get(id, userId);
}

function updateBookmarkView(db, id, userId, name, config) {
  const view = getBookmarkView(db, id, userId);
  if (!view) return null;
  db.prepare('UPDATE bookmark_views SET name = ?, config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(name || view.name, config ? JSON.stringify(config) : view.config, id, userId);
  return db.prepare('SELECT * FROM bookmark_views WHERE id = ?').get(id);
}

function deleteBookmarkView(db, id, userId) {
  return db.prepare('DELETE FROM bookmark_views WHERE id = ? AND user_id = ?').run(id, userId);
}

module.exports = { listBookmarkViews, createBookmarkView, getBookmarkView, updateBookmarkView, deleteBookmarkView };
