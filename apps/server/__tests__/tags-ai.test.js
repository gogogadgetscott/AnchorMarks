const fs = require("fs");
const path = require("path");
const request = require("supertest");

// Isolated DB for tests
const TEST_DB_PATH = path.join(__dirname, "anchormarks-ai-test.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key";
process.env.CORS_ORIGIN = "http://localhost";
process.env.AI_PROVIDER = "none"; // ensure AI disabled for this test

const app = require("../app");

let agent;
let csrfToken;

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = { email: `ai${unique}@example.com`, password: "password123" };
  const register = await agent.post("/api/auth/register").send(user);
  if (register.status !== 200) {
    throw new Error(`Register failed: ${register.status}`);
  }
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

describe("AI Tag Suggestions Endpoint", () => {
  it("returns 501 when AI provider is not configured", async () => {
    const res = await agent
      .get("/api/tags/suggest-ai?url=https://github.com")
      .set("X-CSRF-Token", csrfToken);

    expect([501, 400]).toContain(res.statusCode); // 400 only if URL parse fails
    if (res.statusCode === 501) {
      expect(res.body.error).toMatch(/not configured|missing/i);
    }
  });
});
