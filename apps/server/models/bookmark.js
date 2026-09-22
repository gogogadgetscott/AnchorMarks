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

function assertFolderOwnership(db, userId, folderId) {
  if (folderId == null) return;
  const folder = db
    .prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?")
    .get(folderId, userId);
  if (!folder) throw new Error("Folder does not belong to user");
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
    most_used,
  } = opts;

  const isFavoritesView = favorites === true || favorites === "true";
  const isArchivedView = archived === true || archived === "true";
  const isMostUsedView = most_used === true || most_used === "true";
  const hasSearch = !!(
    search &&
    !isFavoritesView &&
    !isArchivedView &&
    !isMostUsedView
  );

  // Core FROM without the tags aggregation. Tags are attached only for the
  // rows that are actually returned (see tagsSubquery below), which keeps the
  // per-page query fast on large libraries instead of aggregating tags for
  // every bookmark the user owns.
  const coreFrom = hasSearch
    ? `FROM bookmarks b
       INNER JOIN bookmarks_fts ON bookmarks_fts.id = b.id`
    : `FROM bookmarks b`;

  // ---- WHERE clauses ----
  const whereClauses = ["b.user_id = ?"];
  const filterParams = [userId];

  // Handle folder filter
  // Folder filters should be ignored in favorites view, archived view, and most-used view
  if (folder_id && !isFavoritesView && !isArchivedView && !isMostUsedView) {
    if (include_children) {
      whereClauses.push(`(b.folder_id = ? OR b.folder_id IN (
        WITH RECURSIVE subfolders AS (
          SELECT id FROM folders WHERE parent_id = ?
          UNION ALL
          SELECT f.id FROM folders f
          JOIN subfolders s ON f.parent_id = s.id
        )
        SELECT id FROM subfolders
      ))`);
      filterParams.push(folder_id, folder_id);
    } else {
      whereClauses.push("b.folder_id = ?");
      filterParams.push(folder_id);
    }
  }

  // Handle favorite filter
  if (isFavoritesView) {
    whereClauses.push("COALESCE(b.is_favorite, 0) = 1");
  }

  // Handle most-used filter
  if (isMostUsedView) {
    whereClauses.push("b.click_count > 0");
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

      whereClauses.push("bookmarks_fts MATCH ?");
      filterParams.push(ftsQuery);
    }
  }

  // Handle tag filtering
  // Tag filters should be ignored in favorites view, archived view, and most-used view
  if (tags && !isFavoritesView && !isArchivedView && !isMostUsedView) {
    const tagArr = String(tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagArrLower = tagArr.map((t) => t.toLowerCase());

    if (tagArrLower.length > 0) {
      const tagPlaceholders = tagArrLower.map(() => "?").join(",");
      if (tagMode && String(tagMode).toLowerCase() === "and") {
        whereClauses.push(`b.id IN (
          SELECT bt.bookmark_id
          FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE t.user_id = ? AND LOWER(t.name) IN (${tagPlaceholders})
          GROUP BY bt.bookmark_id
          HAVING COUNT(DISTINCT LOWER(t.name)) = ?
        )`);
        filterParams.push(userId, ...tagArrLower, tagArrLower.length);
      } else {
        whereClauses.push(`b.id IN (
          SELECT DISTINCT bt.bookmark_id
          FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE t.user_id = ? AND LOWER(t.name) IN (${tagPlaceholders})
        )`);
        filterParams.push(userId, ...tagArrLower);
      }
    }
  }

  // Handle archiving filter
  if (isFavoritesView) {
    whereClauses.push("b.is_archived = 0");
  } else {
    if (isArchivedView) {
      whereClauses.push("b.is_archived = 1");
    } else if (archived === "all") {
      // Show all
    } else {
      whereClauses.push("b.is_archived = 0");
    }
  }

  const whereSql = whereClauses.join(" AND ");

  // ---- Sorting and Pagination ----
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

  // Tags aggregation — scoped to a bookmark set via `scope` (inserted before
  // GROUP BY) so it only aggregates the bookmarks being returned.
  const tagsSubquery = (scope = "") => `
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
    WHERE t.user_id = ?${scope ? ` AND ${scope}` : ""}
    GROUP BY bt.bookmark_id`;

  const tagsSelect = hasSearch
    ? "COALESCE(tg.tags_joined, '') as _tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed"
    : "COALESCE(tg.tags_joined, '') as tags, COALESCE(tg.tags_detailed, '[]') as tags_detailed";

  const mapTags = (bookmarks) =>
    hasSearch
      ? bookmarks.map((b) => {
          const { _tags, ...rest } = b;
          return { ...rest, tags: _tags };
        })
      : bookmarks;

  // COUNT does not depend on the tags aggregation (the tag join is 1:1 on the
  // bookmark), so compute it from the lightweight core FROM.
  const countQuery = `SELECT COUNT(*) as total ${coreFrom} WHERE ${whereSql}`;

  if (limit) {
    const total = db.prepare(countQuery).get(...filterParams).total;
    let safeLimit = Math.max(
      1,
      Math.min(10000, parseInt(String(limit), 10) || 50),
    );
    let effectiveTotal = total;
    if (isMostUsedView) {
      safeLimit = Math.max(1, Math.ceil(total * 0.2));
      effectiveTotal = safeLimit;
    }
    const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);

    // Paginate first with a lightweight query, then attach tags only for the
    // page's bookmarks. SQLite preserves the CTE's ORDER BY through the
    // 1:1 join back to bookmarks.
    const dataQuery = `
      WITH page AS (
        SELECT b.id ${coreFrom}
        WHERE ${whereSql}
        ${orderClause}
        LIMIT ? OFFSET ?
      )
      SELECT b.*, ${tagsSelect}
      FROM page p
      JOIN bookmarks b ON b.id = p.id
      LEFT JOIN (
        ${tagsSubquery("bt.bookmark_id IN (SELECT id FROM page)")}
      ) tg ON tg.bookmark_id = b.id`;

    const bookmarks = mapTags(
      db.prepare(dataQuery).all(...filterParams, safeLimit, safeOffset, userId),
    );
    return { bookmarks, total: effectiveTotal };
  }

  const fullQuery = `
    SELECT b.*, ${tagsSelect}
    ${coreFrom}
    LEFT JOIN (${tagsSubquery()}) tg ON tg.bookmark_id = b.id
    WHERE ${whereSql}
    ${orderClause}`;
  const bookmarks = mapTags(db.prepare(fullQuery).all(userId, ...filterParams));
  return { bookmarks };
}

