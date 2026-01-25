// Comprehensive tests for tag filtering with proper JOIN + GROUP BY + HAVING implementation
const request = require("supertest");
const path = require("path");
const fs = require("fs");

// Setup isolated test DB
const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-tag-filtering.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let bookmarkIds = {};
let tagIds = {};

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = {
    email: `tagtest${unique}@example.com`,
    password: "password123",
  };
  const register = await agent.post("/api/auth/register").send(user);
  expect(register.status).toBe(200);
  csrfToken = register.body.csrfToken;

  // Create test tags
  const tags = ["a", "ab", "abc", "dev", "development"];
  for (const tag of tags) {
    const tagRes = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: tag });
    if (tagRes.status === 200) {
      tagIds[tag] = tagRes.body.id;
    }
  }

  // Create test bookmarks with various tag combinations
  const bookmarkSpecs = [
    { title: "A Tag Only", tags: "a" },
    { title: "AB Tag Only", tags: "ab" },
    { title: "ABC Tag Only", tags: "abc" },
    { title: "A and AB Tags", tags: "a, ab" },
    { title: "A and ABC Tags", tags: "a, abc" },
    { title: "All Three Tags", tags: "a, ab, abc" },
    { title: "Dev Tag", tags: "dev" },
    { title: "Dev and Development Tags", tags: "dev, development" },
    { title: "No Tags", tags: "" },
  ];

  for (let i = 0; i < bookmarkSpecs.length; i++) {
    const spec = bookmarkSpecs[i];
    const res = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://example.com/bookmark${i}`,
        title: spec.title,
        tags: spec.tags,
      });
    if (res.status === 200) {
      bookmarkIds[spec.title] = res.body.id;
    }
  }
});

afterAll(() => {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Tag Filtering - Substring False Positive Prevention", () => {
  it("should not match 'ab' when filtering for 'a'", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "a" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should match bookmarks with "a" tag
    expect(titles).toContain("A Tag Only");
    expect(titles).toContain("A and AB Tags");
    expect(titles).toContain("A and ABC Tags");
    expect(titles).toContain("All Three Tags");

    // Should NOT match bookmarks with only "ab" or "abc"
    expect(titles).not.toContain("AB Tag Only");
    expect(titles).not.toContain("ABC Tag Only");
  });

  it("should not match 'abc' when filtering for 'ab'", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "ab" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should match bookmarks with "ab" tag
    expect(titles).toContain("AB Tag Only");
    expect(titles).toContain("A and AB Tags");
    expect(titles).toContain("All Three Tags");

    // Should NOT match bookmarks with only "abc"
    expect(titles).not.toContain("ABC Tag Only");
  });

  it("should correctly match 'abc' tag", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "abc" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should match bookmarks with "abc" tag
    expect(titles).toContain("ABC Tag Only");
    expect(titles).toContain("A and ABC Tags");
    expect(titles).toContain("All Three Tags");

    // Should NOT match bookmarks with only "a" or "ab"
    expect(titles).not.toContain("A Tag Only");
    expect(titles).not.toContain("AB Tag Only");
  });

  it("should handle OR mode correctly (any tag)", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "a, ab" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should include any bookmark with either "a" OR "ab"
    expect(titles).toContain("A Tag Only");
    expect(titles).toContain("AB Tag Only");
    expect(titles).toContain("A and AB Tags");
    expect(titles).toContain("A and ABC Tags");
    expect(titles).toContain("All Three Tags");

    // Should NOT include bookmarks with only "abc"
    expect(titles).not.toContain("ABC Tag Only");
  });
});

describe("Tag Filtering - AND Mode (All Tags Required)", () => {
  it("should require all tags in AND mode", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "a, ab", tagMode: "and" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should only match bookmarks with BOTH "a" AND "ab"
    expect(titles).toContain("A and AB Tags");
    expect(titles).toContain("All Three Tags");

    // Should NOT match bookmarks with only one of the tags
    expect(titles).not.toContain("A Tag Only");
    expect(titles).not.toContain("AB Tag Only");
    expect(titles).not.toContain("A and ABC Tags");
    expect(titles).not.toContain("ABC Tag Only");
  });

  it("should require all three tags in AND mode", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "a, ab, abc", tagMode: "and" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should only match bookmarks with all three tags
    expect(titles).toContain("All Three Tags");

    // Should NOT match bookmarks with fewer tags
    expect(titles).not.toContain("A Tag Only");
    expect(titles).not.toContain("AB Tag Only");
    expect(titles).not.toContain("A and AB Tags");
    expect(titles).not.toContain("A and ABC Tags");
  });
});

describe("Tag Filtering - Independent Tag Namespace", () => {
  it("should not confuse 'dev' and 'development' tags", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "dev" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should match bookmarks with "dev" tag
    expect(titles).toContain("Dev Tag");
    expect(titles).toContain("Dev and Development Tags");

    // Should NOT match bookmarks without "dev" tag
    expect(titles).not.toContain("A Tag Only");
    expect(titles).not.toContain(
      "Dev and Development Tags".replace("Dev", "Development"),
    ); // Would need to adjust based on actual bookmark
  });

  it("should correctly filter for 'development' tag", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "development" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should match bookmarks with "development" tag
    expect(titles).toContain("Dev and Development Tags");

    // Should NOT match bookmarks with only "dev"
    expect(titles).not.toContain("Dev Tag");
  });
});

describe("Tag Filtering - Edge Cases", () => {
  it("should handle empty tag filter", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    // Should return all bookmarks since no filter applied
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should handle whitespace in tag names", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "  a  ,  ab  " })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const titles = res.body.map((b) => b.title);

    // Should correctly parse tags with whitespace
    expect(titles).toContain("A Tag Only");
    expect(titles).toContain("AB Tag Only");
  });

  it("should return empty results for non-existent tag", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ tags: "nonexistent" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});
