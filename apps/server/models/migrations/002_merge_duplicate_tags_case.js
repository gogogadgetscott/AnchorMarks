/**
 * Migration 002_merge_duplicate_tags_case
 *
 * Merges tags that differ only by case (e.g. "React" and "react").
 *
 * Background: tag lookups/creation used to be case-sensitive while tag
 * filtering is case-insensitive, so a user could end up with duplicate tags
 * that split the bookmark counts across two sidebar entries. This migration
 * consolidates each case-insensitive group into a single canonical tag
 * (the one with the shortest name, then lowest position/created_at) and
 * re-points every bookmark_tags row at it.
 */

exports.up = function (db) {
  const groups = db
    .prepare(
      `
      SELECT user_id, LOWER(name) AS lname
      FROM tags
      GROUP BY user_id, LOWER(name)
      HAVING COUNT(*) > 1
    `,
    )
    .all();

  const findByGroup = db.prepare(
    `
      SELECT id, name, position, created_at
      FROM tags
      WHERE user_id = ? AND name = ? COLLATE NOCASE
      ORDER BY length(name), position, created_at
    `,
  );

  const moveRelations = db.prepare(
    `
      INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id, color_override)
      SELECT bookmark_id, ?, color_override
      FROM bookmark_tags
      WHERE tag_id = ?
    `,
  );

  const deleteRelations = db.prepare(
    "DELETE FROM bookmark_tags WHERE tag_id = ?",
  );
  const deleteTag = db.prepare("DELETE FROM tags WHERE id = ? AND user_id = ?");

  for (const group of groups) {
    const tags = findByGroup.all(group.user_id, group.lname);
    if (tags.length < 2) continue;

    const keep = tags[0];
    const duplicates = tags.slice(1);

    for (const dup of duplicates) {
      moveRelations.run(keep.id, dup.id);
      deleteRelations.run(dup.id);
      deleteTag.run(dup.id, group.user_id);
    }
  }
};
