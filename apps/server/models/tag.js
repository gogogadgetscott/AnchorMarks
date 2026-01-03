// Tag model helpers
function listTags(db, userId) {
  const tags = db
    .prepare(
      `
    SELECT t.*, COUNT(bt.bookmark_id) as count
    FROM tags t
    LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE t.user_id = ?
    GROUP BY t.id
    ORDER BY t.position
  `,
    )
    .all(userId);
  return tags;
}

function createTag(db, data) {
  const { id, user_id, name, color, icon, position } = data;
  db.prepare(
    "INSERT INTO tags (id, user_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, user_id, name, color || "#f59e0b", icon || "tag", position || 0);
}

function updateTag(db, id, userId, fields) {
  db.prepare(
    `
    UPDATE tags SET
      name = COALESCE(?, name),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      position = COALESCE(?, position),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
  ).run(fields.name, fields.color, fields.icon, fields.position, id, userId);
}

function deleteTag(db, id, userId) {
  db.prepare("DELETE FROM bookmark_tags WHERE tag_id = ?").run(id);
  return db
    .prepare("DELETE FROM tags WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

module.exports = { listTags, createTag, updateTag, deleteTag };
