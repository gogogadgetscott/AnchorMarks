/**
 * Test utilities for AnchorMarks API tests
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_TEST_DB_PATH = (name) =>
  path.join(__dirname, `anchormarks-test-${name}.db`);

function cleanupDbFiles(dbPath) {
  [dbPath, `${dbPath}-shm`, `${dbPath}-wal`].forEach((file) => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
}

function setupTestEnv(dbPath) {
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = dbPath;
  process.env.JWT_SECRET = "test-secret-key-for-tests";
  process.env.CORS_ORIGIN = "http://localhost";
}

async function registerUser(agent, email = null, password = "password123") {
  const unique = email || `${Date.now()}@example.com`;
  const res = await agent.post("/api/auth/register").send({
    email: unique,
    password,
  });
  return {
    user: res.body.user,
    csrfToken: res.body.csrfToken,
    apiKey: res.body.user?.api_key,
    status: res.status,
    body: res.body,
  };
}

async function loginUser(agent, email, password = "password123") {
  const res = await agent.post("/api/auth/login").send({ email, password });
  return {
    csrfToken: res.body.csrfToken,
    status: res.status,
    body: res.body,
  };
}

function createAuthenticatedAgent(app) {
  const request = require("supertest");
  return request.agent(app);
}

module.exports = {
  DEFAULT_TEST_DB_PATH,
  cleanupDbFiles,
  setupTestEnv,
  registerUser,
  loginUser,
  createAuthenticatedAgent,
};
