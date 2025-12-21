/**
 * Integration-style tests for smart-organization collections helpers.
 *
 * - getTagClusters: seeds tags/bookmark_tags to produce multiple category clusters
 * - getActivityCollections: seeds bookmarks to produce Recent, Frequently Used, and Unread collections
 *
 * Uses an in-memory better-sqlite3 database to run the same SQL queries as the module.
 *
 * Run with the repository's server Jest runner (from repo root):
 *   npm test --workspace=anchormarks-server
 */

const Database = require("better-sqlite3");
const so = require("../helpers/smart-organization");

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("smart-organization — collections integration (DB-backed)", () => {
  let db;
  const userId = 1;

  beforeEach(() => {
    db = new Database(":memory:");

    // Minimal schema required by getTagClusters & getActivityCollections
    db.exec(`
      CREATE TABLE bookmarks (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        url TEXT,
        title TEXT,
        created_at TEXT,
        click_count INTEGER DEFAULT 0
      );

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT
      );

      CREATE TABLE bookmark_tags (
        bookmark_id TEXT,
        tag_id INTEGER
      );
    `);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (e) {
      // ignore
    }
  });

  describe("getTagClusters", () => {
    it("creates clusters for frontend, devops, language, and learning when multiple tags present", () => {
      // Insert bookmarks
      const insertBookmark = db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at, click_count) VALUES (?, ?, ?, ?, ?, ?)"
      );
      insertBookmark.run("b1", userId, "https://example.com/1", "B1", isoDaysAgo(3), 2);
      insertBookmark.run("b2", userId, "https://example.com/2", "B2", isoDaysAgo(10), 0);
      insertBookmark.run("b3", userId, "https://example.com/3", "B3", isoDaysAgo(1), 10);
      insertBookmark.run("b4", userId, "https://example.com/4", "B4", isoDaysAgo(5), 0);
      insertBookmark.run("b5", userId, "https://example.com/5", "B5", isoDaysAgo(8), 7);

      // Insert tags across categories
      const insertTag = db.prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)");
      const tags = [
        "react", // frontend
        "vue", // frontend
        "docker", // devops
        "k8s", // devops
        "python", // language
        "javascript", // language
        "tutorial", // learning
        "learning", // learning
        "unrelated", // other (should be ignored unless >1 in same category)
      ];
      const tagIds = {};
      for (const name of tags) {
        const info = insertTag.run(userId, name);
        tagIds[name] = info.lastInsertRowid;
      }

      // Map tags to bookmarks (create co-occurrence)
      const insertBT = db.prepare("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
      // b1 has react + vue + javascript
      insertBT.run("b1", tagIds["react"]);
      insertBT.run("b1", tagIds["vue"]);
      insertBT.run("b1", tagIds["javascript"]);
      // b2 has react + python
      insertBT.run("b2", tagIds["react"]);
      insertBT.run("b2", tagIds["python"]);
      // b3 has docker + k8s + tutorial
      insertBT.run("b3", tagIds["docker"]);
      insertBT.run("b3", tagIds["k8s"]);
      insertBT.run("b3", tagIds["tutorial"]);
      // b4 has learning + python
      insertBT.run("b4", tagIds["learning"]);
      insertBT.run("b4", tagIds["python"]);
      // b5 has docker + devops-like tag (k8s again)
      insertBT.run("b5", tagIds["docker"]);
      insertBT.run("b5", tagIds["k8s"]);
      // unrelated tag on b5 as well
      insertBT.run("b5", tagIds["unrelated"]);

      // Now call the function
      const clusters = so.getTagClusters(db, userId);

      // We expect clusters to include categories: Frontend, Devops, Language, Learning (each with >1 tag)
      // Find frontend cluster
      const frontend = clusters.find((c) => c.category === "frontend" || c.name.toLowerCase().includes("frontend"));
      expect(frontend).toBeTruthy();
      expect(frontend.tags).toEqual(expect.arrayContaining(["react", "vue"]));
      // Find devops cluster
      const devops = clusters.find((c) => c.category === "devops" || c.name.toLowerCase().includes("devops"));
      expect(devops).toBeTruthy();
      expect(devops.tags).toEqual(expect.arrayContaining(["docker", "k8s"]));
      // Find language cluster
      const language = clusters.find((c) => c.category === "language" || c.name.toLowerCase().includes("language"));
      expect(language).toBeTruthy();
      expect(language.tags).toEqual(expect.arrayContaining(["python", "javascript"]));
      // Find learning cluster
      const learning = clusters.find((c) => c.category === "learning" || c.name.toLowerCase().includes("learning"));
      expect(learning).toBeTruthy();
      expect(learning.tags).toEqual(expect.arrayContaining(["tutorial", "learning"]));

      // Each cluster should include a reason and rules structure
      clusters.forEach((c) => {
        expect(c).toHaveProperty("reason");
        expect(c).toHaveProperty("rules");
        expect(Array.isArray(c.tags)).toBe(true);
      });
    });
  });

  describe("getActivityCollections", () => {
    it("returns Recent, Frequently Used, and Unread collections when conditions met", () => {
      // Seed bookmarks to hit each collection rule
      const insertBookmark = db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at, click_count) VALUES (?, ?, ?, ?, ?, ?)"
      );

      // Recent bookmarks (within 7 days): r1, r2
      insertBookmark.run("r1", userId, "https://recent.example/1", "R1", isoDaysAgo(1), 0);
      insertBookmark.run("r2", userId, "https://recent.example/2", "R2", isoDaysAgo(3), 2);

      // Frequently used: f1 with click_count 6 (>5)
      insertBookmark.run("f1", userId, "https://freq.example/1", "F1", isoDaysAgo(30), 6);

      // Unread: u1 created >7 days ago and click_count = 0
      insertBookmark.run("u1", userId, "https://old.example/1", "U1", isoDaysAgo(10), 0);

      const collections = so.getActivityCollections(db, userId);

      // Should include Recent Bookmarks (7 days)
      const recent = collections.find((c) => c.name && c.name.includes("Recent Bookmarks"));
      expect(recent).toBeTruthy();
      expect(recent.bookmark_count).toBeGreaterThanOrEqual(2);

      // Should include Frequently Used
      const freq = collections.find((c) => c.name && c.name.includes("Frequently Used"));
      expect(freq).toBeTruthy();
      expect(freq.bookmark_count).toBeGreaterThanOrEqual(1);

      // Should include Unread
      const unread = collections.find((c) => c.name && c.name.includes("Unread"));
      expect(unread).toBeTruthy();
      expect(unread.bookmark_count).toBeGreaterThanOrEqual(1);

      // Each collection should have filters and a reason property
      collections.forEach((c) => {
        expect(c).toHaveProperty("filters");
        expect(c).toHaveProperty("reason");
      });
    });

    it("returns empty array if no matching activity", () => {
      // No bookmarks inserted -> should return empty array
      const emptyCollections = so.getActivityCollections(db, userId);
      expect(Array.isArray(emptyCollections)).toBe(true);
      expect(emptyCollections.length).toBe(0);
    });
  });
});
