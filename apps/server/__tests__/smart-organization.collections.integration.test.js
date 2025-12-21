/**
 * Integration Tests for smart-organization collections helpers (DB-backed)
 * Tests getTagClusters and getActivityCollections with real database
 */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

const smartOrg = require("../helpers/smart-organization.js");

const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-collections-integration.db",
);

describe("smart-organization.js - Collections Integration Tests", () => {
  let db;
  let userId;

  beforeAll(() => {
    // Clean up any existing test database
    [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      },
    );

    // Create database with schema
    db = new Database(TEST_DB_PATH);

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
        UNIQUE(user_id, name),
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
      CREATE INDEX idx_bookmarks_created ON bookmarks(created_at);
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

  describe("getTagClusters", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM bookmarks").run();
      db.prepare("DELETE FROM tags").run();
    });

    it("should return empty array when no tags exist", () => {
      const clusters = smartOrg.getTagClusters(db, userId);
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBe(0);
    });

    it("should return empty array when tags exist but have no bookmarks", () => {
      const tag1 = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tag1,
        userId,
        "javascript",
      );

      const clusters = smartOrg.getTagClusters(db, userId);
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBe(0);
    });

    it("should cluster frontend-related tags", () => {
      // Create bookmarks with frontend tags
      const reactTag = uuidv4();
      const vueTag = uuidv4();
      const angularTag = uuidv4();

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        reactTag,
        userId,
        "react",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        vueTag,
        userId,
        "vue",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        angularTag,
        userId,
        "angular",
      );

      // Create bookmarks
      for (let i = 0; i < 3; i++) {
        const bm1 = uuidv4();
        const bm2 = uuidv4();
        const bm3 = uuidv4();

        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm1, userId, `https://react.dev/docs${i}`, `React Doc ${i}`);
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm2, userId, `https://vuejs.org/guide${i}`, `Vue Guide ${i}`);
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm3, userId, `https://angular.io/docs${i}`, `Angular Doc ${i}`);

        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm1, reactTag);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm2, vueTag);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm3, angularTag);
      }

      const clusters = smartOrg.getTagClusters(db, userId);

      expect(clusters.length).toBeGreaterThan(0);
      const frontendCluster = clusters.find((c) => c.category === "frontend");
      expect(frontendCluster).toBeDefined();
      expect(frontendCluster.name).toContain("Frontend");
      expect(frontendCluster.type).toBe("tag_cluster");
      expect(frontendCluster.tags).toContain("react");
      expect(frontendCluster.tags).toContain("vue");
      expect(frontendCluster.tags).toContain("angular");
      expect(frontendCluster.bookmark_count).toBeGreaterThanOrEqual(9);
      expect(frontendCluster.reason).toBeTruthy();
      expect(frontendCluster.rules).toBeDefined();
      expect(frontendCluster.rules.tags).toBeDefined();
    });

    it("should cluster devops-related tags", () => {
      const dockerTag = uuidv4();
      const k8sTag = uuidv4();
      const devopsTag = uuidv4();

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        dockerTag,
        userId,
        "docker",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        k8sTag,
        userId,
        "k8s",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        devopsTag,
        userId,
        "devops",
      );

      // Create bookmarks
      for (let i = 0; i < 2; i++) {
        const bm1 = uuidv4();
        const bm2 = uuidv4();

        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm1, userId, `https://docker.com/doc${i}`, `Docker Doc ${i}`);
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm2, userId, `https://kubernetes.io/doc${i}`, `K8s Doc ${i}`);

        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm1, dockerTag);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm2, k8sTag);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm2, devopsTag);
      }

      const clusters = smartOrg.getTagClusters(db, userId);

      const devopsCluster = clusters.find((c) => c.category === "devops");
      expect(devopsCluster).toBeDefined();
      expect(devopsCluster.name).toContain("Devops");
      expect(devopsCluster.tags).toContain("docker");
      expect(
        devopsCluster.tags.some((t) => t === "k8s" || t === "devops"),
      ).toBe(true);
    });

    it("should cluster language-related tags", () => {
      const pythonTag = uuidv4();
      const javascriptTag = uuidv4();
      const javaTag = uuidv4();

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        pythonTag,
        userId,
        "python",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        javascriptTag,
        userId,
        "javascript",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        javaTag,
        userId,
        "java",
      );

      // Create bookmarks
      const bm1 = uuidv4();
      const bm2 = uuidv4();
      const bm3 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://python.org/docs", "Python Docs");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm2, userId, "https://javascript.info", "JS Tutorial");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm3, userId, "https://oracle.com/java", "Java Docs");

      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, pythonTag);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm2, javascriptTag);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm3, javaTag);

      const clusters = smartOrg.getTagClusters(db, userId);

      const languageCluster = clusters.find((c) => c.category === "language");
      expect(languageCluster).toBeDefined();
      expect(languageCluster.name).toContain("Language");
      expect(languageCluster.tags).toContain("python");
      expect(languageCluster.tags).toContain("javascript");
      expect(languageCluster.tags).toContain("java");
    });

    it("should cluster learning-related tags", () => {
      const tutorialTag = uuidv4();
      const learningTag = uuidv4();
      const courseTag = uuidv4();

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        tutorialTag,
        userId,
        "tutorial",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        learningTag,
        userId,
        "learning",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        courseTag,
        userId,
        "course",
      );

      const bm1 = uuidv4();
      const bm2 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://tutorial.com/web", "Web Tutorial");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm2, userId, "https://udemy.com/course/js", "JS Course");

      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, tutorialTag);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, learningTag);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm2, courseTag);

      const clusters = smartOrg.getTagClusters(db, userId);

      const learningCluster = clusters.find((c) => c.category === "learning");
      expect(learningCluster).toBeDefined();
      expect(learningCluster.name).toContain("Learning");
    });

    it("should not create cluster with single tag", () => {
      const soloTag = uuidv4();
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        soloTag,
        userId,
        "react",
      );

      const bm1 = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://react.dev", "React");
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, soloTag);

      const clusters = smartOrg.getTagClusters(db, userId);

      // Should not have a cluster with only one tag
      const reactOnlyCluster = clusters.find(
        (c) => c.tags.length === 1 && c.tags[0] === "react",
      );
      expect(reactOnlyCluster).toBeUndefined();
    });

    it("should sort clusters by bookmark count", () => {
      // Create two clusters with different bookmark counts
      const reactTag = uuidv4();
      const vueTag = uuidv4();
      const dockerTag = uuidv4();
      const k8sTag = uuidv4();

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        reactTag,
        userId,
        "react",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        vueTag,
        userId,
        "vue",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        dockerTag,
        userId,
        "docker",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        k8sTag,
        userId,
        "k8s",
      );

      // Create more frontend bookmarks than devops
      for (let i = 0; i < 10; i++) {
        const bm = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm, userId, `https://react.dev/doc${i}`, `Doc ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm, reactTag);
      }

      for (let i = 0; i < 5; i++) {
        const bm = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm, userId, `https://vue.js.org/doc${i}`, `Doc ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm, vueTag);
      }

      for (let i = 0; i < 2; i++) {
        const bm = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
        ).run(bm, userId, `https://docker.com/doc${i}`, `Doc ${i}`);
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bm, dockerTag);
      }

      const bm = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm, userId, "https://kubernetes.io/doc", "Doc");
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm, k8sTag);

      const clusters = smartOrg.getTagClusters(db, userId);

      // Frontend cluster should come before devops cluster (more bookmarks)
      if (clusters.length >= 2) {
        expect(clusters[0].bookmark_count).toBeGreaterThanOrEqual(
          clusters[1].bookmark_count,
        );
      }
    });

    it("should handle errors gracefully", () => {
      const badDb = {
        prepare: () => {
          throw new Error("DB error");
        },
      };
      const clusters = smartOrg.getTagClusters(badDb, userId);
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBe(0);
    });

    it("should include rules object with tags array", () => {
      const reactTag = uuidv4();
      const vueTag = uuidv4();

      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        reactTag,
        userId,
        "react",
      );
      db.prepare("INSERT INTO tags (id, user_id, name) VALUES (?, ?, ?)").run(
        vueTag,
        userId,
        "vue",
      );

      const bm1 = uuidv4();
      const bm2 = uuidv4();

      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm1, userId, "https://react.dev", "React");
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title) VALUES (?, ?, ?, ?)",
      ).run(bm2, userId, "https://vuejs.org", "Vue");

      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm1, reactTag);
      db.prepare(
        "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
      ).run(bm2, vueTag);

      const clusters = smartOrg.getTagClusters(db, userId);

      if (clusters.length > 0) {
        const cluster = clusters[0];
        expect(cluster.rules).toBeDefined();
        expect(cluster.rules.tags).toBeDefined();
        expect(Array.isArray(cluster.rules.tags)).toBe(true);
      }
    });
  });

  describe("getActivityCollections", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM bookmark_tags").run();
      db.prepare("DELETE FROM bookmarks").run();
    });

    it("should return empty array when no bookmarks exist", () => {
      const collections = smartOrg.getActivityCollections(db, userId);
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBe(0);
    });

    it("should include recent bookmarks collection (7 days)", () => {
      // Create recent bookmarks
      for (let i = 0; i < 5; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        ).run(bmId, userId, `https://example.com/page${i}`, `Page ${i}`);
      }

      const collections = smartOrg.getActivityCollections(db, userId);

      const recentCollection = collections.find((c) =>
        c.name.includes("Recent"),
      );
      expect(recentCollection).toBeDefined();
      expect(recentCollection.type).toBe("activity");
      expect(recentCollection.icon).toBe("clock");
      expect(recentCollection.color).toBe("#f59e0b");
      expect(recentCollection.filters).toBeDefined();
      expect(recentCollection.filters.addedWithinDays).toBe(7);
      expect(recentCollection.bookmark_count).toBe(5);
      expect(recentCollection.reason).toContain("5 bookmarks");
      expect(recentCollection.reason).toContain("last 7 days");
    });

    it("should not include recent collection when no recent bookmarks", () => {
      // Create old bookmark
      const bmId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now', '-30 days'))",
      ).run(bmId, userId, "https://example.com/old", "Old Page");

      const collections = smartOrg.getActivityCollections(db, userId);

      const recentCollection = collections.find((c) =>
        c.name.includes("Recent"),
      );
      expect(recentCollection).toBeUndefined();
    });

    it("should include frequently used collection", () => {
      // Create bookmarks with high click count
      for (let i = 0; i < 3; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, click_count) VALUES (?, ?, ?, ?, ?)",
        ).run(bmId, userId, `https://example.com/page${i}`, `Page ${i}`, 10);
      }

      const collections = smartOrg.getActivityCollections(db, userId);

      const frequentCollection = collections.find((c) =>
        c.name.includes("Frequently"),
      );
      expect(frequentCollection).toBeDefined();
      expect(frequentCollection.type).toBe("activity");
      expect(frequentCollection.icon).toBe("trending-up");
      expect(frequentCollection.color).toBe("#10b981");
      expect(frequentCollection.filters.clickCountMinimum).toBe(5);
      expect(frequentCollection.bookmark_count).toBe(3);
      expect(frequentCollection.reason).toContain("3 bookmarks");
      expect(frequentCollection.reason).toContain("more than 5 times");
    });

    it("should not include frequently used when no frequent bookmarks", () => {
      const bmId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, click_count) VALUES (?, ?, ?, ?, ?)",
      ).run(bmId, userId, "https://example.com/page", "Page", 2);

      const collections = smartOrg.getActivityCollections(db, userId);

      const frequentCollection = collections.find((c) =>
        c.name.includes("Frequently"),
      );
      expect(frequentCollection).toBeUndefined();
    });

    it("should include unread collection", () => {
      // Create old bookmarks with zero clicks
      for (let i = 0; i < 4; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))",
        ).run(bmId, userId, `https://example.com/unread${i}`, `Unread ${i}`, 0);
      }

      const collections = smartOrg.getActivityCollections(db, userId);

      const unreadCollection = collections.find((c) =>
        c.name.includes("Unread"),
      );
      expect(unreadCollection).toBeDefined();
      expect(unreadCollection.type).toBe("activity");
      expect(unreadCollection.icon).toBe("eye-off");
      expect(unreadCollection.color).toBe("#6b7280");
      expect(unreadCollection.filters.unread).toBe(true);
      expect(unreadCollection.bookmark_count).toBe(4);
      expect(unreadCollection.reason).toContain("4 bookmarks");
      expect(unreadCollection.reason).toContain("haven't clicked");
    });

    it("should not include unread collection for recent bookmarks", () => {
      // Create recent bookmark with zero clicks (not considered unread yet)
      const bmId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      ).run(bmId, userId, "https://example.com/new", "New Page", 0);

      const collections = smartOrg.getActivityCollections(db, userId);

      const unreadCollection = collections.find((c) =>
        c.name.includes("Unread"),
      );
      expect(unreadCollection).toBeUndefined();
    });

    it("should include multiple collections when criteria met", () => {
      // Create recent bookmarks
      for (let i = 0; i < 3; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        ).run(bmId, userId, `https://example.com/recent${i}`, `Recent ${i}`);
      }

      // Create frequently used bookmarks
      for (let i = 0; i < 2; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-20 days'))",
        ).run(
          bmId,
          userId,
          `https://example.com/frequent${i}`,
          `Frequent ${i}`,
          8,
        );
      }

      // Create unread bookmarks
      for (let i = 0; i < 5; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-15 days'))",
        ).run(bmId, userId, `https://example.com/unread${i}`, `Unread ${i}`, 0);
      }

      const collections = smartOrg.getActivityCollections(db, userId);

      expect(collections.length).toBe(3);
      expect(collections.some((c) => c.name.includes("Recent"))).toBe(true);
      expect(collections.some((c) => c.name.includes("Frequently"))).toBe(true);
      expect(collections.some((c) => c.name.includes("Unread"))).toBe(true);
    });

    it("should have correct structure for all collections", () => {
      // Create data to trigger all collections
      const recentId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
      ).run(recentId, userId, "https://example.com/recent", "Recent");

      const frequentId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))",
      ).run(frequentId, userId, "https://example.com/frequent", "Frequent", 10);

      const unreadId = uuidv4();
      db.prepare(
        "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'))",
      ).run(unreadId, userId, "https://example.com/unread", "Unread", 0);

      const collections = smartOrg.getActivityCollections(db, userId);

      collections.forEach((collection) => {
        expect(collection).toHaveProperty("name");
        expect(collection).toHaveProperty("type");
        expect(collection).toHaveProperty("icon");
        expect(collection).toHaveProperty("color");
        expect(collection).toHaveProperty("filters");
        expect(collection).toHaveProperty("bookmark_count");
        expect(collection).toHaveProperty("reason");
        expect(collection.type).toBe("activity");
        expect(typeof collection.name).toBe("string");
        expect(typeof collection.icon).toBe("string");
        expect(typeof collection.color).toBe("string");
        expect(typeof collection.bookmark_count).toBe("number");
        expect(typeof collection.reason).toBe("string");
        expect(typeof collection.filters).toBe("object");
      });
    });

    it("should handle errors gracefully", () => {
      const badDb = {
        prepare: () => {
          throw new Error("DB error");
        },
      };
      const collections = smartOrg.getActivityCollections(badDb, userId);
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBe(0);
    });

    it("should correctly count bookmarks for each collection", () => {
      // Create 10 recent bookmarks
      for (let i = 0; i < 10; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
        ).run(bmId, userId, `https://example.com/r${i}`, `R ${i}`);
      }

      // Create 7 frequently used (overlapping with recent is ok)
      for (let i = 0; i < 7; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-20 days'))",
        ).run(bmId, userId, `https://example.com/f${i}`, `F ${i}`, 6);
      }

      // Create 12 unread
      for (let i = 0; i < 12; i++) {
        const bmId = uuidv4();
        db.prepare(
          "INSERT INTO bookmarks (id, user_id, url, title, click_count, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', '-15 days'))",
        ).run(bmId, userId, `https://example.com/u${i}`, `U ${i}`, 0);
      }

      const collections = smartOrg.getActivityCollections(db, userId);

      const recentCollection = collections.find((c) =>
        c.name.includes("Recent"),
      );
      const frequentCollection = collections.find((c) =>
        c.name.includes("Frequently"),
      );
      const unreadCollection = collections.find((c) =>
        c.name.includes("Unread"),
      );

      expect(recentCollection.bookmark_count).toBe(10);
      expect(frequentCollection.bookmark_count).toBe(7);
      expect(unreadCollection.bookmark_count).toBe(12);
    });
  });
});
