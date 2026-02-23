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
    tagMode,
    sort,
    limit,
    offset,
    archived,
  } = opts;

  const isFavoritesView = favorites === true || favorites === "true";
  const isArchivedView = archived === true || archived === "true";
  const hasSearch = !!(search && !isFavoritesView && !isArchivedView);

  // Define the base FROM and JOINs
  let baseFrom;
  if (hasSearch) {
    baseFrom = `
      FROM bookmarks b
      INNER JOIN bookmarks_fts ON bookmarks_fts.id = b.id
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
      ) tg ON tg.bookmark_id = b.id`;
  } else {
    baseFrom = `
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
      ) tg ON tg.bookmark_id = b.id`;
  }

  const tagsSelect =
    hasSearch
      ? "COALESCE(tg.tags_joined, '') as _tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed"
      : "COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed";
  let query = `SELECT b.*, ${tagsSelect} ${baseFrom} WHERE b.user_id = ?`;
  let countQuery = `SELECT COUNT(*) as total ${baseFrom} WHERE b.user_id = ?`;
  const params = [userId, userId];

  // Handle folder filter
  if (folder_id && !isFavoritesView && !isArchivedView) {
    if (include_children) {
      const folderFilter = ` AND (b.folder_id = ? OR b.folder_id IN (
        WITH RECURSIVE subfolders AS (
          SELECT id FROM folders WHERE parent_id = ?
          UNION ALL
          SELECT f.id FROM folders f
          JOIN subfolders s ON f.parent_id = s.id
        )
        SELECT id FROM subfolders
      ))`;
      query += folderFilter;
      countQuery += folderFilter;
      params.push(folder_id, folder_id);
    } else {
      query += " AND b.folder_id = ?";
      countQuery += " AND b.folder_id = ?";
      params.push(folder_id);
    }
  }

  // Handle favorite filter
  if (isFavoritesView) {
    query += " AND COALESCE(b.is_favorite, 0) = 1";
    countQuery += " AND COALESCE(b.is_favorite, 0) = 1";
  }

  // Handle search matching
  if (hasSearch) {
    const useFuzzy = opts.fuzzy === true;
    const searchWords = search
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    if (searchWords.length > 0) {
      const ftsQuery = searchWords
        .map((w) => `"${w.replace(/"/g, '""')}"*`)
        .join(useFuzzy ? " OR " : " AND ");

      query += " AND bookmarks_fts MATCH ?";
      countQuery += " AND bookmarks_fts MATCH ?";
      params.push(ftsQuery);
    }
  }

  // Handle tag filtering
  if (tags && !isFavoritesView && !isArchivedView) {
    const tagArr = String(tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagArrLower = tagArr.map((t) => t.toLowerCase());

    if (tagArrLower.length > 0) {
      const tagPlaceholders = tagArrLower.map(() => "?").join(",");
      if (tagMode && String(tagMode).toLowerCase() === "and") {
        const tagFilter = `
          AND b.id IN (
            SELECT bt.bookmark_id
            FROM bookmark_tags bt
            JOIN tags t ON t.id = bt.tag_id
            WHERE t.user_id = ? AND LOWER(t.name) IN (${tagPlaceholders})
            GROUP BY bt.bookmark_id
            HAVING COUNT(DISTINCT LOWER(t.name)) = ?
          )
        `;
        query += tagFilter;
        countQuery += tagFilter;
        params.push(userId, ...tagArrLower, tagArrLower.length);
      } else {
        const tagFilter = `
          AND b.id IN (
            SELECT DISTINCT bt.bookmark_id
            FROM bookmark_tags bt
            JOIN tags t ON t.id = bt.tag_id
            WHERE t.user_id = ? AND LOWER(t.name) IN (${tagPlaceholders})
          )
        `;
        query += tagFilter;
        countQuery += tagFilter;
        params.push(userId, ...tagArrLower);
      }
    }
  }

  // Handle archiving filter
  if (isFavoritesView) {
    query += " AND b.is_archived = 0";
    countQuery += " AND b.is_archived = 0";
  } else {
    if (archived === true || archived === "true") {
      query += " AND b.is_archived = 1";
      countQuery += " AND b.is_archived = 1";
    } else if (archived === "all") {
      // Show all
    } else {
      query += " AND b.is_archived = 0";
      countQuery += " AND b.is_archived = 0";
    }
  }

  // Sorting and Pagination
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
        orderClause = hasSearch
          ? " ORDER BY bookmarks_fts.rank"
          : " ORDER BY position, created_at DESC";
    }
  } else if (hasSearch) {
    orderClause = " ORDER BY bookmarks_fts.rank";
  }

  query += orderClause;

  if (limit) {
    const total = db.prepare(countQuery).get(...params).total;
    const safeLimit = Math.max(
      1,
      Math.min(10000, parseInt(String(limit), 10) || 50),
    );
    const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);
    query += " LIMIT ? OFFSET ?";
    params.push(safeLimit, safeOffset);
    let bookmarks = db.prepare(query).all(...params);
    if (hasSearch) bookmarks = bookmarks.map((b) => { const { _tags, ...rest } = b; return { ...rest, tags: _tags }; });
    return { bookmarks, total };
  }

  let bookmarks = db.prepare(query).all(...params);
  if (hasSearch) bookmarks = bookmarks.map((b) => { const { _tags, ...rest } = b; return { ...rest, tags: _tags }; });
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
  const og_image = data.og_image || null;

  db.prepare(
    "INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, position, content_type, color, og_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
    og_image,
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
    og_image,
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
      og_image = COALESCE(?, og_image),
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
    og_image !== undefined ? og_image : null,
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

function setThumbnailLocal(db, bookmarkId, localPath, userId) {
  if (!userId) throw new Error("setThumbnailLocal requires userId");
  return db
    .prepare(
      "UPDATE bookmarks SET thumbnail_local = ? WHERE id = ? AND user_id = ?",
    )
    .run(localPath, bookmarkId, userId);
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
      "UPDATE bookmarks SET click_count = click_count + 1, last_clicked = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
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
