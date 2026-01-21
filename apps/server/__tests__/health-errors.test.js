// tests for health route errors
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-health-errors";
process.env.CORS_ORIGIN = "http://localhost";

const statsModel = require("../models/stats");
const bookmarkModel = require("../models/bookmark");

// Spies
const findDuplicatesSpy = vi.spyOn(statsModel, "findDuplicates");
const cleanupDuplicatesSpy = vi.spyOn(statsModel, "cleanupDuplicates");
const getDeadlinksInfoSpy = vi.spyOn(statsModel, "getDeadlinksInfo");
const runDeadlinkChecksSpy = vi.spyOn(statsModel, "runDeadlinkChecks");
const listUrlsSpy = vi.spyOn(bookmarkModel, "listUrls");

// Mock metadata to avoid unrelated errors (keep using vi.mock for this if it's less critical or spy if easy)
// Since helper mocks are simple, we can keep them or spy. Let's use mock for metadata as it is a helper.
vi.mock("../helpers/metadata", () => ({
  fetchUrlMetadata: vi.fn(),
  detectContentType: vi.fn(),
}));

const app = require("../app");

let agent;
let csrfToken;

beforeAll(async () => {
  // Be defensive: ensure the object methods are actually spies
  findDuplicatesSpy.mockImplementation(() => {
    throw new Error("DB Error");
  });
  cleanupDuplicatesSpy.mockImplementation(() => {
    throw new Error("DB Error");
  });
  getDeadlinksInfoSpy.mockImplementation(() => {
    throw new Error("DB Error");
  });
  runDeadlinkChecksSpy.mockImplementation(() => {
    throw new Error("DB Error");
  });
  listUrlsSpy.mockImplementation(() => {
    throw new Error("DB Error");
  });

  agent = request.agent(app);
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("Health API Errors", () => {
  beforeAll(async () => {
    // For authentication, we might need successful DB calls.
    // But we mocked ALL methods above to throw error!
    // This is a problem. The authentication/registration calls MIGHT use `statsModel` or `bookmarkModel`?
    // Auth uses `auth` controller and `database` model usually, or directly `db`.
    // Step 166 shows registration logic.
    // If registration uses `bookmarkModel.something`, it will fail.
    // But typically auth is separate.

    // Let's proceed assuming registration doesn't use stats/bookmark listUrls.

    const unique = Date.now();
    const user = {
      email: `healtherr${unique}@example.com`,
      password: "password123",
    };
    const register = await agent.post("/api/auth/register").send(user);
    if (register.status !== 200) {
      console.error("Registration failed:", register.body);
    }
    csrfToken = register.body.csrfToken;
  });

  it("handles errors in duplicate detection", async () => {
    const res = await agent
      .get("/api/health/duplicates")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });

  it("handles errors in duplicate cleanup", async () => {
    const res = await agent
      .post("/api/health/duplicates/cleanup")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });

  it("handles errors in deadlink checks", async () => {
    const res = await agent
      .get("/api/health/deadlinks?check=true")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });

  it("handles errors in domain stats", async () => {
    const res = await agent
      .get("/api/bookmarks/by-domain")
      .set("X-CSRF-Token", csrfToken);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed/i);
  });
});
