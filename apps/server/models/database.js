const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

function initializeDatabase(DB_PATH) {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const wasNew = !fs.existsSync(DB_PATH);
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
        position INTEGER DEFAULT 0,
        is_favorite INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        last_clicked DATETIME,
        is_dead INTEGER DEFAULT 0,
        last_checked DATETIME,
        content_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks(folder_id);
      CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

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
        dashboard_mode TEXT DEFAULT 'folder',
        dashboard_tags TEXT,
        dashboard_sort TEXT DEFAULT 'updated_desc',
        widget_order TEXT,
        collapsed_sections TEXT,
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
    `);
  } catch (err) {
    console.error(`Failed to initialize database at ${DB_PATH}:`, err);
    throw err;
  }

  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN hide_sidebar INTEGER DEFAULT 0",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN dashboard_widgets TEXT",
    ).run();
  } catch (err) {}
  try {
    db.prepare("ALTER TABLE bookmarks ADD COLUMN thumbnail_local TEXT").run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE bookmark_tags ADD COLUMN color_override TEXT",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN include_child_bookmarks INTEGER DEFAULT 0",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN dashboard_mode TEXT DEFAULT 'folder'",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN dashboard_tags TEXT",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN dashboard_sort TEXT DEFAULT 'recently_added'",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN collapsed_sections TEXT",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN current_view TEXT DEFAULT 'all'",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN snap_to_grid INTEGER DEFAULT 1",
    ).run();
  } catch (err) {}
  try {
    db.prepare(
      "ALTER TABLE user_settings ADD COLUMN tour_completed INTEGER DEFAULT 0",
    ).run();
  } catch (err) {}
  try {
    db.prepare("ALTER TABLE bookmarks ADD COLUMN color TEXT").run();
  } catch (err) {}

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
