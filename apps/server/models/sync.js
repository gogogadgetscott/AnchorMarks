const { v4: uuidv4 } = require("uuid");

function getStatus(db, userId) {
  const bookmarkCount = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
    .get(userId);
  const folderCount = db
    .prepare("SELECT COUNT(*) as count FROM folders WHERE user_id = ?")
    .get(userId);
  const lastUpdated = db
    .prepare("SELECT MAX(updated_at) as last FROM bookmarks WHERE user_id = ?")
    .get(userId);

  return {
    bookmarks: bookmarkCount.count,
    folders: folderCount.count,
    last_updated: lastUpdated.last,
  };
}

function push(db, userId, { bookmarks = [], folders = [] }) {
  const results = { created: 0, updated: 0, errors: [] };

  if (folders && folders.length) {
    for (const folder of folders) {
      try {
        const existing = db
          .prepare("SELECT * FROM folders WHERE id = ? AND user_id = ?")
          .get(folder.id, userId);

        if (existing) {
          db.prepare(
            "UPDATE folders SET name = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).run(folder.name, folder.color, folder.parent_id, folder.id);
          results.updated++;
        } else {
          db.prepare(
            "INSERT INTO folders (id, user_id, name, color, parent_id) VALUES (?, ?, ?, ?, ?)",
          ).run(
            folder.id || uuidv4(),
            userId,
            folder.name,
            folder.color || "#6366f1",
            folder.parent_id,
          );
          results.created++;
        }
      } catch (err) {
        results.errors.push({ folder: folder.name, error: err.message });
      }
    }
  }

  if (bookmarks && bookmarks.length) {
    for (const bm of bookmarks) {
      try {
        const existing = db
          .prepare("SELECT * FROM bookmarks WHERE url = ? AND user_id = ?")
          .get(bm.url, userId);

        if (existing) {
          db.prepare(
            "UPDATE bookmarks SET title = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          ).run(bm.title, bm.folder_id, existing.id);
          if (bm.tags) {
            const tagsString = Array.isArray(bm.tags)
              ? bm.tags.join(",")
              : bm.tags;
            const tagIds = require("../helpers/tag-helpers").ensureTagsExist(
              db,
              userId,
              tagsString,
            );
            require("../helpers/tag-helpers").updateBookmarkTags(
              db,
              existing.id,
              tagIds,
            );
          }
          results.updated++;
        } else {
          const id = uuidv4();
          const faviconUrl = null;

          db.prepare(
            "INSERT INTO bookmarks (id, user_id, folder_id, title, url, favicon) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(
            id,
            userId,
            bm.folder_id,
            bm.title || bm.url,
            bm.url,
            faviconUrl,
          );

          if (bm.tags) {
            const tagsString = Array.isArray(bm.tags)
              ? bm.tags.join(",")
              : bm.tags;
            const tagIds = require("../helpers/tag-helpers").ensureTagsExist(
              db,
              userId,
              tagsString,
            );
            require("../helpers/tag-helpers").updateBookmarkTags(
              db,
              id,
              tagIds,
            );
          }

          // Trigger favicon fetch is handled by app layer; model returns created ids for caller to act on
          results.created++;
        }
      } catch (err) {
        results.errors.push({ url: bm.url, error: err.message });
      }
    }
  }

  return results;
}

function pull(db, userId) {
  const bookmarks = db
    .prepare(
      `
    SELECT 
      b.*, 
      COALESCE(tags_joined.tags, '') as tags,
      COALESCE(tags_joined.tags_detailed, '[]') as tags_detailed
    FROM bookmarks b
    LEFT JOIN (
      SELECT bt.bookmark_id,
             GROUP_CONCAT(t.name, ', ') as tags,
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
    ) tags_joined ON tags_joined.bookmark_id = b.id
    WHERE b.user_id = ?
    ORDER BY b.position
  `,
    )
    .all(userId, userId);

  const folders = db
    .prepare("SELECT * FROM folders WHERE user_id = ? ORDER BY position")
    .all(userId);

  return { bookmarks, folders };
}

module.exports = { getStatus, push, pull };
