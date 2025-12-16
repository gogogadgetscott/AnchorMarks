const fs = require("fs");
const path = require("path");
const request = require("supertest");

// Isolated database for this test suite
const TEST_DB_PATH = path.join(__dirname, "anchormarks-tags-analytics-test.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let csrfToken;
let agent;

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = {
    email: `analytics${unique}@example.com`,
    password: "password123",
  };

  const register = await agent.post("/api/auth/register").send(user);
  if (register.status !== 200) {
    throw new Error(`Register failed: ${register.status}`);
  }
  csrfToken = register.body.csrfToken;

  // Seed a few bookmarks with tags
  const b1 = await agent
    .post("/api/bookmarks")
    .set("X-CSRF-Token", csrfToken)
    .send({ url: "https://a.example", title: "A", tags: "alpha, beta" });
  expect(b1.status).toBe(200);

  const b2 = await agent
    .post("/api/bookmarks")
    .set("X-CSRF-Token", csrfToken)
    .send({ url: "https://b.example", title: "B", tags: "beta, gamma" });
  expect(b2.status).toBe(200);

  const b3 = await agent
    .post("/api/bookmarks")
    .set("X-CSRF-Token", csrfToken)
    .send({ url: "https://c.example", title: "C", tags: "alpha" });
  expect(b3.status).toBe(200);
});

afterAll(() => {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Tag Analytics Endpoint", () => {
  it("returns usage stats and co-occurrence pairs", async () => {
    const res = await agent
      .get("/api/tags/analytics")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.tags)).toBe(true);
    expect(Array.isArray(res.body.cooccurrence)).toBe(true);

    // Top tags should include beta with count 2
    const beta = res.body.tags.find((t) => t.name === "beta");
    expect(beta).toBeTruthy();
    expect(beta.count).toBe(2);

    // Co-occurrence should include alpha+beta and beta+gamma
    const pairAlphaBeta = res.body.cooccurrence.find(
      (p) =>
        (p.tag_name_a === "alpha" && p.tag_name_b === "beta") ||
        (p.tag_name_a === "beta" && p.tag_name_b === "alpha"),
    );
    const pairBetaGamma = res.body.cooccurrence.find(
      (p) =>
        (p.tag_name_a === "beta" && p.tag_name_b === "gamma") ||
        (p.tag_name_a === "gamma" && p.tag_name_b === "beta"),
    );
    expect(pairAlphaBeta).toBeTruthy();
    expect(pairAlphaBeta.count).toBeGreaterThanOrEqual(1);
    expect(pairBetaGamma).toBeTruthy();
    expect(pairBetaGamma.count).toBeGreaterThanOrEqual(1);
  });
});
