// tests for folders controller
const request = require("supertest");
const path = require("path");
const fs = require("fs");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-folders.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-folders";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let folderId;

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = {
    email: `foldertest${unique}@example.com`,
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

describe("Folders Controller", () => {
  it("creates a folder", async () => {
    const res = await agent
      .post("/api/folders")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Test Folder", color: "#ff0000" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe("Test Folder");
    folderId = res.body.id;
  });

  it("lists folders", async () => {
    const res = await agent.get("/api/folders").set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((f) => f.id === folderId);
    expect(found).toBeTruthy();
  });

  it("updates a folder", async () => {
    const res = await agent
      .put(`/api/folders/${folderId}`)
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "Updated Folder", color: "#00ff00" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Folder");
  });

  it("deletes a folder", async () => {
    const res = await agent
      .delete(`/api/folders/${folderId}`)
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
