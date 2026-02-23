/**
 * Migration 001_fts5_bookmarks
 * Adds full-text search capability for bookmarks using FTS5
 * Note: Removed denormalized bookmarks.tags column - tags are now computed
 * from normalized bookmark_tags + tags tables for FTS
 */

exports.up = function (db) {
  // 1. Drop old triggers that update denormalized tags column
  try {
    db.exec(`
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

  // 3. Recreate FTS with external content (content='bookmarks')
  try {
    db.exec("DROP TABLE IF EXISTS bookmarks_fts");
  } catch (_e) {}

  db.exec(`
    CREATE VIRTUAL TABLE bookmarks_fts USING fts5(
      id UNINDEXED,
      user_id UNINDEXED,
      title,
      url,
      description,
      tags,
      content='bookmarks',
      content_rowid='rowid'
    );
  `);

  // 4. Rebuild FTS index from bookmarks (tags computed from normalized tables)
  db.exec(`INSERT INTO bookmarks_fts(bookmarks_fts) VALUES('rebuild')`);

  // 5. Triggers are created by database.js; migration ensures schema is correct
};
