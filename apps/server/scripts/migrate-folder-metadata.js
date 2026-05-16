#!/usr/bin/env node
// One-time migration: add the metadata column to the folders table.
// Safe to run multiple times (idempotent).
//
// Usage:
//   node apps/server/scripts/migrate-folder-metadata.js

const path = require("path");
const Database = require("better-sqlite3");

// Load .env from repo root when present (same logic as server config)
try {
  const envPath = path.join(__dirname, "..", "..", "..", ".env");
  require("dotenv").config({ path: envPath });
} catch {
  // dotenv not available or no .env file — continue with process.env as-is
}

const DB_PATH =
  process.env.DB_PATH ||
  path.join(__dirname, "..", "..", "database", "anchormarks.db");

console.log(`Using database: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const tableInfo = db.prepare("PRAGMA table_info(folders)").all();
const hasMetadata = tableInfo.some((col) => col.name === "metadata");

if (hasMetadata) {
  console.log("✓ metadata column already exists — nothing to do.");
} else {
  db.exec("ALTER TABLE folders ADD COLUMN metadata TEXT DEFAULT NULL");
  console.log("✓ Added metadata TEXT column to folders table.");
}

db.close();
console.log("Migration complete.");
