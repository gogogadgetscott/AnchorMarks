// tests for tags controller
const request = require("supertest");
const path = require("path");
const fs = require("fs");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-tags.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-tags";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let tagId;

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
});

afterAll(() => {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Tags Controller", () => {
  it("creates a tag", async () => {
    const res = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "test-tag", color: "#ff0000", icon: "star" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("test-tag");
    tagId = res.body.id;
  });

  it("rejects tag creation without name", async () => {
    const res = await agent
      .post("/api/tags")
      .set("X-CSRF-Token", csrfToken)
      .send({ color: "#ff0000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("lists tags", async () => {
    const res = await agent.get("/api/tags").set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((t) => t.id === tagId);
    expect(found).toBeTruthy();
  });

  it("updates a tag", async () => {
    const res = await agent
      .put(`/api/tags/${tagId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "updated-tag", color: "#00ff00" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("updated-tag");
  });

  it("deletes a tag", async () => {
    const res = await agent
      .delete(`/api/tags/${tagId}`)
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
