const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/anchormarks.db");
const db = new Database(DB_PATH);

// Query solar tag
const solarTags = db.prepare(`
  SELECT id, user_id, name, color, icon 
  FROM tags 
  WHERE name = 'solar'
`).all();

console.log("Solar tags in database:");
console.log(JSON.stringify(solarTags, null, 2));

// Also check if there are any bookmark_tags relationships
if (solarTags.length > 0) {
    const tagId = solarTags[0].id;
    const relationships = db.prepare(`
    SELECT COUNT(*) as count 
    FROM bookmark_tags 
    WHERE tag_id = ?
  `).get(tagId);

    console.log(`\nBookmark-tag relationships for 'solar': ${relationships.count}`);
}

db.close();
