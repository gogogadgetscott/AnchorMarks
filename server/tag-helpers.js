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
function ensureTagsExist(db, userId, tagsString) {
    if (!tagsString || tagsString.trim() === "") {
        return [];
    }

    const tagNames = tagsString
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

    const tagIds = [];

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
        } else {
            tagIds.push(tag.id);
        }
    }

    return tagIds;
}

/**
 * Update bookmark-tag relationships
 * @param {object} db - Database instance
 * @param {string} bookmarkId - Bookmark ID
 * @param {Array} tagIds - Array of tag IDs
 */
function updateBookmarkTags(db, bookmarkId, tagIds) {
    // Delete existing relationships
    db.prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?").run(bookmarkId);

    // Create new relationships
    if (tagIds && tagIds.length > 0) {
        const stmt = db.prepare(
            "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        );
        for (const tagId of tagIds) {
            stmt.run(bookmarkId, tagId);
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

/**
 * Sync TEXT tags field with normalized tags (for backwards compatibility)
 * @param {object} db - Database instance
 * @param {string} bookmarkId - Bookmark ID
 */
function syncBookmarkTagsText(db, bookmarkId) {
    const tagsString = getBookmarkTagsString(db, bookmarkId);
    db.prepare("UPDATE bookmarks SET tags = ? WHERE id = ?").run(
        tagsString,
        bookmarkId,
    );
}

module.exports = {
    ensureTagsExist,
    updateBookmarkTags,
    getBookmarkTagsString,
    getUserTags,
    syncBookmarkTagsText,
};
