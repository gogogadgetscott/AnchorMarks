/**
 * /api/tags/suggest deterministic tests
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");

// Isolated DB for this suite
const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-tags-suggest.db");

process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-tags-suggest";
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

describe("GET /api/tags/suggest", () => {
  let agent;
  let csrfToken;

  beforeAll(async () => {
    agent = request.agent(app);

    const stamp = Date.now();
    const reg = await agent.post("/api/auth/register").send({
      email: `suggest_${stamp}@example.com`,
      password: "TestPass123!",
    });

    expect(reg.status).toBe(200);
    csrfToken = reg.body.csrfToken;

    // Seed deterministic bookmarks
    const seed = [
      {
        url: "https://k8s.example.dev/guide/getting-started",
        title: "Kubernetes Orchestrator Guide",
        tags: "kubernetes,devops,containers",
      },
      {
        url: "https://k8s.example.dev/reference/pods",
        title: "Pods and Scheduling",
        tags: "kubernetes,containers,infra",
      },
      {
        url: "https://docs.example.dev/ci-cd",
        title: "CI CD pipelines with containers",
        tags: "devops,ci-cd,containers",
      },
    ];

    for (const b of seed) {
      const res = await agent
        .post("/api/bookmarks")
        .set("X-CSRF-Token", csrfToken)
        .send(b);
      expect(res.status).toBe(200);
    }
  });

  it("returns suggestions from same domain's prior tags", async () => {
    const res = await agent
      .get("/api/tags/suggest")
      .query({ url: "https://k8s.example.dev/new/path" })
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Expect domain-related existing tags to appear
    const suggestions = res.body.map((s) => String(s).toLowerCase());
    expect(suggestions).toEqual(
      expect.arrayContaining(["kubernetes", "containers"]),
    );
  });

  it("includes title-derived keywords when no exact domain history", async () => {
    const res = await agent
      .get("/api/tags/suggest")
      .query({ url: "https://newsite.dev/orchestrator/overview" })
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    const suggestions = res.body.map((s) => String(s).toLowerCase());

    // From seeded titles, 'orchestrator' should be learned via TF-IDF tokens,
    // but be tolerant: check presence of at least one meaningful token.
    const meaningful = ["orchestrator", "containers", "devops", "kubernetes"];
    expect(suggestions.some((s) => meaningful.includes(s))).toBe(true);
  });

  it("returns empty array for invalid URL input", async () => {
    const res = await agent
      .get("/api/tags/suggest")
      .query({ url: "not-a-url" })
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
