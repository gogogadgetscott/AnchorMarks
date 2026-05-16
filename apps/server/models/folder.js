// Folder model helpers

function parseMeta(row) {
  if (!row) return row;
  if (row.metadata && typeof row.metadata === "string") {
    try {
      row.metadata = JSON.parse(row.metadata);
    } catch {
      row.metadata = null;
    }
  }
  return row;
}

function listFolders(db, userId) {
  const rows = db
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
  return rows.map(parseMeta);
}

function getFolderById(db, id, userId) {
  if (userId === undefined || userId === null) {
    throw new Error("getFolderById requires userId for tenant isolation");
  }
  const row = db
    .prepare("SELECT * FROM folders WHERE id = ? AND user_id = ?")
    .get(id, userId);
  return parseMeta(row) || null;
}

function updateFolder(db, id, userId, fields) {
  // Build the SET clause dynamically to support clearing fields to NULL.
  // COALESCE(?, col) cannot set a column to NULL, so we use explicit logic.
  const sets = [];
  const params = [];

  if (fields.name !== undefined) {
    sets.push("name = ?");
    params.push(fields.name);
  }
  // parent_id uses a sentinel: undefined = don't touch, null = move to top level, string = new parent
  if ("parent_id" in fields) {
    sets.push("parent_id = ?");
    params.push(fields.parent_id ?? null);
  }
  if (fields.color !== undefined) {
    sets.push("color = ?");
    params.push(fields.color);
  }
  if (fields.icon !== undefined) {
    sets.push("icon = ?");
    params.push(fields.icon);
  }
  if (fields.position !== undefined) {
    sets.push("position = ?");
    params.push(fields.position);
  }
  if ("metadata" in fields) {
    sets.push("metadata = ?");
    params.push(fields.metadata != null ? JSON.stringify(fields.metadata) : null);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id, userId);

  db.prepare(
    `UPDATE folders SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
  ).run(...params);
}

// Walk the ancestor chain of `nodeId` and return true if `ancestorId` appears
// anywhere in it, which would indicate a circular reference.
function wouldCreateCycle(db, folderId, newParentId, userId) {
  let current = newParentId;
  const visited = new Set();
  while (current != null) {
    if (current === folderId) return true;
    if (visited.has(current)) break; // safety: break on unexpected cycle
    visited.add(current);
    const row = db
      .prepare(
        "SELECT parent_id FROM folders WHERE id = ? AND user_id = ?",
      )
      .get(current, userId);
    if (!row) break;
    current = row.parent_id;
  }
  return false;
}

// Explicitly set (or clear) the parent of a folder.
// Returns an error string on failure, null on success.
function setFolderParent(db, id, userId, newParentId) {
  if (newParentId === id) return "A folder cannot be its own parent";

  if (newParentId != null) {
    const parent = db
      .prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?")
      .get(newParentId, userId);

    if (!parent) return "Parent folder not found";

    if (wouldCreateCycle(db, id, newParentId, userId)) {
      return "Cannot move a folder into one of its own subfolders";
    }
  }

  db.prepare(
    "UPDATE folders SET parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
  ).run(newParentId ?? null, id, userId);

  return null;
}

// Bulk-move an array of folder ids to a new parent (or top level).
// Runs inside a transaction. Returns { moved, errors }.
function bulkUpdateParents(db, ids, userId, newParentId) {
  const moved = [];
  const errors = [];

  const doWork = db.transaction(() => {
    for (const id of ids) {
      const err = setFolderParent(db, id, userId, newParentId ?? null);
      if (err) {
        errors.push({ id, error: err });
      } else {
        moved.push(id);
      }
    }
  });

  doWork();
  return { moved, errors };
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
  metadata = null,
) {
  return db
    .prepare(
      "INSERT INTO folders (id, user_id, parent_id, name, color, icon, position, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      id,
      userId,
      parentId,
      name,
      color,
      icon,
      position,
      metadata != null ? JSON.stringify(metadata) : null,
    );
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
  setFolderParent,
  bulkUpdateParents,
  deleteFolder,
  deleteAllForUser,
  createFolder,
  ensureFolder,
};
