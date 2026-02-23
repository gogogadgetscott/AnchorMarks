/**
 * Migration 001_fts5_bookmarks
 * Adds full-text search capability for bookmarks using standalone FTS5.
 * Removes denormalized bookmarks.tags column - tags are computed from
 * normalized bookmark_tags + tags tables and stored in the FTS index.
 */

exports.up = function (db) {
  // 1. Drop old triggers (will be recreated by database.js after migrations)
  try {
    db.exec(`
      DROP TRIGGER IF EXISTS bookmarks_fts_insert;
      DROP TRIGGER IF EXISTS bookmarks_fts_delete;
      DROP TRIGGER IF EXISTS bookmarks_fts_update;
      DROP TRIGGER IF EXISTS bookmark_tags_sync_insert;
      DROP TRIGGER IF EXISTS bookmark_tags_sync_delete;
      DROP TRIGGER IF EXISTS tags_sync_update;
    `);
  } catch (_e) {}

  // 2. Remove denormalized tags column if it exists (was used for FTS)
  try {
    db.exec("ALTER TABLE bookmarks DROP COLUMN tags");
  } catch (_e) {
    /* column may not exist */
  }

  // 3. Recreate FTS as standalone table (no content= reference)
  try {
    db.exec("DROP TABLE IF EXISTS bookmarks_fts");
  } catch (_e) {}

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
      id UNINDEXED,
      user_id UNINDEXED,
      title,
      url,
      description,
      tags
    );
  `);

  // 4. Populate FTS index from bookmarks (tags computed from normalized tables)
  db.exec(`
    INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
    SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
           COALESCE((SELECT GROUP_CONCAT(t.name, ', ')
                    FROM bookmark_tags bt
                    JOIN tags t ON t.id = bt.tag_id
                    WHERE bt.bookmark_id = b.id), '')
    FROM bookmarks b
  `);

  // 5. Triggers are created by database.js after migration runner completes
};
