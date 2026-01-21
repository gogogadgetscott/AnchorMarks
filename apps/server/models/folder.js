// Folder model helpers
function listFolders(db, userId) {
  return db
    .prepare(
      `
    SELECT f.*, COUNT(b.id) AS bookmark_count
    FROM folders f
    LEFT JOIN bookmarks b ON b.folder_id = f.id AND b.user_id = f.user_id AND b.is_archived = 0
    WHERE f.user_id = ?
    GROUP BY f.id
    ORDER BY f.position
  `,
    )
    .all(userId);
}

function getFolderById(db, id) {
  return db.prepare("SELECT * FROM folders WHERE id = ?").get(id);
}

function updateFolder(db, id, userId, fields) {
  db.prepare(
    `
    UPDATE folders SET
      name = COALESCE(?, name),
      parent_id = COALESCE(?, parent_id),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      position = COALESCE(?, position),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    fields.name,
    fields.parent_id,
    fields.color,
    fields.icon,
    fields.position,
    id,
    userId,
  );
}

function deleteFolder(db, id, userId) {
  db.prepare(
    "UPDATE bookmarks SET folder_id = NULL WHERE folder_id = ? AND user_id = ?",
  ).run(id, userId);
  return db
    .prepare("DELETE FROM folders WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

function deleteAllForUser(db, userId) {
  return db.prepare("DELETE FROM folders WHERE user_id = ?").run(userId);
}

function createFolder(
  db,
  id,
  userId,
  name,
  color,
  icon,
  position,
  parentId = null,
) {
  return db
    .prepare(
      "INSERT INTO folders (id, user_id, parent_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, userId, parentId, name, color, icon, position);
}

function findFolderByNameAndParent(db, userId, name, parentId) {
  return db
    .prepare(
      "SELECT id FROM folders WHERE user_id = ? AND name = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
    )
    .get(userId, name, parentId || null, parentId || null);
}

function getMaxPositionForParent(db, userId, parentId) {
  const row = db
    .prepare(
      "SELECT MAX(position) as max FROM folders WHERE user_id = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
    )
    .get(userId, parentId || null, parentId || null);
  return (row && row.max) || 0;
}

function ensureFolder(db, userId, name, parentId = null) {
  const existing = findFolderByNameAndParent(db, userId, name, parentId);
  if (existing) return existing.id;
  const id = require("uuid").v4();
  const position = getMaxPositionForParent(db, userId, parentId) + 1;
  createFolder(db, id, userId, name, "#6366f1", "folder", position);
  return id;
}

module.exports = {
  listFolders,
  getFolderById,
  updateFolder,
  deleteFolder,
  deleteAllForUser,
  createFolder,
  ensureFolder,
};
