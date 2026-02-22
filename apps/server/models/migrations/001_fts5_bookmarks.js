/**
 * Migration 001_fts5_bookmarks
 * Adds full-text search capability for bookmarks using FTS5
 */

exports.up = function (db) {
  // 1. Ensure bookmarks has tags column (denormalized for FTS external content)
  try {
    db.prepare("ALTER TABLE bookmarks ADD COLUMN tags TEXT DEFAULT ''").run();
  } catch (_e) {
    /* column may already exist */
  }

  // 2. Populate tags from bookmark_tags for existing rows
  db.exec(`
    UPDATE bookmarks SET tags = (
      SELECT COALESCE(GROUP_CONCAT(t.name, ', '), '')
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      WHERE bt.bookmark_id = bookmarks.id
    );
  `);

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

  // 4. Rebuild FTS index from bookmarks
  db.exec(`INSERT INTO bookmarks_fts(bookmarks_fts) VALUES('rebuild')`);

  // 5. Triggers are created by database.js; migration ensures schema is correct
};
