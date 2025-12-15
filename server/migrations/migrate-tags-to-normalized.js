/**
 * Migration Script: Move from TEXT tags to normalized tag system
 * 
 * This script:
 * 1. Reads all bookmarks with tags stored as comma-separated TEXT
 * 2. Creates tag records in the tags table (if they don't exist)
 * 3. Creates bookmark_tag relationships in the junction table
 * 4. Keeps the TEXT column intact for rollback capability
 */

const Database = require("better-sqlite3");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const DB_PATH = path.join(__dirname, "../../data/anchormarks.db");

function migrateTagsToNormalized() {
    console.log("🚀 Starting tag migration to normalized system...");

    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");

    try {
        // Start transaction
        db.prepare("BEGIN TRANSACTION").run();

        // Get all bookmarks with tags
        const bookmarks = db.prepare(`
      SELECT id, user_id, tags
      FROM bookmarks
      WHERE tags IS NOT NULL AND tags != ''
    `).all();

        console.log(`📚 Found ${bookmarks.length} bookmarks with tags`);

        let tagCreatedCount = 0;
        let relationshipCreatedCount = 0;
        const tagCache = new Map(); // Cache to avoid duplicate lookups

        for (const bookmark of bookmarks) {
            // Parse comma-separated tags
            const tagNames = bookmark.tags
                .split(",")
                .map(t => t.trim())
                .filter(t => t.length > 0);

            for (const tagName of tagNames) {
                let tagId;

                // Check cache first
                const cacheKey = `${bookmark.user_id}:${tagName}`;
                if (tagCache.has(cacheKey)) {
                    tagId = tagCache.get(cacheKey);
                } else {
                    // Check if tag already exists for this user
                    const existingTag = db.prepare(`
            SELECT id FROM tags
            WHERE user_id = ? AND name = ?
          `).get(bookmark.user_id, tagName);

                    if (existingTag) {
                        tagId = existingTag.id;
                    } else {
                        // Create new tag
                        tagId = uuidv4();
                        db.prepare(`
              INSERT INTO tags (id, user_id, name, color, icon)
              VALUES (?, ?, ?, ?, ?)
            `).run(tagId, bookmark.user_id, tagName, "#f59e0b", "tag");
                        tagCreatedCount++;
                    }

                    tagCache.set(cacheKey, tagId);
                }

                // Create bookmark-tag relationship if it doesn't exist
                const existingRelation = db.prepare(`
          SELECT 1 FROM bookmark_tags
          WHERE bookmark_id = ? AND tag_id = ?
        `).get(bookmark.id, tagId);

                if (!existingRelation) {
                    db.prepare(`
            INSERT INTO bookmark_tags (bookmark_id, tag_id)
            VALUES (?, ?)
          `).run(bookmark.id, tagId);
                    relationshipCreatedCount++;
                }
            }
        }

        // Commit transaction
        db.prepare("COMMIT").run();

        console.log("✅ Migration completed successfully!");
        console.log(`   - Tags created: ${tagCreatedCount}`);
        console.log(`   - Relationships created: ${relationshipCreatedCount}`);
        console.log(`   - Total bookmarks processed: ${bookmarks.length}`);

    } catch (error) {
        // Rollback on error
        db.prepare("ROLLBACK").run();
        console.error("❌ Migration failed:", error);
        throw error;
    } finally {
        db.close();
    }
}

// Run migration if called directly
if (require.main === module) {
    try {
        migrateTagsToNormalized();
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

module.exports = { migrateTagsToNormalized };
