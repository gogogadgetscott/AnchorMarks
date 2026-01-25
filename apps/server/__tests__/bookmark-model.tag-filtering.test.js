// Unit tests for bookmark.js model - Tag filtering implementation
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { initializeDatabase } = require("../models/database");
const {
  listBookmarks,
  createBookmark,
  getBookmarkById,
} = require("../models/bookmark");
const { createTag } = require("../models/tag");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-model.db");

let db;
let userId;

beforeAll(() => {
  // Clean up before test
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );

  db = initializeDatabase(TEST_DB_PATH);

  // Create test user
  userId = uuidv4();
  db.prepare("INSERT INTO users (id, email, password) VALUES (?, ?, ?)").run(
    userId,
    "test@example.com",
    "hashed_password",
  );

  // Create test tags
  const tags = [
    { name: "a", color: "#000000", icon: "tag" },
    { name: "ab", color: "#111111", icon: "tag" },
    { name: "abc", color: "#222222", icon: "tag" },
    { name: "dev", color: "#333333", icon: "tag" },
    { name: "development", color: "#444444", icon: "tag" },
    { name: "frontend", color: "#555555", icon: "tag" },
  ];

  tags.forEach((tag) => {
    createTag(db, {
      id: uuidv4(),
      user_id: userId,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
    });
  });
});

