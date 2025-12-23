// tests for health route errors
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-key-health-errors";
process.env.CORS_ORIGIN = "http://localhost";

// Mock models to throw errors
jest.mock("../models/stats", () => ({
  findDuplicates: jest.fn(() => {
    throw new Error("DB Error");
  }),
  cleanupDuplicates: jest.fn(() => {
    throw new Error("DB Error");
  }),
  getDeadlinksInfo: jest.fn(() => {
    throw new Error("DB Error");
  }),
  runDeadlinkChecks: jest.fn(() => {
    throw new Error("DB Error");
  }),
}));

jest.mock("../models/bookmark", () => ({
  listUrls: jest.fn(() => {
    throw new Error("DB Error");
  }),
}));

// Mock metadata to avoid unrelated errors
jest.mock("../helpers/metadata", () => ({
  fetchUrlMetadata: jest.fn(),
  detectContentType: jest.fn(),
}));

const app = require("../app");

let agent;
let csrfToken;

beforeAll(async () => {
  // We need a separate agent/setup because app is already loaded with mocks
  agent = request.agent(app);
  // We still need valid auth to hit the endpoints
  // But since we mocked models, we need to ensure auth still works.
  // Auth uses userSettings / db directly via app.db usually?
  // No, auth uses `models/database` and raw SQL queries in controller?
  // Let's check auth controller. It uses app.db.prepare...
});

describe("Health API Errors", () => {
  // We can't easily login if we mocked too much?
  // Actually, we mocked `models/stats` and `models/bookmark`, but not `app.db` directly
  // so Auth should still work if it uses `app.db`.
  // BUT `app.js` requires `models/database` which we didn't mock.

  beforeAll(async () => {
    // Register a user to get token
    // We use a unique email
    const unique = Date.now();
    const user = {
      email: `healtherr${unique}@example.com`,
      password: "password123",
    };
    const register = await agent.post("/api/auth/register").send(user);
    // If registration fails, our tests will fail. Registration uses `db.prepare`.
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
