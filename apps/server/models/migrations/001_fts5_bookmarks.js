/**
 * Migration 001_fts5_bookmarks
 * Adds full-text search capability for bookmarks using FTS5
 */

exports.up = function (db) {
  // 1. Create the virtual FTS5 table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
      id UNINDEXED, -- UUID, not used for matching words
      user_id UNINDEXED, -- Tenant isolation
      title,
      url,
      description,
      tags,
      content='bookmarks',
      content_rowid='rowid'
    );
  `);

  // 2. Populate existing data into the FTS table
  db.exec(`
    INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
    SELECT 
      b.rowid, b.id, b.user_id, b.title, b.url, b.description, COALESCE(tg.tags_joined, '') as tags
    FROM bookmarks b
    LEFT JOIN (
      SELECT bt.bookmark_id, GROUP_CONCAT(t.name, ', ') as tags_joined
      FROM bookmark_tags bt
      JOIN tags t ON t.id = bt.tag_id
      GROUP BY bt.bookmark_id
    ) tg ON tg.bookmark_id = b.id;
  `);

  // 3. Create triggers to keep the FTS table synchronized with the bookmarks table natively

  // Trigger: After Insert
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bookmarks_fts_insert AFTER INSERT ON bookmarks
    BEGIN
      INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
      VALUES (new.rowid, new.id, new.user_id, new.title, new.url, new.description, '');
    END;
  `);

  // Trigger: After Delete
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bookmarks_fts_delete AFTER DELETE ON bookmarks
    BEGIN
      INSERT INTO bookmarks_fts (bookmarks_fts, rowid, id, user_id, title, url, description, tags)
      VALUES ('delete', old.rowid, old.id, old.user_id, old.title, old.url, old.description, 
        (SELECT GROUP_CONCAT(t.name, ', ') 
         FROM bookmark_tags bt 
         JOIN tags t ON t.id = bt.tag_id 
         WHERE bt.bookmark_id = old.id));
    END;
  `);

  // Trigger: After Update
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bookmarks_fts_update AFTER UPDATE ON bookmarks
    BEGIN
      -- Delete the old row from the FTS index
      INSERT INTO bookmarks_fts (bookmarks_fts, rowid, id, user_id, title, url, description, tags)
      VALUES ('delete', old.rowid, old.id, old.user_id, old.title, old.url, old.description, 
        (SELECT GROUP_CONCAT(t.name, ', ') 
         FROM bookmark_tags bt 
         JOIN tags t ON t.id = bt.tag_id 
         WHERE bt.bookmark_id = old.id));
      
      -- Insert the new row into the FTS index
      INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
      VALUES (new.rowid, new.id, new.user_id, new.title, new.url, new.description, 
        (SELECT GROUP_CONCAT(t.name, ', ') 
         FROM bookmark_tags bt 
         JOIN tags t ON t.id = bt.tag_id 
         WHERE bt.bookmark_id = new.id));
    END;
  `);

  // Triggers for syncing Tag additions and removals dynamically

  // Trigger: Tag Link Added
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bookmark_tags_insert AFTER INSERT ON bookmark_tags
    BEGIN
      -- Update FTS by removing old representation
      INSERT INTO bookmarks_fts (bookmarks_fts, rowid, id, user_id, title, url, description, tags)
      SELECT 'delete', b.rowid, b.id, b.user_id, b.title, b.url, b.description,
        (SELECT GROUP_CONCAT(t2.name, ', ') 
         FROM bookmark_tags bt2 
         JOIN tags t2 ON t2.id = bt2.tag_id 
         WHERE bt2.bookmark_id = new.bookmark_id AND bt2.tag_id != new.tag_id)
      FROM bookmarks b WHERE b.id = new.bookmark_id;

      -- Inserting new representation
      INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
      SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
        (SELECT GROUP_CONCAT(t2.name, ', ') 
         FROM bookmark_tags bt2 
         JOIN tags t2 ON t2.id = bt2.tag_id 
         WHERE bt2.bookmark_id = new.bookmark_id)
      FROM bookmarks b WHERE b.id = new.bookmark_id;
    END;
  `);

  // Trigger: Tag Link Removed
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS bookmark_tags_delete AFTER DELETE ON bookmark_tags
    BEGIN
      -- Update FTS by removing old representation
      INSERT INTO bookmarks_fts (bookmarks_fts, rowid, id, user_id, title, url, description, tags)
      SELECT 'delete', b.rowid, b.id, b.user_id, b.title, b.url, b.description,
        (SELECT GROUP_CONCAT(t2.name, ', ') 
         FROM bookmark_tags bt2 
         JOIN tags t2 ON t2.id = bt2.tag_id 
         WHERE bt2.bookmark_id = old.bookmark_id
         UNION SELECT name FROM tags WHERE id = old.tag_id)
      FROM bookmarks b WHERE b.id = old.bookmark_id;

      -- Inserting new representation
      INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
      SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
        (SELECT GROUP_CONCAT(t2.name, ', ') 
         FROM bookmark_tags bt2 
         JOIN tags t2 ON t2.id = bt2.tag_id 
         WHERE bt2.bookmark_id = old.bookmark_id)
      FROM bookmarks b WHERE b.id = old.bookmark_id;
    END;
  `);

  // Trigger: Tag Renamed
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS tags_update AFTER UPDATE OF name ON tags
    BEGIN
      -- Delete the old row from the FTS index for all bookmarks linked to this tag
      INSERT INTO bookmarks_fts (bookmarks_fts, rowid, id, user_id, title, url, description, tags)
      SELECT 'delete', b.rowid, b.id, b.user_id, b.title, b.url, b.description,
        (SELECT GROUP_CONCAT(
           CASE WHEN t2.id = old.id THEN old.name ELSE t2.name END, ', '
         ) 
         FROM bookmark_tags bt2 
         JOIN tags t2 ON t2.id = bt2.tag_id 
         WHERE bt2.bookmark_id = b.id)
      FROM bookmarks b
      JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      WHERE bt.tag_id = new.id;
      
      -- Insert the new representation
      INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
      SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
        (SELECT GROUP_CONCAT(t2.name, ', ') 
         FROM bookmark_tags bt2 
         JOIN tags t2 ON t2.id = bt2.tag_id 
         WHERE bt2.bookmark_id = b.id)
      FROM bookmarks b
      JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      WHERE bt.tag_id = new.id;
    END;
  `);
};
