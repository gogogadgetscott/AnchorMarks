/**
 * Regression tests for tag & search reliability:
 *  - case-insensitive tag resolution (no duplicate "React"/"react" tags)
 *  - tag counts exclude archived bookmarks
 *  - create/update reject case-variant duplicates
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");

const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-tags-reliability.db",
);

process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-tags-reliability";
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

describe("Tag & search reliability", () => {
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = request.agent(app);

    const registerRes = await agent.post("/api/auth/register").send({
      email: `reliability_${Date.now()}@example.com`,
      password: "TestPass123!",
    });

    expect(registerRes.status).toBe(200);
    csrfToken = registerRes.body.csrfToken;
  });

  it("resolves case-variant tag names to a single tag (no duplicates)", async () => {
    const unique = `case${Date.now()}`;

    const b1 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://case.example/${unique}/1`,
        title: "One",
        tags: unique,
      });

    const b2 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://case.example/${unique}/2`,
        title: "Two",
        tags: unique.toUpperCase(),
      });

    expect(b1.status).toBe(200);
    expect(b2.status).toBe(200);
    expect(b2.body.tags).toContain(unique);

    const tagsRes = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);

    expect(tagsRes.status).toBe(200);
    const matches = tagsRes.body.filter((t) => t.name.toLowerCase() === unique);
    expect(matches.length).toBe(1);
    expect(matches[0].count).toBe(2);
  });

  it("rejects creating a tag that differs only by case from an existing tag", async () => {
    const unique = `dupe${Date.now()}`;

    const create = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: unique });
    expect(create.status).toBe(200);

    const dup = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: unique.toUpperCase() });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatch(/already exists/i);
  });

  it("rejects renaming a tag into a case-variant duplicate", async () => {
    const keep = `keep${Date.now()}`;
    const renameTarget = `target${Date.now()}`;

    await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: keep });

    const target = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: renameTarget });
    expect(target.status).toBe(200);

    const res = await agent
      .put(`/api/tags/${target.body.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: keep.toUpperCase() });
    expect(res.status).toBe(409);
  });

  it("excludes archived bookmarks from tag counts", async () => {
    const unique = `arch${Date.now()}`;

    const b1 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://arch.example/${unique}/1`,
        title: "Arch One",
        tags: unique,
      });

    const b2 = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://arch.example/${unique}/2`,
        title: "Arch Two",
        tags: unique,
      });

    expect(b1.status).toBe(200);
    expect(b2.status).toBe(200);

    const archiveRes = await agent
      .post(`/api/bookmarks/${b1.body.id}/archive`)
      .set("X-CSRF-Token", csrfToken);
    expect(archiveRes.status).toBe(200);

    const tagsRes = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);

    const tag = tagsRes.body.find((t) => t.name === unique);
    expect(tag).toBeTruthy();
    expect(tag.count).toBe(1);
  });

  it("still finds bookmarks by tag via search after normalization", async () => {
    const unique = `ftstag${Date.now()}`;

    const bm = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: `https://ftstag.example/${unique}`,
        title: "FTS Tag Bookmark",
        tags: unique,
      });
    expect(bm.status).toBe(200);

    // Search for the tag name via the main /bookmarks FTS search
    const list = await agent
      .get("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .query({ search: unique });
    expect(list.status).toBe(200);
    const bookmarks = list.body.bookmarks || list.body;
    const hit = bookmarks.find((b) => b.id === bm.body.id);
    expect(hit).toBeTruthy();
  });
});
