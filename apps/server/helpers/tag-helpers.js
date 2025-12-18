/**
 * Tag Helper Functions for Normalized Tag System
 * Manages tags and bookmark-tag relationships
 */

const { v4: uuidv4 } = require("uuid");

/**
 * Parse tag string (comma-separated) and ensure all tags exist
 * @param {object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} tagsString - Comma-separated tag names
 * @returns {Array} Array of tag IDs
 */
function ensureTagsExist(db, userId, tagsInput, options = {}) {
  const returnMap = options.returnMap === true;

  if (
    !tagsInput ||
    (typeof tagsInput === "string" && tagsInput.trim() === "") ||
    (Array.isArray(tagsInput) && tagsInput.length === 0)
  ) {
    return returnMap ? { tagIds: [], tagMap: {} } : [];
  }

  const tagNames = Array.isArray(tagsInput)
    ? tagsInput.map((t) => String(t))
    : tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

  const tagIds = [];
  const tagMap = {};

  for (const tagName of tagNames) {
    // Check if tag exists
    let tag = db
      .prepare("SELECT id FROM tags WHERE user_id = ? AND name = ?")
      .get(userId, tagName);

    if (!tag) {
      // Create new tag
      const tagId = uuidv4();
      db.prepare(
        "INSERT INTO tags (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)",
      ).run(tagId, userId, tagName, "#f59e0b", "tag");
      tagIds.push(tagId);
      tagMap[tagName] = tagId;
    } else {
      tagIds.push(tag.id);
      tagMap[tagName] = tag.id;
    }
  }

  return returnMap ? { tagIds, tagMap } : tagIds;
}

/**
 * Update bookmark-tag relationships
 * @param {object} db - Database instance
 * @param {string} bookmarkId - Bookmark ID
 * @param {Array} tagIds - Array of tag IDs
 */
function updateBookmarkTags(db, bookmarkId, tagIds, options = {}) {
  const colorOverridesByTagId = options.colorOverridesByTagId || {};
  // Delete existing relationships
  db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(bookmarkId);

  // Create new relationships
  if (tagIds && tagIds.length > 0) {
    const stmt = db.prepare(
      "INSERT INTO bookmark_tags (bookmark_id, tag_id, color_override) VALUES (?, ?, ?)",
    );
    for (const tagId of tagIds) {
      const override = colorOverridesByTagId[tagId] || null;
      stmt.run(bookmarkId, tagId, override);
    }
  }
}

/**
 * Get tags for a bookmark as comma-separated string
 * @param {object} db - Database instance
 * @param {string} bookmarkId - Bookmark ID
 * @returns {string} Comma-separated tag names
 */
function getBookmarkTagsString(db, bookmarkId) {
  const tags = db
    .prepare(
      `
    SELECT t.name
    FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
    ORDER BY t.name
  `,
    )
    .all(bookmarkId);

  return tags.map((t) => t.name).join(", ");
}

/**
 * Get all tags for a user with bookmark counts
 * @param {object} db - Database instance
 * @param {string} userId - User ID
 * @returns {Array} Array of tags with metadata
 */
function getUserTags(db, userId) {
  return db
    .prepare(
      `
    SELECT 
      t.*,
      COUNT(bt.bookmark_id) as count,
      CASE 
        WHEN INSTR(t.name, '/') > 0 
        THEN SUBSTR(t.name, 1, INSTR(t.name, '/') - 1)
        ELSE NULL 
      END as parent
    FROM tags t
    LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE t.user_id = ?
    GROUP BY t.id
    ORDER BY t.position, t.name
  `,
    )
    .all(userId);
}

function getTagUsageCounts(db, userId) {
  return db
    .prepare(
      `
      SELECT t.name, COUNT(bt.tag_id) as count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
    `,
    )
    .all(userId);
}

function getTagCooccurrence(db, userId) {
  return db
    .prepare(
      `
      SELECT 
        t1.name AS tag_name_a,
        t2.name AS tag_name_b,
        COUNT(*) AS count
      FROM bookmark_tags bt1
      JOIN bookmark_tags bt2 ON bt1.bookmark_id = bt2.bookmark_id AND bt1.tag_id < bt2.tag_id
      JOIN tags t1 ON t1.id = bt1.tag_id
      JOIN tags t2 ON t2.id = bt2.tag_id
      WHERE t1.user_id = ? AND t2.user_id = ?
      GROUP BY bt1.tag_id, bt2.tag_id
      ORDER BY count DESC
    `,
    )
    .all(userId, userId);
}

function getTagsForDomain(db, userId, domain) {
  return db
    .prepare(
      `
      SELECT DISTINCT t.name as tag
      FROM bookmarks b
      JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      JOIN tags t ON t.id = bt.tag_id
      WHERE b.user_id = ? AND b.url LIKE ?
    `,
    )
    .all(userId, `%${domain}%`)
    .map((r) => r.tag);
}

function renameOrMergeTag(db, userId, from, to) {
  const sourceTag = db
    .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
    .get(userId, from);
  if (!sourceTag) return { error: "not_found" };

  const destinationTag = db
    .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ?")
    .get(userId, to);
  const sourceRelations = db
    .prepare(
      "SELECT bookmark_id, color_override FROM bookmark_tags WHERE tag_id = ?",
    )
    .all(sourceTag.id);
  let updated = 0;

  const runMerge = db.transaction(() => {
    if (destinationTag) {
      const insertRel = db.prepare(
        "INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id, color_override) VALUES (?, ?, ?)",
      );
      sourceRelations.forEach((rel) => {
        const info = insertRel.run(
          rel.bookmark_id,
          destinationTag.id,
          rel.color_override || null,
        );
        if (info.changes > 0) updated += 1;
      });
      db.prepare("DELETE FROM bookmark_tags WHERE tag_id = ?").run(
        sourceTag.id,
      );
      db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?").run(
        sourceTag.id,
        userId,
      );
    } else {
      db.prepare(
        "UPDATE tags SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      ).run(to, sourceTag.id, userId);
      updated = sourceRelations.length;
    }
  });

  runMerge();
  return { updated };
}

module.exports = {
  ensureTagsExist,
  updateBookmarkTags,
  getBookmarkTagsString,
  getUserTags,
  getTagUsageCounts,
  getTagCooccurrence,
  getTagsForDomain,
  renameOrMergeTag,
};