function listViewTags(db, userId, opts = {}) {
  const { folder_id, favorites, archived, most_used, tags, tagMode } = opts;
  const isFavoritesView = favorites === true || favorites === "true";
  const isArchivedView = archived === true || archived === "true";
  const isMostUsedView = most_used === true || most_used === "true";

  // Count matching bookmarks per tag first (restricted to the active view),
  // then join back to tags. This avoids aggregating the full tag x bookmark
  // cross product and is significantly faster on large libraries.
  const bookmarkClauses = ["b.user_id = ?"];
  const params = [userId];

  if (isFavoritesView) {
    bookmarkClauses.push(
      "COALESCE(b.is_favorite, 0) = 1 AND b.is_archived = 0",
    );
  } else if (isArchivedView) {
    bookmarkClauses.push("b.is_archived = 1");
  } else if (isMostUsedView) {
    bookmarkClauses.push("b.click_count > 0 AND b.is_archived = 0");
  } else {
    bookmarkClauses.push("b.is_archived = 0");
  }

  if (folder_id) {
    bookmarkClauses.push("b.folder_id = ?");
    params.push(folder_id);
  }

  if (tags) {
    const tagArr = String(tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagArrLower = tagArr.map((t) => t.toLowerCase());
    if (tagArrLower.length > 0) {
      const ph = tagArrLower.map(() => "?").join(",");
      if (tagMode && String(tagMode).toLowerCase() === "and") {
        bookmarkClauses.push(`b.id IN (
          SELECT bt2.bookmark_id FROM bookmark_tags bt2
          JOIN tags t2 ON t2.id = bt2.tag_id
          WHERE t2.user_id = ? AND LOWER(t2.name) IN (${ph})
          GROUP BY bt2.bookmark_id HAVING COUNT(DISTINCT LOWER(t2.name)) = ?
        )`);
        params.push(userId, ...tagArrLower, tagArrLower.length);
      } else {
        bookmarkClauses.push(`b.id IN (
          SELECT DISTINCT bt2.bookmark_id FROM bookmark_tags bt2
          JOIN tags t2 ON t2.id = bt2.tag_id
          WHERE t2.user_id = ? AND LOWER(t2.name) IN (${ph})
        )`);
        params.push(userId, ...tagArrLower);
      }
    }
  }

  const bookmarkWhere = bookmarkClauses.join(" AND ");

  return db
    .prepare(
      `
      SELECT t.id, t.name, t.color, c.cnt as count
      FROM tags t
      JOIN (
        SELECT bt.tag_id, COUNT(bt.bookmark_id) as cnt
        FROM bookmark_tags bt
        JOIN bookmarks b ON b.id = bt.bookmark_id
        WHERE ${bookmarkWhere}
        GROUP BY bt.tag_id
      ) c ON c.tag_id = t.id
      WHERE t.user_id = ?
      ORDER BY count DESC
    `,
    )
    .all(...params, userId);
}

function listViewFolderIds(db, userId, opts = {}) {
  const { favorites, archived, most_used, tags, tagMode } = opts;
  const isFavoritesView = favorites === true || favorites === "true";
  const isArchivedView = archived === true || archived === "true";
  const isMostUsedView = most_used === true || most_used === "true";

  let query = `
    SELECT DISTINCT b.folder_id
    FROM bookmarks b
    WHERE b.user_id = ? AND b.folder_id IS NOT NULL
  `;
  const params = [userId];

  if (isFavoritesView) {
    query += " AND COALESCE(b.is_favorite, 0) = 1 AND b.is_archived = 0";
  } else if (isArchivedView) {
    query += " AND b.is_archived = 1";
  } else if (isMostUsedView) {
    query += " AND b.click_count > 0 AND b.is_archived = 0";
  } else {
    query += " AND b.is_archived = 0";
  }

  if (tags) {
    const tagArr = String(tags)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagArrLower = tagArr.map((t) => t.toLowerCase());
    if (tagArrLower.length > 0) {
      const ph = tagArrLower.map(() => "?").join(",");
      if (tagMode && String(tagMode).toLowerCase() === "and") {
        query += ` AND b.id IN (
          SELECT bt.bookmark_id FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE t.user_id = ? AND LOWER(t.name) IN (${ph})
          GROUP BY bt.bookmark_id HAVING COUNT(DISTINCT LOWER(t.name)) = ?
        )`;
        params.push(userId, ...tagArrLower, tagArrLower.length);
      } else {
        query += ` AND b.id IN (
          SELECT DISTINCT bt.bookmark_id FROM bookmark_tags bt
          JOIN tags t ON t.id = bt.tag_id
          WHERE t.user_id = ? AND LOWER(t.name) IN (${ph})
        )`;
        params.push(userId, ...tagArrLower);
      }
    }
  }

  return db
    .prepare(query)
    .all(...params)
    .map((r) => r.folder_id);
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

  assertFolderOwnership(db, userId, folder_id);

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
  assertFolderOwnership(db, userId, folder_id);

  // Build dynamic SET clause so explicit nulls (e.g. folder_id: null)
  // actually clear the column instead of being ignored by COALESCE.
  const setFields = [];
  const values = [];
  if (title !== undefined) {
    setFields.push("title = ?");
    values.push(title);
  }
  if (url !== undefined) {
    setFields.push("url = ?");
    values.push(url);
  }
  if (description !== undefined) {
    setFields.push("description = ?");
    values.push(description);
  }
  if (folder_id !== undefined) {
    setFields.push("folder_id = ?");
    values.push(folder_id);
  }
  if (is_favorite !== undefined) {
    setFields.push("is_favorite = ?");
    values.push(is_favorite);
  }
  if (position !== undefined) {
    setFields.push("position = ?");
    values.push(position);
  }
  if (favicon !== undefined) {
    setFields.push("favicon = ?");
    values.push(favicon);
  }
  if (color !== undefined) {
    setFields.push("color = ?");
    values.push(color);
  }
  if (is_archived !== undefined) {
    setFields.push("is_archived = ?");
    values.push(is_archived);
  }
  if (og_image !== undefined) {
    setFields.push("og_image = ?");
    values.push(og_image);
  }

  const sql =
    setFields.length > 0
      ? `UPDATE bookmarks SET ${setFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
      : `UPDATE bookmarks SET updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
  const runValues =
    setFields.length > 0 ? [...values, id, userId] : [id, userId];
  db.prepare(sql).run(...runValues);

  if (tags !== undefined) {
    const tagHelpers = require("../services/tagService");
    if (tags && tags.trim && tags.trim()) {
      const result = tagHelpers.ensureTagsExist(db, userId, tags, {
        returnMap: true,
      });
      const overrides = require("../utils/tagUtils").normalizeTagColorOverrides(
        tag_colors || null,
        result.tagMap,
      );
      tagHelpers.updateBookmarkTags(db, id, result.tagIds, {
        userId,
        colorOverridesByTagId: overrides,
      });
    } else {
      tagHelpers.updateBookmarkTags(db, id, [], { userId });
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

function incrementClick(db, id, userId) {
  return db
    .prepare(
      "UPDATE bookmarks SET click_count = click_count + 1, last_clicked = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    )
    .run(id, userId);
}

module.exports = {
  listBookmarks,
  listViewTags,
  listViewFolderIds,
  getBookmarkById,
  assertFolderOwnership,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  incrementClick,
  deleteAllForUser,
  setThumbnailLocal,
  findBookmarkIdByUrl,
  listUrls,
  getSampleForSuggestion,
  getRecentCountForDomain,
  getMostClickedForDomain,
};
