// tests for bookmarks controller
const request = require("supertest");
const path = require("path");
const fs = require("fs");

// Setup isolated test DB
const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-bookmarks.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let bookmarkId;
let completedBookmarkId;

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = {
    email: `bmtest${unique}@example.com`,
    password: "password123",
  };
  const register = await agent.post("/api/auth/register").send(user);
  expect(register.status).toBe(200);
  csrfToken = register.body.csrfToken;
});

afterAll(() => {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Bookmarks Controller", () => {
  it("creates a bookmark", async () => {
    const res = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({ url: "https://example.com", title: "Example" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    bookmarkId = res.body.id;
  });

  it("creates a bookmark with folder_id: null", async () => {
    const res = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/top-level",
        title: "Top Level",
        folder_id: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.folder_id).toBeNull();
  });

  it("updates a bookmark to remove folder assignment", async () => {
    const folder = await agent
      .post("/api/folders")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Temp Folder", color: "#6366f1" });
    expect(folder.status).toBe(200);

    const create = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.com/in-folder",
        title: "In Folder",
        folder_id: folder.body.id,
      });
    expect(create.status).toBe(200);
    expect(create.body.folder_id).toBe(folder.body.id);

    const update = await agent
      .put(`/api/bookmarks/${create.body.id}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ folder_id: null });
    expect(update.status).toBe(200);
    expect(update.body.folder_id).toBeNull();
  });

  it("lists bookmarks and includes created one", async () => {
    const res = await agent
      .get("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    const found = res.body.find((b) => b.id === bookmarkId);
    expect(found).toBeTruthy();
    expect(found.title).toBe("Example");
  });

  it("updates a bookmark", async () => {
    const res = await agent
      .put(`/api/bookmarks/${bookmarkId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ title: "Updated Title", tags: "test" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated Title");
  });

  it("updates reading state and timestamps completed reads", async () => {
    const created = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.org/reading-state",
        title: "Reading State",
      });
    expect(created.status).toBe(200);
    completedBookmarkId = created.body.id;

    const started = await agent
      .post(`/api/bookmarks/${completedBookmarkId}/reading-state`)
      .set("X-CSRF-Token", csrfToken)
      .send({ reading_state: "reading" });
    expect(started.status).toBe(200);
    expect(started.body.data.reading_state).toBe("reading");
    expect(started.body.data.read_at).toBeNull();

    const finished = await agent
      .post(`/api/bookmarks/${completedBookmarkId}/reading-state`)
      .set("X-CSRF-Token", csrfToken)
      .send({ reading_state: "done", archive: true });
    expect(finished.status).toBe(200);
    expect(finished.body.data.reading_state).toBe("done");
    expect(finished.body.data.is_archived).toBe(1);
    expect(finished.body.data.read_at).toBeTruthy();
    expect(finished.body.data.archived_at).toBeTruthy();
  });

  it("bulk updates reading state only for the signed-in user", async () => {
    const otherAgent = request.agent(app);
    const registration = await otherAgent.post("/api/auth/register").send({
      email: `other-reading-test${Date.now()}@example.com`,
      password: "password123",
    });
    expect(registration.status).toBe(200);
    const foreign = await otherAgent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", registration.body.csrfToken)
      .send({ url: "https://example.org/private-read", title: "Private" });
    expect(foreign.status).toBe(200);

    const own = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({ url: "https://example.org/own-read", title: "Own" });
    expect(own.status).toBe(200);

    const result = await agent
      .post("/api/bookmarks/bulk/reading-state")
      .set("X-CSRF-Token", csrfToken)
      .send({ ids: [own.body.id, foreign.body.id], reading_state: "reading" });
    expect(result.status).toBe(200);
    expect(result.body.data.updated).toBe(1);

    const foreignAfter = await otherAgent.get(
      `/api/bookmarks/${foreign.body.id}`,
    );
    expect(foreignAfter.body.reading_state).toBe("unread");
  });

  it("lists the read-later queue and completed archived items", async () => {
    const queued = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.org/queued-read",
        title: "Queued",
        reading_state: "reading",
      });
    expect(queued.status).toBe(200);

    const queue = await agent.get("/api/bookmarks?reading_queue=true");
    expect(queue.status).toBe(200);
    expect(queue.body.map((item) => item.id)).toContain(queued.body.id);
    expect(queue.body.map((item) => item.id)).not.toContain(
      completedBookmarkId,
    );

    const completed = await agent.get(
      "/api/bookmarks?reading_queue=true&reading_state=done",
    );
    expect(completed.body.map((item) => item.id)).toContain(
      completedBookmarkId,
    );
  });

  it("persists link health from single and bulk checks", async () => {
    const created = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "bookmark-view:missing",
        title: "Invalid health target",
      });
    expect(created.status).toBe(200);

    const single = await agent
      .post(`/api/bookmarks/${created.body.id}/check-link`)
      .set("X-CSRF-Token", csrfToken);
    expect(single.status).toBe(200);
    expect(single.body.data.status).toBe("dead");

    const bookmark = await agent.get(`/api/bookmarks/${created.body.id}`);
    expect(bookmark.body.link_health_status).toBe("dead");
    expect(bookmark.body.last_checked).toBeTruthy();

    const bulk = await agent
      .post("/api/bookmarks/bulk/check-links")
      .set("X-CSRF-Token", csrfToken)
      .send({ ids: [created.body.id] });
    expect(bulk.status).toBe(200);
    expect(bulk.body.data.checked).toBe(1);

    const dead = await agent.get("/api/bookmarks?link_health_status=dead");
    expect(dead.body.map((item) => item.id)).toContain(created.body.id);
  });

  it("does not allow another user to modify bookmark tags", async () => {
    const otherAgent = request.agent(app);
    const register = await otherAgent.post("/api/auth/register").send({
      email: `other-bmtest${Date.now()}@example.com`,
      password: "password123",
    });
    expect(register.status).toBe(200);

    const res = await otherAgent
      .put(`/api/bookmarks/${bookmarkId}`)
      .set("X-CSRF-Token", register.body.csrfToken)
      .send({ tags: "attacker-controlled" });
    expect(res.status).toBe(404);

    const list = await agent.get("/api/bookmarks");
    const bookmark = list.body.find((item) => item.id === bookmarkId);
    expect(bookmark.tags).toContain("test");
    expect(bookmark.tags).not.toContain("attacker-controlled");
  });

  it("does not allow assigning another user's folder", async () => {
    const otherAgent = request.agent(app);
    const register = await otherAgent.post("/api/auth/register").send({
      email: `other-folder-test${Date.now()}@example.com`,
      password: "password123",
    });
    expect(register.status).toBe(200);

    const folder = await otherAgent
      .post("/api/folders")
      .set("X-CSRF-Token", register.body.csrfToken)
      .send({ name: "Private folder", color: "#6366f1" });
    expect(folder.status).toBe(200);

    const create = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://example.org/foreign-folder",
        folder_id: folder.body.id,
      });
    expect(create.status).toBe(400);

    const update = await agent
      .put(`/api/bookmarks/${bookmarkId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ folder_id: folder.body.id });
    expect(update.status).toBe(400);
  });

  it("deletes a bookmark", async () => {
    const res = await agent
      .delete(`/api/bookmarks/${bookmarkId}`)
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
  });
});
