const { v4: uuidv4 } = require("uuid");

function listCollections(db, userId) {
  return db
    .prepare(
      "SELECT * FROM smart_collections WHERE user_id = ? ORDER BY position",
    )
    .all(userId);
}

function createCollection(db, userId, { name, icon, color, filters }) {
  const id = uuidv4();
  const maxPos = db
    .prepare(
      "SELECT MAX(position) as max FROM smart_collections WHERE user_id = ?",
    )
    .get(userId);
  const position = (maxPos.max || 0) + 1;

  db.prepare(
    "INSERT INTO smart_collections (id, user_id, name, icon, color, filters, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    userId,
    name,
    icon || "filter",
    color || "#6366f1",
    JSON.stringify(filters),
    position,
  );

  return db.prepare("SELECT * FROM smart_collections WHERE id = ?").get(id);
}

function updateCollection(
  db,
  id,
  userId,
  { name, icon, color, filters, position },
) {
  db.prepare(
    `
    UPDATE smart_collections SET 
      name = COALESCE(?, name),
      icon = COALESCE(?, icon),
      color = COALESCE(?, color),
      filters = COALESCE(?, filters),
      position = COALESCE(?, position)
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    name,
    icon,
    color,
    filters ? JSON.stringify(filters) : null,
    position,
    id,
    userId,
  );

  return db.prepare("SELECT * FROM smart_collections WHERE id = ?").get(id);
}

function deleteCollection(db, id, userId) {
  return db
    .prepare("DELETE FROM smart_collections WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

function getCollection(db, id, userId) {
  return db
    .prepare("SELECT * FROM smart_collections WHERE id = ? AND user_id = ?")
    .get(id, userId);
}

function getBookmarksForCollection(db, collection, userId) {
  const filters = collection.filters ? JSON.parse(collection.filters) : {};

  let query = `
      SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed
      FROM bookmarks b
      LEFT JOIN (
        SELECT bt.bookmark_id,
               GROUP_CONCAT(t.name, ', ') as tags_joined,
               json_group_array(
                 json_object(
                   'name', t.name,
                   'tag_id', t.id,
                   'color', t.color,
                   'color_override', bt.color_override
                 )
               ) as tags_detailed
        FROM bookmark_tags bt
        JOIN tags t ON t.id = bt.tag_id
        WHERE t.user_id = ?
        GROUP BY bt.bookmark_id
      ) tg ON tg.bookmark_id = b.id
      WHERE b.user_id = ?`;
  const params = [userId, userId];

  if (filters.tags && filters.tags.length > 0) {
    const tagConditions = filters.tags
      .map(() => "tg.tags_joined LIKE ?")
      .join(" OR ");
    query += ` AND (${tagConditions})`;
    filters.tags.forEach((tag) => params.push(`%${tag}%`));
  }

  if (filters.search) {
    query += " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ?)";
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (filters.domain) {
    query += " AND b.url LIKE ?";
    params.push(`%${filters.domain}%`);
  }

  if (filters.favorites) {
    query += " AND b.is_favorite = 1";
  }

  if (filters.untagged) {
    query +=
      " AND NOT EXISTS (SELECT 1 FROM bookmark_tags bt WHERE bt.bookmark_id = b.id)";
  }

  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params);
  return rows;
}

module.exports = {
  listCollections,
  createCollection,
  updateCollection,
  deleteCollection,
  getCollection,
  getBookmarksForCollection,
};
