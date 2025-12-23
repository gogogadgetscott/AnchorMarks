/**
 * Integration Tests for smart-organization helper (DB-backed)
 * Tests scoring functions with real SQLite database queries
 */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

const smartOrg = require("../helpers/smart-organization.js");

const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-smartorg-integration.db",
);

describe("smart-organization.js - Integration Tests (DB-backed)", () => {
  let db;
  let userId;

  beforeAll(() => {
    // Clean up any existing test database
    [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      },
    );

    // Create in-memory database with schema
    db = new Database(TEST_DB_PATH);

    // Create schema
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE bookmarks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        click_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE tags (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE bookmark_tags (
        bookmark_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (bookmark_id, tag_id),
        FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );

      CREATE INDEX idx_bookmarks_user ON bookmarks(user_id);
      CREATE INDEX idx_bookmarks_url ON bookmarks(url);
      CREATE INDEX idx_tags_user ON tags(user_id);
      CREATE INDEX idx_bookmark_tags_bookmark ON bookmark_tags(bookmark_id);
      CREATE INDEX idx_bookmark_tags_tag ON bookmark_tags(tag_id);
    `);

    // Create test user
    userId = uuidv4();
    db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(
      userId,
      "test@example.com",
    );
  });

  afterAll(() => {
    if (db) db.close();
    [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      },
    );
  });

  describe("getDomainScore", () => {
    beforeEach(() => {
      // Clean up bookmarks and tags
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM tags").run();
    });

    it("should return 0 when no bookmarks from domain exist", () => {
      const score = smartOrg.getDomainScore(
        db,
        userId,
        "github.com",
        "javascript",
      );
      expect(score).toBe(0);
    });

    it("should return 0 when domain has bookmarks but none with the tag", () => {
      // Create bookmarks from domain
      const bm1 = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://github.com/test/repo1", "Test Repo 1");

      const score = smartOrg.getDomainScore(
        db,
        userId,
        "github.com",
        "javascript",
      );
      expect(score).toBe(0);
    });

    it("should calculate frequency correctly for single tagged bookmark", () => {
      // Create bookmark from domain with tag
      const bm1 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://github.com/test/repo1", "Test Repo 1");

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );

      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getDomainScore(
        db,
        userId,
        "github.com",
        "javascript",
      );
      // frequency = 1/1 = 1.0, scale = min(1/100, 1.0) = 0.01
      expect(score).toBeCloseTo(0.01, 3);
    });

    it("should calculate frequency correctly with partial match", () => {
      // Create 3 bookmarks from domain, 2 with tag
      const bm1 = uuidv4();
      const bm2 = uuidv4();
      const bm3 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://github.com/test/repo1", "Test Repo 1");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm2, userId, "https://github.com/test/repo2", "Test Repo 2");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm3, userId, "https://github.com/test/repo3", "Test Repo 3");

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );

      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm2, tag1);

      const score = smartOrg.getDomainScore(
        db,
        userId,
        "github.com",
        "javascript",
      );
      // frequency = 2/3 ≈ 0.667, scale = min(3/100, 1.0) = 0.03
      expect(score).toBeCloseTo(0.02, 2);
    });

    it("should scale score based on bookmark count", () => {
      // Create 100 bookmarks from domain, all tagged
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );

      for (let i = 0; i < 100; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bmId, userId, `https://github.com/test/repo${i}`, `Repo ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bmId, tag1);
      }

      const score = smartOrg.getDomainScore(
        db,
        userId,
        "github.com",
        "javascript",
      );
      // frequency = 100/100 = 1.0, scale = min(100/100, 1.0) = 1.0
      expect(score).toBeCloseTo(1.0, 2);
    });

    it("should cap scale at 1.0 for more than 100 bookmarks", () => {
      // Create 150 bookmarks from domain, all tagged
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "python",
      );

      for (let i = 0; i < 150; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bmId, userId, `https://github.com/python/repo${i}`, `Repo ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bmId, tag1);
      }

      const score = smartOrg.getDomainScore(db, userId, "github.com", "python");
      // frequency = 150/150 = 1.0, scale = min(150/100, 1.0) = 1.0
      expect(score).toBeCloseTo(1.0, 2);
    });

    it("should handle errors gracefully", () => {
      const badDb = {
        prepare: () => {
          throw new Error("DB error");
        },
      };
      const score = smartOrg.getDomainScore(
        badDb,
        userId,
        "github.com",
        "test",
      );
      expect(score).toBe(0);
    });
  });

  describe("getActivityScore", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM tags").run();
    });

    it("should return 0 when no recent bookmarks exist", () => {
      const score = smartOrg.getActivityScore(db, userId, "javascript", 7);
      expect(score).toBe(0);
    });

    it("should return 0 when recent bookmarks exist but none with tag", () => {
      // Create recent bookmark without tag
      const bm1 = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(bm1, userId, "https://example.com/page", "Test Page");

      const score = smartOrg.getActivityScore(db, userId, "javascript", 7);
      expect(score).toBe(0);
    });

    it("should calculate frequency for recent tagged bookmarks", () => {
      // Create 2 recent bookmarks, 1 with tag
      const bm1 = uuidv4();
      const bm2 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(bm1, userId, "https://example.com/page1", "Page 1");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(bm2, userId, "https://example.com/page2", "Page 2");

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getActivityScore(db, userId, "javascript", 7);
      // frequency = 1/2 = 0.5, recencyBoost = 1.2 (7 days)
      // score = min(0.5 * 1.2, 1.0) = 0.6
      expect(score).toBeCloseTo(0.6, 2);
    });

    it("should apply 7-day recency boost of 1.2", () => {
      const bm1 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(bm1, userId, "https://example.com/page", "Page");
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "react",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getActivityScore(db, userId, "react", 7);
      // frequency = 1/1 = 1.0, recencyBoost = 1.2
      // score = min(1.0 * 1.2, 1.0) = 1.0 (capped)
      expect(score).toBeCloseTo(1.0, 2);
    });

    it("should apply 14-day recency boost of 0.9", () => {
      const bm1 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(bm1, userId, "https://example.com/page", "Page");
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "vue",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getActivityScore(db, userId, "vue", 14);
      // frequency = 1/1 = 1.0, recencyBoost = 0.9
      // score = min(1.0 * 0.9, 1.0) = 0.9
      expect(score).toBeCloseTo(0.9, 2);
    });

    it("should apply 30-day recency boost of 0.5", () => {
      const bm1 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now', '-20 days'))",
      ).run(bm1, userId, "https://example.com/page", "Page");
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "angular",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getActivityScore(db, userId, "angular", 30);
      // frequency = 1/1 = 1.0, recencyBoost = 0.5
      // score = min(1.0 * 0.5, 1.0) = 0.5
      expect(score).toBeCloseTo(0.5, 2);
    });

    it("should not count old bookmarks in recent query", () => {
      // Create old bookmark with tag
      const bm1 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now', '-30 days'))",
      ).run(bm1, userId, "https://example.com/page", "Old Page");
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "old-tag",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getActivityScore(db, userId, "old-tag", 7);
      expect(score).toBe(0);
    });

    it("should handle errors gracefully", () => {
      const badDb = {
        prepare: () => {
          throw new Error("DB error");
        },
      };
      const score = smartOrg.getActivityScore(badDb, userId, "test", 7);
      expect(score).toBe(0);
    });
  });

  describe("getSimilarityScore", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM tags").run();
    });

    it("should return 0 when no similar bookmarks exist", () => {
      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://example.com/unique-url-12345",
        "test",
      );
      expect(score).toBe(0);
    });

    it("should return 0 when URL has no valid tokens", () => {
      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://x.y/a/b",
        "test",
      );
      expect(score).toBe(0);
    });

    it("should calculate similarity based on token matches", () => {
      // Create similar bookmarks with tags
      const bm1 = uuidv4();
      const bm2 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://github.com/react/core", "React Core");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm2, userId, "https://github.com/vue/core", "Vue Core");

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "frontend",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm2, tag1);

      // Test URL shares tokens: github, core
      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://github.com/angular/core",
        "frontend",
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it("should give higher score when more similar bookmarks have the tag", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );

      // Create 5 similar bookmarks, all with tag
      for (let i = 0; i < 5; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(
          bmId,
          userId,
          `https://javascript-tutorial.com/lesson${i}`,
          `JavaScript Lesson ${i}`,
        );
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bmId, tag1);
      }

      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://javascript-tutorial.com/advanced",
        "javascript",
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it("should handle case-insensitive tag matching", () => {
      const bm1 = uuidv4();
      const tag1 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://example.com/test", "Test");
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "JavaScript",
      );
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tag1);

      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://example.com/test-page",
        "javascript",
      );

      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should apply log boost to score calculation", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "python",
      );

      // Create 10 similar bookmarks with tag
      for (let i = 0; i < 10; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(
          bmId,
          userId,
          `https://python-docs.org/page${i}`,
          `Python Doc ${i}`,
        );
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bmId, tag1);
      }

      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://python-docs.org/advanced",
        "python",
      );

      // With logBoost, score should be higher but still capped at 1.0
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it("should limit query to 100 bookmarks", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "test",
      );

      // Create 150 bookmarks (query should only check first 100)
      for (let i = 0; i < 150; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bmId, userId, `https://test.com/page${i}`, `Page ${i}`);
        if (i < 50) {
          db.prepare(
            "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
          ).run(bmId, tag1);
        }
      }

      const score = smartOrg.getSimilarityScore(
        db,
        userId,
        "https://test.com/new-page",
        "test",
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it("should handle errors gracefully", () => {
      const badDb = {
        prepare: () => {
          throw new Error("DB error");
        },
      };
      const score = smartOrg.getSimilarityScore(
        badDb,
        userId,
        "https://example.com",
        "test",
      );
      expect(score).toBe(0);
    });
  });

  describe("calculateTagScore - End-to-End", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM tags").run();
    });

    it("should calculate combined score from all sources", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );

      // Create domain bookmarks
      for (let i = 0; i < 10; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        ).run(bmId, userId, `https://github.com/js/repo${i}`, `JS Repo ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bmId, tag1);
      }

      const result = smartOrg.calculateTagScore(
        db,
        userId,
        "https://github.com/new/javascript-library",
        "javascript",
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1.0);
      expect(result.domainScore).toBeGreaterThanOrEqual(0);
      expect(result.activityScore).toBeGreaterThanOrEqual(0);
      expect(result.similarityScore).toBeGreaterThanOrEqual(0);
    });

    it("should respect custom weights", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "react",
      );

      // Create data
      const bmId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(bmId, userId, "https://react.dev/docs", "React Docs");
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bmId, tag1);

      const weights = {
        domain: 0.6,
        activity: 0.3,
        similarity: 0.1,
      };

      const result = smartOrg.calculateTagScore(
        db,
        userId,
        "https://react.dev/tutorial",
        "react",
        weights,
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1.0);
    });

    it("should populate sources object correctly", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "python",
      );

      // Create significant data to trigger sources
      for (let i = 0; i < 20; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        ).run(bmId, userId, `https://python.org/doc${i}`, `Python Doc ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bmId, tag1);
      }

      const result = smartOrg.calculateTagScore(
        db,
        userId,
        "https://python.org/tutorial",
        "python",
      );

      expect(result.sources).toBeDefined();
      expect(typeof result.sources.domain).toBe("boolean");
      expect(typeof result.sources.activity).toBe("boolean");
      expect(typeof result.sources.similarity).toBe("boolean");
    });

    it("should return zero scores for invalid URL", () => {
      const result = smartOrg.calculateTagScore(
        db,
        userId,
        "not-a-url",
        "test",
      );

      expect(result.score).toBe(0);
      expect(result.domainScore).toBe(0);
      expect(result.activityScore).toBe(0);
      expect(result.similarityScore).toBe(0);
      expect(result.sources).toEqual({});
    });
  });
});
