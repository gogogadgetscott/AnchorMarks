const fs = require("fs");
const path = require("path");
const request = require("supertest");

// Use an isolated database for integration tests
const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-auth-coverage.db");

process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-auth-coverage";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../index");

let agent;
let csrfToken;
let email;
let password;

beforeAll(async () => {
  agent = request.agent(app);

  const unique = Date.now();
  email = `authcov_${unique}@example.com`;
  password = "password123";

  const registerRes = await agent
    .post("/api/auth/register")
    .send({ email, password });

  expect(registerRes.status).toBe(200);
  csrfToken = registerRes.body.csrfToken;
  expect(csrfToken).toBeTruthy();
});

afterAll(() => {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("Auth negative paths and extras", () => {
  it("rejects register with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it("rejects register with short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: `short_${Date.now()}@example.com`, password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 6/i);
  });

  it("rejects register for existing user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email, password });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("rejects login for unknown user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: `nope_${Date.now()}@example.com`,
        password: "does-not-matter",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("rejects login for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "wrong-password" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it("regenerates API key for authenticated user", async () => {
    const meBefore = await agent
      .get("/api/auth/me")
      .set("X-CSRF-Token", csrfToken);

    expect(meBefore.status).toBe(200);
    const oldKey = meBefore.body.user.api_key;
    expect(oldKey).toMatch(/^lv_/);

    const regen = await agent
      .post("/api/auth/regenerate-key")
      .set("X-CSRF-Token", csrfToken);

    expect(regen.status).toBe(200);
    expect(regen.body.api_key).toMatch(/^lv_/);
    expect(regen.body.api_key).not.toBe(oldKey);

    const meAfter = await agent
      .get("/api/auth/me")
      .set("X-CSRF-Token", csrfToken);

    expect(meAfter.status).toBe(200);
    expect(meAfter.body.user.api_key).toBe(regen.body.api_key);
  });

  it("updates profile email", async () => {
    const newEmail = `updated_${Date.now()}@example.com`;
    // We must update the global email variable so the login test (if any) or subsequent checks know it changed
    // But since subsequent tests use 'agent', the session is preserved.

    const res = await agent
      .put("/api/auth/profile")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: newEmail });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(newEmail);
    email = newEmail; // Update local tracker
  });

  it("updates password", async () => {
    const newPassword = "newPassword123!";
    const res = await agent
      .put("/api/auth/password")
      .set("X-CSRF-Token", csrfToken)
      .send({ currentPassword: password, newPassword });

    expect(res.status).toBe(200);
    password = newPassword; // Update local tracker
  });

  it("logs out and clears cookies", async () => {
    const res = await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const setCookie = res.headers["set-cookie"] || [];
    const cookieHeader = Array.isArray(setCookie)
      ? setCookie.join(";")
      : String(setCookie);
    expect(cookieHeader).toMatch(/token=;/i);
    expect(cookieHeader).toMatch(/csrfToken=;/i);

    const me = await agent.get("/api/auth/me").set("X-CSRF-Token", csrfToken);

    expect(me.status).toBe(401);
  });
});
