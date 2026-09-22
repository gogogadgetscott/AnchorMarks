/**
 * Search coverage tests.
 *
 * Verifies that the full-text search matches every searchable property:
 * title, URL, description, tags, and folder name — and that folder renames
 * stay in sync with the FTS index.
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");

const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-search-coverage.db",
);

process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-search-coverage";
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

describe("Search coverage", () => {
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = request.agent(app);

    const registerRes = await agent.post("/api/auth/register").send({
      email: `search_${Date.now()}@example.com`,
      password: "TestPass123!",
    });
    expect(registerRes.status).toBe(200);
    csrfToken = registerRes.body.csrfToken;
  });

  let bookmarkId;
  let folderId;

  beforeAll(async () => {
    // Create a folder and a bookmark with a distinct title/url/description/tags
    const folder = await agent
      .post("/api/folders")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: `Zen Garden ${Date.now()}` });
    expect(folder.status).toBe(200);
    folderId = folder.body.id;

    const bookmark = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        title: "Aardvark Algebra Adventures",
        url: "https://aardvark.example/algebra",
        description: "Equations for eager aardvarks",
        tags: "math, puzzles",
        folder_id: folderId,
      });
    expect(bookmark.status).toBe(200);
    bookmarkId = bookmark.body.id;
  });

  async function search(term) {
    const res = await agent
      .get("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .query({ search: term, limit: 50 });
    expect(res.status).toBe(200);
    const list = res.body.bookmarks || res.body;
    return list.some((b) => b.id === bookmarkId);
  }

  it("matches titles", async () => {
    expect(await search("Aardvark")).toBe(true);
  });

  it("matches URLs", async () => {
    expect(await search("aardvark.example")).toBe(true);
  });

  it("matches descriptions", async () => {
    expect(await search("Equations")).toBe(true);
  });

  it("matches tags", async () => {
    expect(await search("puzzles")).toBe(true);
  });

  it("matches folder names", async () => {
    const name = app.db
      .prepare("SELECT name FROM folders WHERE id = ?")
      .get(folderId).name;
    expect(await search(name.split(" ")[1])).toBe(true);
    expect(await search(name.split(" ")[0])).toBe(true);
  });

  it("keeps folder names in sync after a folder rename", async () => {
    const name = app.db
      .prepare("SELECT name FROM folders WHERE id = ?")
      .get(folderId).name;

    const renamed = await agent
      .put(`/api/folders/${folderId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Lunar Landing Pads" });
    expect(renamed.status).toBe(200);

    // New folder name should now match, old name should not.
    expect(await search("Lunar")).toBe(true);
    const oldWord = name.split(" ")[0];
    expect(await search(oldWord)).toBe(false);
  });

  it("matches folder names via quick-search", async () => {
    const res = await agent
      .get("/api/quick-search")
      .set("X-CSRF-Token", csrfToken)
      .query({ q: "lunar", limit: 20 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((b) => b.id === bookmarkId)).toBe(true);
  });
});
