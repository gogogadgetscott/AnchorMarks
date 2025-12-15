/**
 * Migration Script: Add color_override to bookmark_tags
 * Enables per-bookmark tag color customization.
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../data/anchormarks.db");

function addColorOverrideColumn() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  try {
    db.prepare("ALTER TABLE bookmark_tags ADD COLUMN color_override TEXT").run();
    console.log("✅ Added color_override column to bookmark_tags");
  } catch (err) {
    if (err && err.message && err.message.toLowerCase().includes("duplicate column")) {
      console.log("ℹ️ color_override column already exists; skipping");
    } else {
      console.error("❌ Migration failed:", err.message || err);
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

if (require.main === module) {
  addColorOverrideColumn();
}

module.exports = { addColorOverrideColumn };
