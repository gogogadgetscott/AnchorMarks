const { v4: uuidv4 } = require("uuid");

function _baseSelect() {
  return `
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
}

function listBookmarks(db, userId, opts = {}) {
  const {
    folder_id,
    include_children,
    favorites,
    search,
    tags,
    sort,
    limit,
    offset,
    archived,
  } = opts;

  const baseSelect = _baseSelect();
  let query = `SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed ${baseSelect}`;
  let countQuery = `SELECT COUNT(*) as total ${baseSelect}`;
  const params = [userId, userId];

  if (folder_id) {
    if (include_children) {
      query += ` AND (folder_id = ? OR folder_id IN (
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE parent_id = ?
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT id FROM subfolders
            ))`;
      countQuery += ` AND (folder_id = ? OR folder_id IN (
                WITH RECURSIVE subfolders AS (
                    SELECT id FROM folders WHERE parent_id = ?
                    UNION ALL
                    SELECT f.id FROM folders f
                    JOIN subfolders s ON f.parent_id = s.id
                )
                SELECT id FROM subfolders
            ))`;
      params.push(folder_id, folder_id);
    } else {
      query += " AND b.folder_id = ?";
      countQuery += " AND b.folder_id = ?";
      params.push(folder_id);
    }
  }

  if (favorites === true || favorites === "true") {
    query += " AND b.is_favorite = 1";
    countQuery += " AND b.is_favorite = 1";
  }

  if (search) {
    query +=
      " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ? OR tg.tags_joined LIKE ?)";
    countQuery +=
      " AND (b.title LIKE ? OR b.url LIKE ? OR b.description LIKE ? OR tg.tags_joined LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (tags) {
    query += " AND tg.tags_joined LIKE ?";
    countQuery += " AND tg.tags_joined LIKE ?";
    params.push(`%${tags}%`);
  }

  // Handle archiving filter
  if (archived === true || archived === "true") {
    query += " AND b.is_archived = 1";
    countQuery += " AND b.is_archived = 1";
  } else if (archived === "all") {
    // Show both archived and non-archived
  } else {
    // Default: show only non-archived
    query += " AND b.is_archived = 0";
    countQuery += " AND b.is_archived = 0";
  }

  let orderClause = " ORDER BY position, created_at DESC";
  if (sort) {
    switch (String(sort).toLowerCase()) {
      case "recently_added":
        orderClause = " ORDER BY created_at DESC";
        break;
      case "oldest_first":
        orderClause = " ORDER BY created_at ASC";
        break;
      case "most_visited":
        orderClause = " ORDER BY click_count DESC, created_at DESC";
        break;
      case "a_z":
      case "a-z":
        orderClause = " ORDER BY title COLLATE NOCASE ASC";
        break;
      case "z_a":
      case "z-a":
        orderClause = " ORDER BY title COLLATE NOCASE DESC";
        break;
      default:
        orderClause = " ORDER BY position, created_at DESC";
    }
  }
  query += orderClause;

  if (limit) {
    const total = db.prepare(countQuery).get(...params).total;
    query += ` LIMIT ${parseInt(limit)}`;
    if (offset) query += ` OFFSET ${parseInt(offset)}`;
    const bookmarks = db.prepare(query).all(...params);
    return { bookmarks, total };
  }

  const bookmarks = db.prepare(query).all(...params);
  return { bookmarks };
}

function getBookmarkById(db, userId, id) {
  return db
    .prepare(
      `SELECT b.*, COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed ${_baseSelect()} AND b.id = ?`,
    )
    .get(userId, userId, id);
}

function createBookmark(db, userIdOrData, maybeData) {
  // Supports two call styles:
  //  - createBookmark(db, userId, { title, url, ... })
  //  - createBookmark(db, { id, user_id, folder_id, title, url, ... })
  let data = {};
  if (typeof userIdOrData === "object" && userIdOrData !== null && !maybeData) {
    data = userIdOrData;
  } else {
    data = Object.assign({}, maybeData || {});
    data.user_id = userIdOrData;
  }

  const id = data.id || uuidv4();
  const userId = data.user_id;
  const maxPos = db
    .prepare("SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?")
    .get(userId);
  const position =
    data.position != null ? data.position : ((maxPos && maxPos.max) || 0) + 1;
  const faviconUrl = data.favicon || null;
  const folder_id = data.folder_id || null;
  const title = data.title || data.url;
  const url = data.url;
  const description = data.description || null;
  const content_type = data.content_type || data.contentType || "link";
  const color = data.color || null;

  db.prepare(
    `INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, position, content_type, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    folder_id,
    title,
    url,
    description,
    faviconUrl,
    position,
    content_type,
    color,
  );

  return getBookmarkById(db, userId, id);
}

