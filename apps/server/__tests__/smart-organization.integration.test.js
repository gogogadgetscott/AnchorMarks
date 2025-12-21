/**
 * Integration-style tests for smart-organization scoring functions.
 * These tests create an in-memory better-sqlite3 database, seed it with
 * bookmarks/tags/bookmark_tags and assert the behavior of:
 *  - getDomainScore
 *  - getActivityScore
 *  - getSimilarityScore
 *  - calculateTagScore (aggregate)
 *
 * Run with the repository's server Jest runner (from repo root):
 *   npm test --workspace=anchormarks-server
 *
 * Note: tests avoid network I/O and rely only on the SQL queries used
 * by the module (bookmarks, tags, bookmark_tags).
 */

const Database = require("better-sqlite3");
const so = require("../helpers/smart-organization");

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("smart-organization — integration (DB-backed)", () => {
  let db;
  const userId = 1;

  beforeEach(() => {
    // In-memory DB for isolation
    db = new Database(":memory:");

    // Minimal schema required by smart-organization queries
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

  it("getDomainScore returns expected fractional score based on frequency and scale", () => {
    // Seed 3 bookmarks for example.com; 2 of them have the 'testing' tag
    const insertBookmark = db.prepare(
      "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    insertBookmark.run("b1", userId, "https://example.com/a", "A", isoDaysAgo(20));
    insertBookmark.run("b2", userId, "https://example.com/b", "B", isoDaysAgo(10));
    insertBookmark.run("b3", userId, "https://other.com/x", "X", isoDaysAgo(5));

    const insertTag = db.prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)");
    const tagInfo = insertTag.run(userId, "testing");
    const tagId = tagInfo.lastInsertRowid;

    const insertBT = db.prepare("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    insertBT.run("b1", tagId);
    insertBT.run("b2", tagId);

    // domainBookmarks.count = 2 for example.com (b1,b2)
    // taggedCount = 2
    // frequency = 2/2 = 1.0
    // scale = min(2/100, 1.0) = 0.02
    // expected = 1.0 * 0.02 = 0.02
    const domainScore = so.getDomainScore(db, userId, "example.com", "testing");
    expect(domainScore).toBeGreaterThan(0);
    expect(domainScore).toBeCloseTo(0.02, 6);
  });

  it("getActivityScore respects recency window and recency boost", () => {
    // Seed bookmarks: 4 total, but only 2 within last 7 days; one of the recent ones has the tag
    const insertBookmark = db.prepare(
      "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    insertBookmark.run("ba", userId, "https://example.com/old", "Old", isoDaysAgo(30)); // outside 7d
    insertBookmark.run("bb", userId, "https://example.com/recent1", "Recent1", isoDaysAgo(2)); // recent
    insertBookmark.run("bc", userId, "https://example.com/recent2", "Recent2", isoDaysAgo(1)); // recent
    insertBookmark.run("bd", userId, "https://example.com/older", "Older", isoDaysAgo(15)); // outside 7d

    const insertTag = db.prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)");
    const tagInfo = insertTag.run(userId, "hot");
    const tagId = tagInfo.lastInsertRowid;

    const insertBT = db.prepare("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    // only one recent bookmark has the tag
    insertBT.run("bb", tagId);

    // recentQuery.count = 2 (bb, bc)
    // recentTagged.count = 1 (bb)
    // frequency = 1/2 = 0.5
    // recencyBoost (days=7) = 1.2
    // expected = 0.5 * 1.2 = 0.6
    const activityScore = so.getActivityScore(db, userId, "hot", 7);
    expect(activityScore).toBeGreaterThan(0);
    expect(activityScore).toBeCloseTo(0.6, 4);
  });

  it("getSimilarityScore detects token overlap and tag co-occurrence", () => {
    // Seed bookmarks that will be used to detect similarity
    // We'll create one bookmark that shares a token with the target URL and has the tag 'simtag'
    const insertBookmark = db.prepare(
      "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, ?)",
    );

    // Similar bookmark: title and url contain the token 'awesome'
    insertBookmark.run("s1", userId, "https://example.com/awesome-post", "Awesome Post", isoDaysAgo(3));
    // Non-similar bookmark: different tokens
    insertBookmark.run("s2", userId, "https://other.com/unrelated", "Unrelated", isoDaysAgo(4));

    const insertTag = db.prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)");
    const tagInfo = insertTag.run(userId, "simtag");
    const tagId = tagInfo.lastInsertRowid;

    const insertBT = db.prepare("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    insertBT.run("s1", tagId);

    // Now call getSimilarityScore using a URL that tokenizes to include 'awesome'
    const simScore = so.getSimilarityScore(db, userId, "https://example.com/awesome", "simtag");
    expect(simScore).toBeGreaterThan(0);
    expect(simScore).toBeLessThanOrEqual(1.0);
  });

  it("calculateTagScore combines domain, activity and similarity into an aggregate", () => {
    // Setup a combined scenario similar to the previous tests
    const insertBookmark = db.prepare(
      "INSERT INTO bookmarks (id, user_id, url, title, created_at) VALUES (?, ?, ?, ?, ?)",
    );

    // Two bookmarks on example.com (one recent and tagged), one unrelated
    insertBookmark.run("c1", userId, "https://example.com/recent", "Recent Example", isoDaysAgo(2));
    insertBookmark.run("c2", userId, "https://example.com/older", "Older Example", isoDaysAgo(30));
    insertBookmark.run("c3", userId, "https://other.com/x", "Other", isoDaysAgo(1));

    const insertTag = db.prepare("INSERT INTO tags (user_id, name) VALUES (?, ?)");
    const tagInfo = insertTag.run(userId, "combo");
    const tagId = tagInfo.lastInsertRowid;

    const insertBT = db.prepare("INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)");
    // Tag only the recent example bookmark
    insertBT.run("c1", tagId);

    // Similar bookmark to influence similarity score
    insertBookmark.run("c4", userId, "https://example.com/similar-thing", "Similar Thing", isoDaysAgo(3));
    insertBT.run("c4", tagId);

    // Compute individual components to verify aggregation
    const domainScore = so.getDomainScore(db, userId, "example.com", "combo");
    const activityScore = so.getActivityScore(db, userId, "combo", 7);
    const similarityScore = so.getSimilarityScore(db, userId, "https://example.com/recent", "combo");

    const aggregated = so.calculateTagScore(db, userId, "https://example.com/recent", "combo", {
      domain: 0.35,
      activity: 0.4,
      similarity: 0.25,
    });

    // check that calculateTagScore returns the same components
    expect(aggregated.domainScore).toBeCloseTo(domainScore, 8);
    expect(aggregated.activityScore).toBeCloseTo(activityScore, 8);
    expect(aggregated.similarityScore).toBeCloseTo(similarityScore, 8);

    // and overall score should be the weighted sum (within rounding limits)
    const expectedTotal = domainScore * 0.35 + activityScore * 0.4 + similarityScore * 0.25;
    expect(aggregated.score).toBeCloseTo(Math.min(expectedTotal, 1.0), 8);
  });
});
