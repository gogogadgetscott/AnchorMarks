const Database = require("better-sqlite3");
const db = new Database("apps/server/data/bookmarks.db");

console.log("TABLES:");
console.log(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(),
);

console.log("\nVIEWS:");
console.log(
  db.prepare("SELECT name FROM sqlite_master WHERE type='view'").all(),
);

console.log("\nTRIGGERS:");
const triggers = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger'")
  .all();
triggers.forEach((t) => {
  console.log(`\nTrigger: ${t.name}`);
  console.log(t.sql);
});

console.log("\nFTS5 COLUMNS:");
try {
  console.log(db.prepare("PRAGMA table_info(bookmarks_fts)").all());
} catch (e) {
  console.log("bookmarks_fts table does not exist or error.");
}