function updateBookmark(db, userId, id, fields = {}) {
  const {
    title,
    url,
    description,
    folder_id,
    is_favorite,
    position,
    favicon,
    tags,
    tag_colors,
    color,
    is_archived,
  } = fields;
  db.prepare(
    `
    UPDATE bookmarks SET 
      title = COALESCE(?, title),
      url = COALESCE(?, url),
      description = COALESCE(?, description),
      folder_id = COALESCE(?, folder_id),
      is_favorite = COALESCE(?, is_favorite),
      position = COALESCE(?, position),
      favicon = COALESCE(?, favicon),
      color = COALESCE(?, color),
      is_archived = COALESCE(?, is_archived),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    title,
    url,
    description,
    folder_id,
    is_favorite,
    position,
    favicon,
    color !== undefined ? color : null,
    is_archived !== undefined ? is_archived : null,
    id,
    userId,
  );

  if (tags !== undefined) {
    const tagHelpers = require("../helpers/tag-helpers");
    if (tags && tags.trim && tags.trim()) {
      const result = tagHelpers.ensureTagsExist(db, userId, tags, {
        returnMap: true,
      });
      const overrides = require("../helpers/tags").normalizeTagColorOverrides(
        tag_colors || null,
        result.tagMap,
      );
      tagHelpers.updateBookmarkTags(db, id, result.tagIds, {
        colorOverridesByTagId: overrides,
      });
    } else {
      tagHelpers.updateBookmarkTags(db, id, []);
    }
  }

  return getBookmarkById(db, userId, id);
}

function deleteBookmark(db, userId, id) {
  return db
    .prepare("DELETE FROM bookmarks WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

function deleteAllForUser(db, userId) {
  return db.prepare("DELETE FROM bookmarks WHERE user_id = ?").run(userId);
}

function setThumbnailLocal(db, bookmarkId, localPath) {
  return db
    .prepare("UPDATE bookmarks SET thumbnail_local = ? WHERE id = ?")
    .run(localPath, bookmarkId);
}

function findBookmarkIdByUrl(db, userId, url) {
  const row = db
    .prepare("SELECT id FROM bookmarks WHERE url = ? AND user_id = ?")
    .get(url, userId);
  return row ? row.id : null;
}

function listUrls(db, userId) {
  return db
    .prepare("SELECT url FROM bookmarks WHERE user_id = ?")
    .all(userId)
    .map((r) => r.url);
}

function getSampleForSuggestion(db, userId, limit = 800) {
  return db
    .prepare(
      `
    SELECT b.title, b.url, COALESCE(tg.tags_joined, '') as tags
    FROM bookmarks b
    LEFT JOIN (
      SELECT bt.bookmark_id, GROUP_CONCAT(t.name, ', ') as tags_joined
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY bt.bookmark_id
    ) tg ON tg.bookmark_id = b.id
    WHERE b.user_id = ?
    LIMIT ?
  `,
    )
    .all(userId, userId, limit);
}

function getRecentCountForDomain(db, userId, domain) {
  const row = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM bookmarks
    WHERE user_id = ? AND url LIKE ? AND datetime(created_at) > datetime('now', '-7 days')
  `,
    )
    .get(userId, `%${domain}%`);
  return row ? row.count : 0;
}

function getMostClickedForDomain(db, userId, domain, limit = 5) {
  return db
    .prepare(
      `
    SELECT title, click_count FROM bookmarks
    WHERE user_id = ? AND url LIKE ?
    ORDER BY click_count DESC
    LIMIT ?
  `,
    )
    .all(userId, `%${domain}%`, limit);
}

function incrementClick(db, a, b) {
  // Accept either (db, userId, id) or (db, id, userId)
  let id, userId;
  if (typeof a === "string" && a.includes("-")) {
    id = a;
    userId = b;
  } else {
    userId = a;
    id = b;
  }
  return db
    .prepare(
      `UPDATE bookmarks SET click_count = click_count + 1, last_clicked = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
    )
    .run(id, userId);
}

module.exports = {
  listBookmarks,
  getBookmarkById,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  incrementClick,
};
module.exports = Object.assign(module.exports, {
  deleteAllForUser,
  setThumbnailLocal,
  findBookmarkIdByUrl,
  listUrls,
  getSampleForSuggestion,
  getRecentCountForDomain,
  getMostClickedForDomain,
});