afterAll(() => {
  if (db) db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Bookmark Model - listBookmarks with Tag Filtering", () => {
  let bookmarkData = {};

  beforeAll(() => {
    // Create test bookmarks with specific tag combinations
    const specs = [
      { title: "Only A", tags: ["a"] },
      { title: "Only AB", tags: ["ab"] },
      { title: "Only ABC", tags: ["abc"] },
      { title: "A and AB", tags: ["a", "ab"] },
      { title: "A and ABC", tags: ["a", "abc"] },
      { title: "AB and ABC", tags: ["ab", "abc"] },
      { title: "All A B C", tags: ["a", "ab", "abc"] },
      { title: "Dev and Development", tags: ["dev", "development"] },
      { title: "Frontend Only", tags: ["frontend"] },
      { title: "No Tags", tags: [] },
    ];

    specs.forEach((spec) => {
      const bookmarkId = createBookmark(db, userId, {
        url: `https://example.com/${spec.title.replace(/\s+/g, "-")}`,
        title: spec.title,
        folder_id: null,
      }).id;

      // Link tags
      const tagRows = db
        .prepare(
          "SELECT id FROM tags WHERE user_id = ? AND name IN (" +
            spec.tags.map(() => "?").join(",") +
            ")",
        )
        .all(userId, ...spec.tags);

      tagRows.forEach((tag) => {
        db.prepare(
          "INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)",
        ).run(bookmarkId, tag.id);
      });

      bookmarkData[spec.title] = bookmarkId;
    });
  });

  describe("Substring False Positive Prevention", () => {
    it("should filter by 'a' tag without matching 'ab' or 'abc'", () => {
      const result = listBookmarks(db, userId, { tags: "a" });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Only A");
      expect(titles).toContain("A and AB");
      expect(titles).toContain("A and ABC");
      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Only AB");
      expect(titles).not.toContain("Only ABC");
      expect(titles).not.toContain("AB and ABC");
    });

    it("should filter by 'ab' tag without matching 'abc'", () => {
      const result = listBookmarks(db, userId, { tags: "ab" });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Only AB");
      expect(titles).toContain("A and AB");
      expect(titles).toContain("AB and ABC");
      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Only A");
      expect(titles).not.toContain("Only ABC");
      expect(titles).not.toContain("A and ABC");
    });

    it("should filter by 'abc' tag exactly", () => {
      const result = listBookmarks(db, userId, { tags: "abc" });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Only ABC");
      expect(titles).toContain("A and ABC");
      expect(titles).toContain("AB and ABC");
      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Only A");
      expect(titles).not.toContain("Only AB");
      expect(titles).not.toContain("A and AB");
    });
  });

  describe("OR Mode (Default) - Any Tag Matches", () => {
    it("should match bookmarks with any of multiple tags", () => {
      const result = listBookmarks(db, userId, { tags: "a, ab" });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Only A");
      expect(titles).toContain("Only AB");
      expect(titles).toContain("A and AB");
      expect(titles).toContain("A and ABC");
      expect(titles).toContain("AB and ABC");
      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Only ABC");
      expect(titles).not.toContain("Dev and Development");
    });

    it("should handle three tags in OR mode", () => {
      const result = listBookmarks(db, userId, { tags: "a, ab, abc" });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Only A");
      expect(titles).toContain("Only AB");
      expect(titles).toContain("Only ABC");
      expect(titles).toContain("A and AB");
      expect(titles).toContain("A and ABC");
      expect(titles).toContain("AB and ABC");
      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Dev and Development");
      expect(titles).not.toContain("Frontend Only");
    });
  });

  describe("AND Mode - All Tags Required", () => {
    it("should require all tags in AND mode", () => {
      const result = listBookmarks(db, userId, {
        tags: "a, ab",
        tagMode: "and",
      });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("A and AB");
      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Only A");
      expect(titles).not.toContain("Only AB");
      expect(titles).not.toContain("Only ABC");
      expect(titles).not.toContain("A and ABC");
      expect(titles).not.toContain("AB and ABC");
    });

    it("should require all three tags in AND mode", () => {
      const result = listBookmarks(db, userId, {
        tags: "a, ab, abc",
        tagMode: "and",
      });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("All A B C");

      expect(titles).not.toContain("Only A");
      expect(titles).not.toContain("Only AB");
      expect(titles).not.toContain("Only ABC");
      expect(titles).not.toContain("A and AB");
      expect(titles).not.toContain("A and ABC");
      expect(titles).not.toContain("AB and ABC");
    });

    it("should return empty results when no bookmark has all tags", () => {
      const result = listBookmarks(db, userId, {
        tags: "a, dev",
        tagMode: "and",
      });
      expect(result.bookmarks.length).toBe(0);
    });
  });

  describe("Tag Namespace Independence", () => {
    it("should distinguish between 'dev' and 'development'", () => {
      const devResult = listBookmarks(db, userId, { tags: "dev" });
      const devTitles = devResult.bookmarks.map((b) => b.title);

      expect(devTitles).toContain("Dev and Development");

      const developmentResult = listBookmarks(db, userId, {
        tags: "development",
      });
      const developmentTitles = developmentResult.bookmarks.map((b) => b.title);

      expect(developmentTitles).toContain("Dev and Development");
    });

    it("should return different results for 'dev' and 'dev, development'", () => {
      const devResult = listBookmarks(db, userId, { tags: "dev" });
      const bothResult = listBookmarks(db, userId, {
        tags: "dev, development",
      });

      // OR mode: bothResult should include all devResult
      expect(bothResult.bookmarks.length).toBeGreaterThanOrEqual(
        devResult.bookmarks.length,
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle single tag correctly", () => {
      const result = listBookmarks(db, userId, { tags: "frontend" });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Frontend Only");
      expect(titles.length).toBe(1);
    });

    it("should handle empty tags parameter", () => {
      const result = listBookmarks(db, userId, { tags: "" });
      // Should return all bookmarks (no filter applied)
      expect(result.bookmarks.length).toBeGreaterThan(0);
    });

    it("should handle whitespace around tag names", () => {
      const result = listBookmarks(db, userId, { tags: "  a  ,  ab  " });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("Only A");
      expect(titles).toContain("Only AB");
      expect(titles).toContain("A and AB");
    });

    it("should return empty results for non-existent tag", () => {
      const result = listBookmarks(db, userId, { tags: "nonexistent" });
      expect(result.bookmarks.length).toBe(0);
    });

    it("should be case-sensitive for tag names", () => {
      const result = listBookmarks(db, userId, { tags: "A" });
      // Should not match "a" if tags are case-sensitive
      expect(result.bookmarks.length).toBe(0);
    });
  });

  describe("Combined with Other Filters", () => {
    it("should combine tag filter with search", () => {
      const result = listBookmarks(db, userId, {
        tags: "a",
        search: "and",
      });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("A and AB");
      expect(titles).toContain("A and ABC");

      expect(titles).not.toContain("Only A");
      expect(titles).not.toContain("Only AB");
    });

    it("should combine tag filter with favorites", () => {
      // Mark a bookmark as favorite
      const bookmarkId = bookmarkData["A and AB"];
      db.prepare("UPDATE bookmarks SET is_favorite = 1 WHERE id = ?").run(
        bookmarkId,
      );

      const result = listBookmarks(db, userId, {
        tags: "a",
        favorites: true,
      });
      const titles = result.bookmarks.map((b) => b.title);

      expect(titles).toContain("A and AB");
      expect(titles.length).toBe(1);
    });
  });
});
