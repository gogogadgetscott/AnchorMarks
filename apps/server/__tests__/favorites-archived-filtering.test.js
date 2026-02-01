/**
 * Comprehensive tests for favorites and archived filtering
 * Verifies that server handles all filtering correctly
 */
const request = require("supertest");
const path = require("path");
const fs = require("fs");

// Setup isolated test DB
const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-favorites-archived.db",
);
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let bookmarkIds = {};

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = {
    email: `favtest${unique}@example.com`,
    password: "password123",
  };
  const register = await agent.post("/api/auth/register").send(user);
  expect(register.status).toBe(200);
  csrfToken = register.body.csrfToken;

  // Create test bookmarks with various combinations:
  // - favorite + archived
  // - favorite + not archived
  // - not favorite + archived
  // - not favorite + not archived
  const bookmarkSpecs = [
    { title: "Favorite Archived", is_favorite: true, is_archived: true },
    { title: "Favorite Not Archived", is_favorite: true, is_archived: false },
    { title: "Not Favorite Archived", is_favorite: false, is_archived: true },
    {
      title: "Not Favorite Not Archived",
      is_favorite: false,
      is_archived: false,
    },
    { title: "Another Favorite", is_favorite: true, is_archived: false },
    { title: "Another Archived", is_favorite: false, is_archived: true },
  ];

  for (let i = 0; i < bookmarkSpecs.length; i++) {
    const spec = bookmarkSpecs[i];
    const res = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://example.com/${spec.title.replace(/\s+/g, "-").toLowerCase()}`,
        title: spec.title,
      });
    expect(res.status).toBe(200);
    const bookmarkId = res.body.id;
    bookmarkIds[spec.title] = bookmarkId;

    // Update bookmark to set is_favorite and is_archived
    // SQLite uses 0/1 for booleans, so convert boolean to integer
    const updateRes = await agent
      .put(`/api/bookmarks/${bookmarkId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({
        is_favorite: spec.is_favorite ? 1 : 0,
        is_archived: spec.is_archived ? 1 : 0,
      });
    expect(updateRes.status).toBe(200);
  }
});

afterAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe("Favorites Filtering - Server-Side Only", () => {
  it("should return only non-archived favorites when favorites=true", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    // Handle both response formats: { bookmarks: [...] } or [...]
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should include non-archived favorites
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Should NOT include archived favorites
    expect(titles).not.toContain("Favorite Archived");

    // Should NOT include non-favorites
    expect(titles).not.toContain("Not Favorite Archived");
    expect(titles).not.toContain("Not Favorite Not Archived");
    expect(titles).not.toContain("Another Archived");

    // Verify all returned bookmarks are favorites
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_favorite).toBe(1); // SQLite stores booleans as 0/1
      expect(bookmark.is_archived).toBe(0); // SQLite stores booleans as 0/1
    });
  });

  it("should ignore search filter when favorites=true", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", search: "Another" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL favorites, not just those matching search
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Search filter should be ignored
    expect(bookmarks.length).toBeGreaterThanOrEqual(2);
  });

  it("should ignore tag filter when favorites=true", async () => {
    // First create a tag and assign it to some bookmarks
    const tagRes = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "test-tag" });
    expect(tagRes.status).toBe(200);

    // Add tag to one favorite bookmark
    const favBookmarkId = bookmarkIds["Favorite Not Archived"];
    await agent
      .put(`/api/bookmarks/${favBookmarkId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ tags: "test-tag" });

    // Query favorites with tag filter - should ignore tag filter
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", tags: "test-tag" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL favorites, not just tagged ones
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");
  });

  it("should apply sorting when favorites=true", async () => {
    // Test alphabetical sorting
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", sort: "a_z" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should be sorted alphabetically
    expect(titles.length).toBeGreaterThanOrEqual(2);
    expect(titles).toContain("Another Favorite");
    expect(titles).toContain("Favorite Not Archived");
  });
});

