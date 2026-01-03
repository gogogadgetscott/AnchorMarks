const { v4: uuidv4 } = require("uuid");

function importJson(db, userId, { bookmarks = [], folders = [] } = {}) {
  const imported = [];
  let skipped = 0;
  const importLog = [];
  const folderIdMap = new Map();

  const ensureFolder = (folder) => {
    if (folderIdMap.has(folder.id)) return folderIdMap.get(folder.id);

    const mappedParent = folder.parent_id
      ? folderIdMap.get(folder.parent_id) || null
      : null;

    const existing = db
      .prepare(
        "SELECT id FROM folders WHERE user_id = ? AND name = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
      )
      .get(userId, folder.name, mappedParent, mappedParent);

    if (existing) {
      folderIdMap.set(folder.id, existing.id);
      return existing.id;
    }

    const maxPos = db
      .prepare(
        "SELECT MAX(position) as max FROM folders WHERE user_id = ? AND (parent_id = ? OR (? IS NULL AND parent_id IS NULL))",
      )
      .get(userId, mappedParent, mappedParent);
    const position = (maxPos.max || 0) + 1;

    const newId = uuidv4();
    db.prepare(
      "INSERT INTO folders (id, user_id, parent_id, name, color, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      newId,
      userId,
      mappedParent,
      folder.name || "Imported",
      folder.color || "#6366f1",
      folder.icon || "folder",
      position,
    );

    folderIdMap.set(folder.id, newId);
    return newId;
  };

  // Insert folders in dependency-safe order
  const pending = [...folders];
  let guard = 0;
  console.log(`[Import] Starting folder insertion for ${pending.length} folders`);
  while (pending.length && guard < 1000) {
    const next = pending.shift();
    const parentMapped = next.parent_id
      ? folderIdMap.get(next.parent_id)
      : null;
      
    if (
      next.parent_id &&
      next.parent_id !== null &&
      parentMapped === undefined
    ) {
      console.log(`[Import] Re-queueing folder "${next.name}" (waiting for parent ${next.parent_id})`);
      pending.push(next);
    } else {
      const newId = ensureFolder(next);
      console.log(`[Import] Inserted folder "${next.name}" (Original ID: ${next.id}, New ID: ${newId}, Parent: ${parentMapped})`);
    }
    guard++;
  }
  if (pending.length > 0) {
    console.warn(`[Import] Failed to insert ${pending.length} folders due to missing parents after 1000 attempts.`);
  }

  const today = new Date();
  const importTag = `import-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  for (const bm of bookmarks) {
    const id = uuidv4();
    const faviconUrl = null;

    const mappedFolder = bm.folder_id
      ? folderIdMap.get(bm.folder_id) || null
      : null;

    const existing = db
      .prepare("SELECT id FROM bookmarks WHERE user_id = ? AND url = ?")
      .get(userId, bm.url);

    if (existing) {
      skipped++;
      importLog.push({ url: bm.url, status: "skipped", reason: "duplicate" });
      continue;
    }

    db.prepare(
      "INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      id,
      userId,
      mappedFolder,
      bm.title || bm.url,
      bm.url,
      bm.description || null,
      faviconUrl,
      bm.color || null,
    );

    let tagList = [];
    if (bm.tags) {
      if (Array.isArray(bm.tags)) {
        tagList = bm.tags;
      } else {
        tagList = bm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
    if (!tagList.includes(importTag)) {
      tagList.push(importTag);
    }

    const normalizedTags = tagList.join(",");
    if (normalizedTags) {
      const tagHelpers = require("../helpers/tag-helpers");
      const tagIds = tagHelpers.ensureTagsExist(db, userId, normalizedTags);
      tagHelpers.updateBookmarkTags(db, id, tagIds);
    }

    imported.push({ id, url: bm.url, title: bm.title, tags: normalizedTags });
    importLog.push({ url: bm.url, status: "imported" });
  }

  return {
    imported,
    skipped,
    importLog,
    folders: Array.from(folderIdMap.values()),
  };
}

function exportData(db, userId) {
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
  `,
    )
    .all(userId, userId);

  const folders = db
    .prepare("SELECT * FROM folders WHERE user_id = ?")
    .all(userId);

  return { bookmarks, folders };
}

module.exports = { importJson, exportData };
