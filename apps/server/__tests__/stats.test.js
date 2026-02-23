/**
 * Stats API Integration Tests
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-stats.db");

process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-stats";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;

function cleanup() {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

afterAll(() => cleanup());

describe("Stats API", () => {
  beforeAll(async () => {
    agent = request.agent(app);
    const unique = Date.now();
    const res = await agent.post("/api/auth/register").send({
      email: `stats_${unique}@test.com`,
      password: "TestPass123!",
    });
    expect(res.status).toBe(200);
    csrfToken = res.body.csrfToken;
  });

  describe("GET /api/stats", () => {
    it("returns stats for user", async () => {
      const res = await agent.get("/api/stats").set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total_bookmarks");
      expect(res.body).toHaveProperty("total_folders");
      expect(res.body).toHaveProperty("total_tags");
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/stats");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/stats/advanced", () => {
    it("returns advanced stats", async () => {
      const res = await agent
        .get("/api/stats/advanced")
        .set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("top_tags");
    });

    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/stats/advanced");
      expect(res.status).toBe(401);
    });
  });
});