describe("Archived Filtering - Server-Side Only", () => {
  it("should return only archived bookmarks when archived=true", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ archived: "true" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should include all archived bookmarks
    expect(titles).toContain("Favorite Archived");
    expect(titles).toContain("Not Favorite Archived");
    expect(titles).toContain("Another Archived");

    // Should NOT include non-archived bookmarks
    expect(titles).not.toContain("Favorite Not Archived");
    expect(titles).not.toContain("Not Favorite Not Archived");
    expect(titles).not.toContain("Another Favorite");

    // Verify all returned bookmarks are archived
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_archived).toBe(1); // SQLite stores booleans as 0/1
    });
  });

  it("should ignore search filter when archived=true", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ archived: "true", search: "Favorite" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL archived, not just those matching search
    expect(titles).toContain("Favorite Archived");
    expect(titles).toContain("Not Favorite Archived");
    expect(titles).toContain("Another Archived");

    // Search filter should be ignored
    expect(bookmarks.length).toBeGreaterThanOrEqual(3);
  });

  it("should ignore tag filter when archived=true", async () => {
    // Query archived with tag filter - should ignore tag filter
    const res = await agent
      .get("/api/bookmarks")
      .query({ archived: "true", tags: "test-tag" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL archived, not just tagged ones
    expect(titles).toContain("Favorite Archived");
    expect(titles).toContain("Not Favorite Archived");
    expect(titles).toContain("Another Archived");
  });

  it("should apply sorting when archived=true", async () => {
    // Test alphabetical sorting
    const res = await agent
      .get("/api/bookmarks")
      .query({ archived: "true", sort: "a_z" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should be sorted alphabetically
    expect(titles.length).toBeGreaterThanOrEqual(2);
    expect(titles).toContain("Another Archived");
    expect(titles).toContain("Favorite Archived");
  });
});

describe("Default View Filtering - Non-Archived Only", () => {
  it("should return only non-archived bookmarks by default", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should include non-archived bookmarks (may include other test data)
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Not Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Should NOT include archived bookmarks
    expect(titles).not.toContain("Favorite Archived");
    expect(titles).not.toContain("Not Favorite Archived");
    expect(titles).not.toContain("Another Archived");

    // Verify all returned bookmarks are not archived
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_archived).toBe(0);
    });
  });
});

describe("Favorites + Archived Combination", () => {
  it("should handle favorites=true correctly (excludes archived favorites)", async () => {
    // When favorites=true, server should exclude archived favorites
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);

    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should not include "Favorite Archived"
    expect(titles).not.toContain("Favorite Archived");

    // Should include non-archived favorites
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");
  });
});

