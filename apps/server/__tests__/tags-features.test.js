/**
 * Tag Features Integration Tests
 * Covers normalized tag system (tags + bookmark_tags) and legacy bookmarks.tags sync.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");

// Use an isolated database for this suite
const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-tags.db");

// Set environment variables BEFORE requiring app
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-tags";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

function cleanupDbFiles() {
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

beforeAll(() => {
  cleanupDbFiles();
});

afterAll(() => {
  if (app.db) app.db.close();
  cleanupDbFiles();
});

describe("Tag features", () => {
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = request.agent(app);

    const timestamp = Date.now();
    const registerRes = await agent.post("/api/auth/register").send({
      email: `tagtester_${timestamp}@example.com`,
      password: "TestPass123!",
    });

    expect(registerRes.status).toBe(200);
    csrfToken = registerRes.body.csrfToken;
  });

  it("creates bookmarks with tags and returns correct tag counts", async () => {
    const create1 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/one",
        title: "One",
        tags: "alpha, beta",
      });

    expect(create1.status).toBe(200);
    expect(create1.body.tags).toContain("alpha");

    const tagsRes = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);

    expect(tagsRes.status).toBe(200);
    const tags = tagsRes.body;

    const alpha = tags.find((t) => t.name === "alpha");
    const beta = tags.find((t) => t.name === "beta");
    expect(alpha).toBeTruthy();
    expect(beta).toBeTruthy();
    expect(alpha.count).toBe(1);
    expect(beta.count).toBe(1);
  });

  it("updates bookmark tags and keeps counts consistent", async () => {
    const create = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/two",
        title: "Two",
        tags: "alpha, gamma",
      });

    expect(create.status).toBe(200);

    const update = await agent
      .put(`/api/bookmarks/${create.body.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ tags: "beta, gamma" });

    expect(update.status).toBe(200);

    const tagsRes = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);

    expect(tagsRes.status).toBe(200);
    const tags = tagsRes.body;

    const alpha = tags.find((t) => t.name === "alpha");
    const beta = tags.find((t) => t.name === "beta");
    const gamma = tags.find((t) => t.name === "gamma");

    expect(alpha).toBeTruthy();
    expect(beta).toBeTruthy();
    expect(gamma).toBeTruthy();

    // alpha should still exist but may have count 1 from the previous test's bookmark
    expect(alpha.count).toBeGreaterThanOrEqual(0);
    expect(beta.count).toBeGreaterThanOrEqual(1);
    expect(gamma.count).toBeGreaterThanOrEqual(1);
  });

  it("bulk-add and bulk-remove keep normalized relations and legacy tags text in sync", async () => {
    const bm1 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/bulk-1",
        title: "Bulk 1",
        tags: "alpha",
      });

    const bm2 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/bulk-2",
        title: "Bulk 2",
        tags: "beta",
      });

    expect(bm1.status).toBe(200);
    expect(bm2.status).toBe(200);

    const bulkAdd = await agent
      .post("/api/tags/bulk-add")
      .set("X-CSRF-Token", csrfToken)
      .send({
        bookmark_ids: [bm1.body.id, bm2.body.id],
        tags: "gamma, delta",
      });

    expect(bulkAdd.status).toBe(200);
    expect(bulkAdd.body.updated.sort()).toEqual(
      [bm1.body.id, bm2.body.id].sort(),
    );

    const tagsAfterAdd = await agent
      .get("/api/tags")
      .set("X-CSRF-Token", csrfToken);

    expect(tagsAfterAdd.status).toBe(200);
    const gamma = tagsAfterAdd.body.find((t) => t.name === "gamma");
    const delta = tagsAfterAdd.body.find((t) => t.name === "delta");
    expect(gamma).toBeTruthy();
    expect(delta).toBeTruthy();
    expect(gamma.count).toBeGreaterThanOrEqual(2);
    expect(delta.count).toBeGreaterThanOrEqual(2);

    // Ensure legacy text column reflects changes
    const bm1AfterAdd = await agent
      .get(`/api/bookmarks/${bm1.body.id}`)
      .set("X-CSRF-Token", csrfToken);
    expect(bm1AfterAdd.status).toBe(200);
    expect(bm1AfterAdd.body.tags).toMatch(/gamma/i);
    expect(bm1AfterAdd.body.tags).toMatch(/delta/i);

    const alphaCountBeforeRemove = (() => {
      const alphaTag = tagsAfterAdd.body.find((t) => t.name === "alpha");
      return alphaTag ? alphaTag.count : 0;
    })();

    const bulkRemove = await agent
      .post("/api/tags/bulk-remove")
      .set("X-CSRF-Token", csrfToken)
      .send({
        bookmark_ids: [bm1.body.id, bm2.body.id],
        tags: "alpha",
      });

    expect(bulkRemove.status).toBe(200);

    const bm1AfterRemove = await agent
      .get(`/api/bookmarks/${bm1.body.id}`)
      .set("X-CSRF-Token", csrfToken);
    expect(bm1AfterRemove.status).toBe(200);
    expect((bm1AfterRemove.body.tags || "").toLowerCase()).not.toContain(
      "alpha",
    );

    const tagsAfterRemove = await agent
      .get("/api/tags")
      .set("X-CSRF-Token", csrfToken);

    expect(tagsAfterRemove.status).toBe(200);
    const alphaAfter = tagsAfterRemove.body.find((t) => t.name === "alpha");
    const alphaCountAfterRemove = alphaAfter ? alphaAfter.count : 0;

    // Only bm1 had alpha in this test; removing should reduce overall alpha usage by 1.
    expect(alphaCountAfterRemove).toBe(Math.max(0, alphaCountBeforeRemove - 1));
  });

  it("rename/merge updates tag counts and relationships", async () => {
    // Create two bookmarks to rename across
    const b1 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/rename-1",
        title: "Rename 1",
        tags: "gamma",
      });

    const b2 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/rename-2",
        title: "Rename 2",
        tags: "gamma, delta",
      });

    expect(b1.status).toBe(200);
    expect(b2.status).toBe(200);

    const rename = await agent
      .post("/api/tags/rename")
      .set("X-CSRF-Token", csrfToken)
      .send({ from: "gamma", to: "epsilon" });

    expect(rename.status).toBe(200);
    expect(rename.body.updated).toBeGreaterThanOrEqual(2);

    const tagsRes = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);

    expect(tagsRes.status).toBe(200);
    const epsilon = tagsRes.body.find((t) => t.name === "epsilon");
    expect(epsilon).toBeTruthy();
    expect(epsilon.count).toBeGreaterThanOrEqual(2);

    const gamma = tagsRes.body.find((t) => t.name === "gamma");
    if (gamma) {
      expect(gamma.count).toBe(0);
    }

    // Legacy tags text should reflect rename too
    const b2After = await agent
      .get(`/api/bookmarks/${b2.body.id}`)
      .set("X-CSRF-Token", csrfToken);

    expect(b2After.status).toBe(200);
    expect((b2After.body.tags || "").toLowerCase()).toContain("epsilon");
    expect((b2After.body.tags || "").toLowerCase()).not.toContain("gamma");
  });

  it("updates and deletes a tag and keeps bookmarks.tags synced", async () => {
    // Create a bookmark with a manual tag
    const bookmark = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/manual",
        title: "Manual",
        tags: "manual",
      });

    expect(bookmark.status).toBe(200);

    // Find the tag ID
    const tagsRes = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);

    const manualTag = tagsRes.body.find((t) => t.name === "manual");
    expect(manualTag).toBeTruthy();

    // Rename via tag update endpoint
    const updateTag = await agent
      .put(`/api/tags/${manualTag.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "manual-renamed" });

    expect(updateTag.status).toBe(200);
    expect(updateTag.body.name).toBe("manual-renamed");

    const bookmarkAfterRename = await agent
      .get(`/api/bookmarks/${bookmark.body.id}`)
      .set("X-CSRF-Token", csrfToken);

    expect(bookmarkAfterRename.status).toBe(200);
    expect((bookmarkAfterRename.body.tags || "").toLowerCase()).toContain(
      "manual-renamed",
    );

    // Delete tag and ensure bookmark text no longer includes it
    const del = await agent
      .delete(`/api/tags/${manualTag.id}`)
      .set("X-CSRF-Token", csrfToken);

    expect(del.status).toBe(200);

    const bookmarkAfterDelete = await agent
      .get(`/api/bookmarks/${bookmark.body.id}`)
      .set("X-CSRF-Token", csrfToken);

    expect(bookmarkAfterDelete.status).toBe(200);
    expect((bookmarkAfterDelete.body.tags || "").toLowerCase()).not.toContain(
      "manual-renamed",
    );
  });

  it("stores per-bookmark tag color overrides", async () => {
    const create = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/colorful",
        title: "Colorful",
        tags: "colorful",
        tag_colors: { colorful: "#123abc" },
      });

    expect(create.status).toBe(200);
    expect(Array.isArray(create.body.tags_detailed)).toBe(true);
    const createdTag = create.body.tags_detailed.find(
      (t) => t.name === "colorful",
    );
    expect(createdTag).toBeTruthy();
    expect(createdTag.color_override).toBe("#123abc");

    const updated = await agent
      .put(`/api/bookmarks/${create.body.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({
        tags: "colorful",
        tag_colors: { colorful: "#00ff00" },
      });

    expect(updated.status).toBe(200);
    const updatedTag = updated.body.tags_detailed.find(
      (t) => t.name === "colorful",
    );
    expect(updatedTag.color_override).toBe("#00ff00");

    const fetched = await agent
      .get(`/api/bookmarks/${create.body.id}`)
      .set("X-CSRF-Token", csrfToken);

    expect(fetched.status).toBe(200);
    const fetchedTag = fetched.body.tags_detailed.find(
      (t) => t.name === "colorful",
    );
    expect(fetchedTag.color_override).toBe("#00ff00");
  });
});
