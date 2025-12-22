// tests for auth controller
const request = require("supertest");
const path = require("path");
const fs = require("fs");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-auth.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-auth";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let email;
let password;

beforeAll(async () => {
  agent = request.agent(app);
  const unique = Date.now();
  email = `auth${unique}@example.com`;
  password = "password123";
  const register = await agent
    .post("/api/auth/register")
    .send({ email, password });
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

describe("Auth Controller", () => {
  it("logs in with correct credentials", async () => {
    const login = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user.api_key).toBeTruthy();
  });

  it("retrieves current user profile", async () => {
    const me = await agent.get("/api/auth/me").set("X-CSRF-Token", csrfToken);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.user.username).toBe(email); // username should equal email
    expect(me.body.user.role).toBe("user"); // default role
  });

  it("logs out and invalidates session", async () => {
    const logout = await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", csrfToken);
    expect(logout.status).toBe(200);
    const me = await agent.get("/api/auth/me").set("X-CSRF-Token", csrfToken);
    expect(me.status).toBe(401);
  });
});
