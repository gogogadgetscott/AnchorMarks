const { v4: uuidv4 } = require("uuid");
const { logger } = require("../lib/logger");

/**
 * Parse a timestamp (ISO or SQLite datetime) to ms. Returns NaN if invalid.
 */
function parseTimestamp(ts) {
  if (ts == null || ts === "") return NaN;
  const t = typeof ts === "string" ? ts.trim() : ts;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Last-write-wins: apply client change only if client is newer or equal, or client sent no timestamp (backward compat).
 * Returns true if server should apply the update.
 */
function shouldApplyClientUpdate(clientUpdatedAt, serverUpdatedAt) {
  const clientMs = parseTimestamp(clientUpdatedAt);
  const serverMs = parseTimestamp(serverUpdatedAt);
  if (Number.isNaN(clientMs)) return true; // no client timestamp -> apply (backward compat)
  if (Number.isNaN(serverMs)) return true; // no server timestamp -> apply
  return clientMs >= serverMs;
}

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
  const results = {
    created: 0,
    updated: 0,
    errors: [],
    folder_id_map: {},
    bookmarks_skipped: 0,
    folders_skipped: 0,
  };
  /** Map client-provided folder id -> server-generated id for folders created in this push */
  const clientFolderIdToServerId = {};

  if (folders && folders.length) {
    for (const folder of folders) {
      try {
        const existing = db
          .prepare("SELECT * FROM folders WHERE id = ? AND user_id = ?")
          .get(folder.id, userId);

        if (existing) {
          if (
            !shouldApplyClientUpdate(folder.updated_at, existing.updated_at)
          ) {
            results.folders_skipped++;
            continue;
          }
          const resolvedParentId =
            folder.parent_id != null &&
            clientFolderIdToServerId[folder.parent_id] !== undefined
              ? clientFolderIdToServerId[folder.parent_id]
              : folder.parent_id;
          db.prepare(
            "UPDATE folders SET name = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
          ).run(folder.name, folder.color, resolvedParentId, folder.id, userId);
          results.updated++;
        } else {
          const serverFolderId = uuidv4();
          const resolvedParentId =
            folder.parent_id != null &&
            clientFolderIdToServerId[folder.parent_id] !== undefined
              ? clientFolderIdToServerId[folder.parent_id]
              : folder.parent_id;
          db.prepare(
            "INSERT INTO folders (id, user_id, name, color, parent_id) VALUES (?, ?, ?, ?, ?)",
          ).run(
            serverFolderId,
            userId,
            folder.name,
            folder.color || "#6366f1",
            resolvedParentId,
          );
          clientFolderIdToServerId[folder.id] = serverFolderId;
          results.folder_id_map[folder.id] = serverFolderId;
          results.created++;
        }
      } catch (err) {
        logger.error("Sync push folder failed", err, { folder: folder.name });
        results.errors.push({ folder: folder.name, error: "Sync failed" });
      }
    }
  }

  const resolveFolderId = (clientId) =>
    clientFolderIdToServerId[clientId] !== undefined
      ? clientFolderIdToServerId[clientId]
      : clientId;

  if (bookmarks && bookmarks.length) {
    for (const bm of bookmarks) {
      try {
        const existing = db
          .prepare("SELECT * FROM bookmarks WHERE url = ? AND user_id = ?")
          .get(bm.url, userId);

        if (existing) {
          if (!shouldApplyClientUpdate(bm.updated_at, existing.updated_at)) {
            results.bookmarks_skipped++;
            continue;
          }
          const resolvedFolderId = resolveFolderId(bm.folder_id);
          db.prepare(
            "UPDATE bookmarks SET title = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
          ).run(bm.title, resolvedFolderId, existing.id, userId);
          if (bm.tags) {
            const tagsString = Array.isArray(bm.tags)
              ? bm.tags.join(",")
              : bm.tags;
            const tagIds = require("../services/tagService").ensureTagsExist(
              db,
              userId,
              tagsString,
            );
            require("../services/tagService").updateBookmarkTags(
              db,
              existing.id,
              tagIds,
            );
          }
          results.updated++;
        } else {
          const id = uuidv4();
          const faviconUrl = null;
          const resolvedFolderId = resolveFolderId(bm.folder_id);

          db.prepare(
            "INSERT INTO bookmarks (id, user_id, folder_id, title, url, favicon) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(
            id,
            userId,
            resolvedFolderId,
            bm.title || bm.url,
            bm.url,
            faviconUrl,
          );

          if (bm.tags) {
            const tagsString = Array.isArray(bm.tags)
              ? bm.tags.join(",")
              : bm.tags;
            const tagIds = require("../services/tagService").ensureTagsExist(
              db,
              userId,
              tagsString,
            );
            require("../services/tagService").updateBookmarkTags(
              db,
              id,
              tagIds,
            );
          }

          // Trigger favicon fetch is handled by app layer; model returns created ids for caller to act on
          results.created++;
        }
      } catch (err) {
        logger.error("Sync push bookmark failed", err, { url: bm.url });
        results.errors.push({ url: bm.url, error: "Sync failed" });
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
