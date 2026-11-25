/**
 * Tag Helper Functions for Normalized Tag System
 * Manages tags and bookmark-tag relationships
 */

const { v4: uuidv4 } = require("uuid");

function normalizeTagKey(input) {
  return String(input || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function resolveCanonicalTagName(db, userId, input) {
  const name = String(input || "").trim();
  if (!name) return "";
  const aliasKey = normalizeTagKey(name);

  const alias = db
    .prepare(
      "SELECT canonical_name FROM tag_aliases WHERE user_id = ? AND alias_key = ?",
    )
    .get(userId, aliasKey);
  if (alias?.canonical_name) return alias.canonical_name;

  const exact = db
    .prepare(
      "SELECT name FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE",
    )
    .get(userId, name);
  if (exact?.name) return exact.name;

  const variantsStatement = db.prepare(
    "SELECT name FROM tags WHERE user_id = ?",
  );
  const variants =
    typeof variantsStatement.all === "function"
      ? variantsStatement.all(userId)
      : [];
  const normalizedMatch = variants.find(
    (tag) => normalizeTagKey(tag.name) === aliasKey,
  );
  if (normalizedMatch?.name) return normalizedMatch.name;
  return name;
}

function createTagAlias(db, userId, alias, canonicalName) {
  const aliasKey = normalizeTagKey(alias);
  const canonical = String(canonicalName || "").trim();
  if (!aliasKey || !canonical)
    throw new Error("Alias and canonical tag are required");

  const canonicalTag =
    db
      .prepare(
        "SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE",
      )
      .get(userId, canonical) ||
    db
      .prepare("SELECT id FROM tags WHERE user_id = ?")
      .all(userId)
      .find((tag) => normalizeTagKey(tag.name) === normalizeTagKey(canonical));

  const canonicalTagId = canonicalTag?.id || null;
  const id = uuidv4();
  db.prepare(
    `INSERT INTO tag_aliases
     (id, user_id, alias_key, alias, canonical_name, canonical_tag_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, alias_key) DO UPDATE SET
       alias = excluded.alias,
       canonical_name = excluded.canonical_name,
       canonical_tag_id = excluded.canonical_tag_id,
       updated_at = CURRENT_TIMESTAMP`,
  ).run(id, userId, aliasKey, String(alias).trim(), canonical, canonicalTagId);
  return db
    .prepare("SELECT * FROM tag_aliases WHERE user_id = ? AND alias_key = ?")
    .get(userId, aliasKey);
}

function deleteTagAlias(db, userId, id) {
  return db
    .prepare("DELETE FROM tag_aliases WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

function listTagAliases(db, userId) {
  return db
    .prepare(
      "SELECT * FROM tag_aliases WHERE user_id = ? ORDER BY alias COLLATE NOCASE",
    )
    .all(userId);
}

function getTagNormalizationPreview(db, userId) {
  const tags = db
    .prepare(
      `SELECT t.id, t.name,
              COUNT(bt.bookmark_id) AS count
       FROM tags t
       LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY count DESC, t.name COLLATE NOCASE`,
    )
    .all(userId);
  const groups = new Map();
  tags.forEach((tag) => {
    const key = normalizeTagKey(tag.name);
    if (!key) return;
    const group = groups.get(key) || [];
    group.push(tag);
    groups.set(key, group);
  });
  return [...groups.entries()]
    .filter(([, variants]) => variants.length > 1)
    .map(([key, variants]) => {
      const target = [...variants].sort(
        (a, b) =>
          b.count - a.count ||
          a.name.length - b.name.length ||
          a.name.localeCompare(b.name),
      )[0];
      return {
        key,
        target: target.name,
        variants: variants.map((tag) => ({
          id: tag.id,
          name: tag.name,
          count: tag.count,
        })),
      };
    });
}

function normalizeAllExistingTags(db, userId) {
  return db.transaction(() => {
    const preview = getTagNormalizationPreview(db, userId);
    let merged = 0;
    preview.forEach((group) => {
      group.variants.forEach((variant) => {
        if (variant.name === group.target) return;
        const result = renameOrMergeTag(db, userId, variant.name, group.target);
        if (!result.error) merged += 1;
      });
    });
    return { groups: preview.length, merged };
  })();
}

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
    const resolvedName = resolveCanonicalTagName(db, userId, tagName);
    // Check if tag exists (case-insensitive so "React" and "react" resolve to
    // the same tag instead of silently creating duplicates).
    let tag = db
      .prepare(
        "SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE",
      )
      .get(userId, resolvedName);

    if (!tag) {
      // Create new tag
      const tagId = uuidv4();
      db.prepare(
        "INSERT INTO tags (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)",
      ).run(tagId, userId, resolvedName, "#f59e0b", "tag");
      tagIds.push(tagId);
      tagMap[resolvedName] = tagId;
      db.prepare(
        `UPDATE tag_aliases
         SET canonical_tag_id = ?
         WHERE user_id = ? AND canonical_name = ? COLLATE NOCASE`,
      ).run(tagId, userId, resolvedName);
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
 * @param {object} options - Options ({ colorOverridesByTagId, userId })
 */
function updateBookmarkTags(db, bookmarkId, tagIds, options = {}) {
  const colorOverridesByTagId = options.colorOverridesByTagId || {};
  const userId = options.userId;

  if (userId === undefined || userId === null) {
    throw new Error("updateBookmarkTags requires userId for tenant isolation");
  }

  const owner = db
    .prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?")
    .get(bookmarkId, userId);
  if (!owner) return; // Silently skip — bookmark doesn't belong to this user

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
 * @param {string} [userId] - If provided, verify bookmark belongs to this user
 * @returns {string} Comma-separated tag names (empty string if not found/not owned)
 */
function getBookmarkTagsString(db, bookmarkId, userId) {
  // If userId provided, verify ownership first
  if (userId) {
    const owner = db
      .prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?")
      .get(bookmarkId, userId);
    if (!owner) return "";
  }

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
      COUNT(b.id) as count,
      CASE 
        WHEN INSTR(t.name, '/') > 0 
        THEN SUBSTR(t.name, 1, INSTR(t.name, '/') - 1)
        ELSE NULL 
      END as parent
    FROM tags t
    LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
    LEFT JOIN bookmarks b
      ON b.id = bt.bookmark_id
     AND b.user_id = t.user_id
     AND COALESCE(b.is_archived, 0) = 0
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
      SELECT
        t.name,
        COUNT(b.id) AS count,
        COALESCE(SUM(b.click_count), 0) AS click_count_sum,
        COALESCE(SUM(b.is_favorite), 0) AS favorite_count_sum
      FROM tags t
      LEFT JOIN bookmark_tags bt ON bt.tag_id = t.id
      LEFT JOIN bookmarks b
        ON b.id = bt.bookmark_id
       AND b.user_id = ?
       AND COALESCE(b.is_archived, 0) = 0
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
    `,
    )
    .all(userId, userId);
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
    .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE")
    .get(userId, from);
  if (!sourceTag) return { error: "not_found" };

  const destinationTag = db
    .prepare("SELECT * FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE")
    .get(userId, to);

  // Case-only rename (e.g. "react" -> "React"): update the name in place.
  if (destinationTag && destinationTag.id === sourceTag.id) {
    db.prepare(
      "UPDATE tags SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
    ).run(to, sourceTag.id, userId);
    return { updated: sourceRelationsCount(db, sourceTag.id) };
  }

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

function sourceRelationsCount(db, tagId) {
  return db
    .prepare("SELECT COUNT(*) as count FROM bookmark_tags WHERE tag_id = ?")
    .get(tagId).count;
}

module.exports = {
  normalizeTagKey,
  resolveCanonicalTagName,
  createTagAlias,
  deleteTagAlias,
  listTagAliases,
  getTagNormalizationPreview,
  normalizeAllExistingTags,
  ensureTagsExist,
  updateBookmarkTags,
  getBookmarkTagsString,
  getUserTags,
  getTagUsageCounts,
  getTagCooccurrence,
  getTagsForDomain,
  renameOrMergeTag,
};
