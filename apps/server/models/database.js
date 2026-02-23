const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function initializeDatabase(DB_PATH) {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  let db;
  try {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        api_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT 'folder',
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        folder_id TEXT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        favicon TEXT,
        favicon_local TEXT,
        thumbnail_local TEXT,
        og_image TEXT,
        position INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        last_clicked DATETIME,
        is_dead INTEGER DEFAULT 0,
        last_checked DATETIME,
        content_type TEXT,
        is_archived INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_archived ON bookmarks(user_id, is_archived);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_favorite ON bookmarks(user_id, is_favorite, is_archived);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_clicked ON bookmarks(user_id, click_count DESC, last_clicked DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_title ON bookmarks(user_id, title);
      CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

      CREATE TABLE IF NOT EXISTS smart_collections (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT DEFAULT 'filter',
        color TEXT DEFAULT '#6366f1',
        filters TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        view_mode TEXT DEFAULT 'grid',
        hide_favicons INTEGER DEFAULT 0,
        hide_sidebar INTEGER DEFAULT 0,
        ai_suggestions_enabled INTEGER DEFAULT 1,
        theme TEXT DEFAULT 'light',
        rich_link_previews_enabled INTEGER DEFAULT 0,
        dashboard_mode TEXT DEFAULT 'folder',
        dashboard_tags TEXT,
        dashboard_sort TEXT DEFAULT 'updated_desc',
        widget_order TEXT,
        collapsed_sections TEXT,
        settings_json TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#f59e0b',
        icon TEXT DEFAULT 'tag',
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, name)
      );

      CREATE TABLE IF NOT EXISTS bookmark_tags (
        bookmark_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        color_override TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (bookmark_id, tag_id),
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
      CREATE INDEX IF NOT EXISTS idx_bookmark_tags_tag ON bookmark_tags(tag_id);
      CREATE TABLE IF NOT EXISTS dashboard_views (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_dashboard_views_user ON dashboard_views(user_id);

      CREATE TABLE IF NOT EXISTS bookmark_views (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_bookmark_views_user ON bookmark_views(user_id);
      
      -- INITIALIZE VIRTUAL FTS5 TABLE AND SYSTEM TRIGGERS --
    `);

    // Robust FTS5 Check: Recreate if 'id' column is missing
    let recreateFts = false;
    try {
      const columns = db.prepare("PRAGMA table_info(bookmarks_fts)").all();
      if (columns.length > 0 && !columns.some((c) => c.name === "id")) {
        console.log(
          "Detecting old bookmarks_fts schema (missing id), recreating...",
        );
        recreateFts = true;
      }
    } catch (_e) {}

    if (recreateFts) {
      db.exec("DROP TABLE bookmarks_fts");
    }

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
        id UNINDEXED,
        user_id UNINDEXED,
        title,
        url,
        description,
        tags,
        content='bookmarks',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS bookmarks_fts_insert AFTER INSERT ON bookmarks
      BEGIN
        INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
        VALUES (
          new.rowid, new.id, new.user_id, new.title, new.url, new.description,
          COALESCE((SELECT GROUP_CONCAT(t.name, ', ')
                    FROM bookmark_tags bt
                    JOIN tags t ON t.id = bt.tag_id
                    WHERE bt.bookmark_id = new.id), '')
        );
      END;

      CREATE TRIGGER IF NOT EXISTS bookmarks_fts_delete AFTER DELETE ON bookmarks
      BEGIN
        INSERT INTO bookmarks_fts (bookmarks_fts, rowid) VALUES ('delete', old.rowid);
      END;

      CREATE TRIGGER IF NOT EXISTS bookmarks_fts_update AFTER UPDATE ON bookmarks
      BEGIN
        INSERT INTO bookmarks_fts (bookmarks_fts, rowid) VALUES ('delete', old.rowid);
        INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
        VALUES (
          new.rowid, new.id, new.user_id, new.title, new.url, new.description,
          COALESCE((SELECT GROUP_CONCAT(t.name, ', ')
                    FROM bookmark_tags bt
                    JOIN tags t ON t.id = bt.tag_id
                    WHERE bt.bookmark_id = new.id), '')
        );
      END;

      CREATE TRIGGER IF NOT EXISTS bookmark_tags_sync_insert AFTER INSERT ON bookmark_tags
      BEGIN
        INSERT INTO bookmarks_fts (bookmarks_fts, rowid)
        SELECT 'delete', b.rowid FROM bookmarks b WHERE b.id = new.bookmark_id;
        INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
        SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
               COALESCE((SELECT GROUP_CONCAT(t2.name, ', ')
                        FROM bookmark_tags bt2
                        JOIN tags t2 ON t2.id = bt2.tag_id
                        WHERE bt2.bookmark_id = b.id), '')
        FROM bookmarks b WHERE b.id = new.bookmark_id;
      END;

      CREATE TRIGGER IF NOT EXISTS bookmark_tags_sync_delete AFTER DELETE ON bookmark_tags
      BEGIN
        INSERT INTO bookmarks_fts (bookmarks_fts, rowid)
        SELECT 'delete', b.rowid FROM bookmarks b WHERE b.id = old.bookmark_id;
        INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
        SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
               COALESCE((SELECT GROUP_CONCAT(t2.name, ', ')
                        FROM bookmark_tags bt2
                        JOIN tags t2 ON t2.id = bt2.tag_id
                        WHERE bt2.bookmark_id = b.id), '')
        FROM bookmarks b WHERE b.id = old.bookmark_id;
      END;

      CREATE TRIGGER IF NOT EXISTS tags_sync_update AFTER UPDATE OF name ON tags
      BEGIN
        INSERT INTO bookmarks_fts (bookmarks_fts, rowid)
        SELECT DISTINCT 'delete', b.rowid
        FROM bookmarks b
        JOIN bookmark_tags bt ON bt.bookmark_id = b.id
        WHERE bt.tag_id = new.id;
        INSERT INTO bookmarks_fts (rowid, id, user_id, title, url, description, tags)
        SELECT b.rowid, b.id, b.user_id, b.title, b.url, b.description,
               COALESCE((SELECT GROUP_CONCAT(t2.name, ', ')
                        FROM bookmark_tags bt2
                        JOIN tags t2 ON t2.id = bt2.tag_id
                        WHERE bt2.bookmark_id = b.id), '')
        FROM bookmarks b
        JOIN bookmark_tags bt ON bt.bookmark_id = b.id
        WHERE bt.tag_id = new.id;
      END;
    `);
  } catch (err) {
    console.error(`Failed to initialize database at ${DB_PATH}:`, err);
    throw err;
  }

  function columnExists(table, column) {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all();
      return info.some((c) => c.name === column);
    } catch {
      return false;
    }
  }

  function addColumnIfNotExists(table, column, definition) {
    if (!columnExists(table, column)) {
      db.prepare(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
      ).run();
      return true;
    }
    return false;
  }

  const migrations = [
    {
      table: "user_settings",
      column: "hide_sidebar",
      def: "INTEGER DEFAULT 0",
    },
    { table: "user_settings", column: "settings_json", def: "TEXT" },
    { table: "user_settings", column: "dashboard_widgets", def: "TEXT" },
    { table: "bookmarks", column: "thumbnail_local", def: "TEXT" },
    { table: "bookmark_tags", column: "color_override", def: "TEXT" },
    {
      table: "user_settings",
      column: "include_child_bookmarks",
      def: "INTEGER DEFAULT 0",
    },
    {
      table: "user_settings",
      column: "dashboard_mode",
      def: "TEXT DEFAULT 'folder'",
    },
    { table: "user_settings", column: "dashboard_tags", def: "TEXT" },
    {
      table: "user_settings",
      column: "dashboard_sort",
      def: "TEXT DEFAULT 'recently_added'",
    },
    { table: "user_settings", column: "collapsed_sections", def: "TEXT" },
    {
      table: "user_settings",
      column: "current_view",
      def: "TEXT DEFAULT 'all'",
    },
    {
      table: "user_settings",
      column: "snap_to_grid",
      def: "INTEGER DEFAULT 1",
    },
    {
      table: "user_settings",
      column: "tour_completed",
      def: "INTEGER DEFAULT 0",
    },
    { table: "bookmarks", column: "color", def: "TEXT" },
    { table: "bookmarks", column: "og_image", def: "TEXT" },
    {
      table: "user_settings",
      column: "rich_link_previews_enabled",
      def: "INTEGER DEFAULT 0",
    },
  ];

  let migrationsRun = 0;
  for (const m of migrations) {
    if (addColumnIfNotExists(m.table, m.column, m.def)) {
      migrationsRun++;
    }
  }
  if (migrationsRun > 0) {
    console.log(`[Migrations] Added ${migrationsRun} column(s)`);
  }

  // Run formal migrations
  try {
    const migrationsDir = path.join(__dirname, "migrations");
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir).sort();
      for (const file of migrationFiles) {
        if (file.endsWith(".js")) {
          const migration = require(path.join(migrationsDir, file));
          if (typeof migration.up === "function") {
            migration.up(db);
          }
        }
      }
    }
  } catch (err) {
    console.error("Migration runner failed:", err.message);
  }

  return db;
}

function ensureDirectories() {
  const FAVICONS_DIR = path.join(__dirname, "../public/favicons");
  if (!fs.existsSync(FAVICONS_DIR))
    fs.mkdirSync(FAVICONS_DIR, { recursive: true });
  const THUMBNAILS_DIR = path.join(__dirname, "../public/thumbnails");
  if (!fs.existsSync(THUMBNAILS_DIR))
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
  return { FAVICONS_DIR, THUMBNAILS_DIR };
}

module.exports = { initializeDatabase, ensureDirectories };
