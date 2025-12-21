/**
 * Migration: Add is_archived column to bookmarks table
 */
module.exports = {
    up: (db) => {
        try {
            db.prepare("ALTER TABLE bookmarks ADD COLUMN is_archived INTEGER DEFAULT 0").run();
            console.log("Migration: Added is_archived column to bookmarks table");
        } catch (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Migration: is_archived column already exists");
            } else {
                console.error("Migration Error (is_archived):", err.message);
            }
        }
    }
};
