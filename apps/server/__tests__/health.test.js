// tests for health/management routes
const request = require("supertest");
const path = require("path");
const fs = require("fs");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-health.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-health";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

// Mock metadata fetching to avoid timeouts / network requests
vi.mock("../helpers/metadata", () => ({
  fetchUrlMetadata: vi.fn().mockResolvedValue({
    title: "Mock Title",
    description: "Mock Description",
    og_image: null,
  }),
  detectContentType: vi.fn().mockReturnValue("link"),
}));

let agent;
let csrfToken;

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  const user = {
    email: `health${unique}@example.com`,
    password: "password123",
  };
  const register = await agent.post("/api/auth/register").send(user);
  expect(register.status).toBe(200);
  csrfToken = register.body.csrfToken;

  // Create duplicate bookmarks for testing
  await agent
    .post("/api/bookmarks")
    .set("X-CSRF-Token", csrfToken)
    .send({ url: "https://dup.com", title: "Original" });
  await agent
    .post("/api/bookmarks")
    .set("X-CSRF-Token", csrfToken)
    .send({ url: "https://dup.com", title: "Duplicate" });
}, 30000);

afterAll(() => {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Health API", () => {
  it("detects duplicate bookmarks", async () => {
    const res = await agent
      .get("/api/health/duplicates")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.total_duplicates).toBeGreaterThan(0);
    expect(res.body.duplicates[0].url).toBe("https://dup.com");
  });

  it("cleans up duplicates", async () => {
    const res = await agent
      .post("/api/health/duplicates/cleanup")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBeGreaterThan(0);

    // Verify removed
    const check = await agent
      .get("/api/health/duplicates")
      .set("X-CSRF-Token", csrfToken);
    expect(check.body.total_duplicates).toBe(0);
  });

  it("canonicalizes and resolves duplicate bookmarks", async () => {
    const first = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://canonical.example/article/?utm_source=test",
        title: "Canonical Article",
        tags: "one",
      });
    const second = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({
        url: "https://www.canonical.example/article/",
        title: "Canonical Article",
        tags: "two",
      });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const duplicates = await agent
      .get("/api/health/duplicates")
      .set("X-CSRF-Token", csrfToken);
    expect(duplicates.status).toBe(200);
    const group = duplicates.body.duplicates.find((item) =>
      item.bookmarks.some((bookmark) => bookmark.id === first.body.id),
    );
    expect(group).toBeTruthy();

    const resolved = await agent
      .post("/api/health/duplicates/resolve")
      .set("X-CSRF-Token", csrfToken)
      .send({
        keep_id: first.body.id,
        merge_ids: [second.body.id],
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data.deleted).toBe(1);

    const keeper = await agent.get(`/api/bookmarks/${first.body.id}`);
    expect(keeper.body.tags).toContain("one");
    expect(keeper.body.tags).toContain("two");
  });

  it("runs deadlink analysis (init)", async () => {
    const res = await agent
      .post("/api/health/deadlinks?check=true")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("checked");
  });

  it("rejects state-changing deadlink checks over GET", async () => {
    const res = await agent
      .get("/api/health/deadlinks?check=true")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(405);
  });

  it("fetches deadlink stats", async () => {
    const res = await agent
      .get("/api/health/deadlinks")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("dead_links");
    expect(res.body).toHaveProperty("unchecked");
  });

  it("returns bookmarks by domain", async () => {
    const res = await agent
      .get("/api/bookmarks/by-domain")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should have dup.com entry
    const dupDomain = res.body.find((d) => d.domain === "dup.com");
    expect(dupDomain).toBeTruthy();
  });
});