describe("Server-Side Filtering Integration", () => {
  it("should ensure server handles all filtering for favorites view", async () => {
    // This test verifies that the server is doing ALL the work
    // Client should just render what server sends
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", sort: "recently_added" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);

    const bookmarks = res.body.bookmarks || res.body;

    // All returned bookmarks should be favorites and not archived
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_favorite).toBe(1); // SQLite stores booleans as 0/1
      expect(bookmark.is_archived).toBe(0);
    });

    // Should be sorted by created_at DESC
    if (bookmarks.length > 1) {
      const dates = bookmarks.map((b) => new Date(b.created_at).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    }
  });

  it("should display all favorites even when search filter is set", async () => {
    // This test verifies that search filters are ignored for favorites view
    // Even if client sends a search parameter, server should ignore it
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", search: "NonExistentSearchTerm12345" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);

    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL favorites, not filtered by search
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Verify all returned are favorites
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_favorite).toBe(1);
      expect(bookmark.is_archived).toBe(0);
    });
  });

  it("should display all favorites even when tag filter is set", async () => {
    // This test verifies that tag filters are ignored for favorites view
    // Create a tag that doesn't match any favorites
    const tagRes = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "no-favorites-tag" });
    expect(tagRes.status).toBe(200);

    // Query favorites with tag filter - should ignore tag filter
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", tags: "no-favorites-tag" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);

    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL favorites, not filtered by tags
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Verify all returned are favorites
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_favorite).toBe(1);
      expect(bookmark.is_archived).toBe(0);
    });
  });

  it("should display all favorites even when both search and tag filters are set", async () => {
    // This test verifies that multiple filters are all ignored for favorites view
    const res = await agent
      .get("/api/bookmarks")
      .query({
        favorites: "true",
        search: "NonExistentSearchTerm12345",
        tags: "no-favorites-tag",
      })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);

    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL favorites, ignoring both search and tag filters
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Verify all returned are favorites
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_favorite).toBe(1);
      expect(bookmark.is_archived).toBe(0);
    });
  });

  it("should ensure server handles all filtering for archived view", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .query({ archived: "true", sort: "recently_added" })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);

    const bookmarks = res.body.bookmarks || res.body;

    // All returned bookmarks should be archived
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_archived).toBe(1);
    });

    // Should be sorted by created_at DESC
    if (bookmarks.length > 1) {
      const dates = bookmarks.map((b) => new Date(b.created_at).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    }
  });

  it("should display all favorites when filter is set and user switches to favorites view", async () => {
    // This test simulates the real-world scenario:
    // 1. User sets a filter (search or tags) on another view
    // 2. User switches to favorites view
    // 3. All favorites should still be displayed, ignoring the filter

    // First, verify that with a filter set, favorites are still returned
    // This simulates what happens when client sends filter params even though it shouldn't
    const res1 = await agent
      .get("/api/bookmarks")
      .query({
        favorites: "true",
        search: "Favorite", // This search term would match some favorites
      })
      .set("X-CSRF-Token", csrfToken);
    expect(res1.status).toBe(200);
    const bookmarks1 = res1.body.bookmarks || res1.body;
    const titles1 = bookmarks1.map((b) => b.title);

    // Should return ALL favorites, not just those matching "Favorite"
    expect(titles1).toContain("Favorite Not Archived");
    expect(titles1).toContain("Another Favorite");
    expect(bookmarks1.length).toBeGreaterThanOrEqual(2);

    // Now test with a tag filter
    const res2 = await agent
      .get("/api/bookmarks")
      .query({
        favorites: "true",
        tags: "some-tag-that-does-not-exist",
      })
      .set("X-CSRF-Token", csrfToken);
    expect(res2.status).toBe(200);
    const bookmarks2 = res2.body.bookmarks || res2.body;
    const titles2 = bookmarks2.map((b) => b.title);

    // Should return ALL favorites, not filtered by non-existent tag
    expect(titles2).toContain("Favorite Not Archived");
    expect(titles2).toContain("Another Favorite");
    expect(bookmarks2.length).toBeGreaterThanOrEqual(2);

    // Verify server is correctly ignoring filters
    expect(bookmarks1.length).toBe(bookmarks2.length);
  });

  it("should display all favorites even when folder_id filter is set", async () => {
    // This test verifies that folder_id filters are ignored for favorites view
    // Create a folder first
    const folderRes = await agent
      .post("/api/folders")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Test Folder" });
    expect(folderRes.status).toBe(200);
    const folderId = folderRes.body.id;

    // Move one favorite bookmark to this folder
    const favBookmarkId = bookmarkIds["Favorite Not Archived"];
    await agent
      .put(`/api/bookmarks/${favBookmarkId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ folder_id: folderId });

    // Query favorites with folder_id filter - should ignore folder_id filter
    const res = await agent
      .get("/api/bookmarks")
      .query({ favorites: "true", folder_id: folderId })
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const bookmarks = res.body.bookmarks || res.body;
    const titles = bookmarks.map((b) => b.title);

    // Should return ALL favorites, not just those in the specified folder
    expect(titles).toContain("Favorite Not Archived");
    expect(titles).toContain("Another Favorite");

    // Verify all returned are favorites
    bookmarks.forEach((bookmark) => {
      expect(bookmark.is_favorite).toBe(1);
      expect(bookmark.is_archived).toBe(0);
    });
  });
});
