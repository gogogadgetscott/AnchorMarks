/**
 * Collections API Integration Tests
 */

const fs = require("fs");
const path = require("path");
const request = require("supertest");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-collections.db");

process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-collections";
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

describe("Collections API", () => {
  beforeAll(async () => {
    agent = request.agent(app);
    const unique = Date.now();
    const res = await agent.post("/api/auth/register").send({
      email: `collections_${unique}@test.com`,
      password: "TestPass123!",
    });
    expect(res.status).toBe(200);
    csrfToken = res.body.csrfToken;
  });

  describe("POST /api/collections", () => {
    it("creates a new collection", async () => {
      const res = await agent
        .post("/api/collections")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Test Collection",
          icon: "folder",
          color: "#ff0000",
          filters: { tags: ["important"] },
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe("Test Collection");
    });

    it("rejects collection without name", async () => {
      const res = await agent
        .post("/api/collections")
        .set("X-CSRF-Token", csrfToken)
        .send({
          icon: "folder",
        });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/collections", () => {
    it("lists user collections", async () => {
      const res = await agent
        .get("/api/collections")
        .set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("PUT /api/collections/:id", () => {
    let collectionId;

    beforeAll(async () => {
      const res = await agent
        .post("/api/collections")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Update Me",
          filters: { tags: ["test"] },
        });
      collectionId = res.body.id;
    });

    it("updates a collection", async () => {
      const res = await agent
        .put(`/api/collections/${collectionId}`)
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Updated Name",
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Name");
    });

    it("returns 404 for non-existent collection", async () => {
      const res = await agent
        .put("/api/collections/non-existent-id")
        .set("X-CSRF-Token", csrfToken)
        .send({ name: "Test" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/collections/:id", () => {
    let collectionId;

    beforeAll(async () => {
      const res = await agent
        .post("/api/collections")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Delete Me",
          filters: { tags: ["test"] },
        });
      collectionId = res.body.id;
    });

    it("deletes a collection", async () => {
      const res = await agent
        .delete(`/api/collections/${collectionId}`)
        .set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);

      // Verify deletion
      const getRes = await agent
        .get(`/api/collections/${collectionId}`)
        .set("X-CSRF-Token", csrfToken);
      expect(getRes.status).toBe(404);
    });
  });

  describe("GET /api/collections/:id/bookmarks", () => {
    let collectionId;

    beforeAll(async () => {
      const res = await agent
        .post("/api/collections")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Bookmarks Collection",
          filters: { tags: ["test"] },
        });
      collectionId = res.body.id;
    });

    it("returns bookmarks for a collection", async () => {
      const res = await agent
        .get(`/api/collections/${collectionId}/bookmarks`)
        .set("X-CSRF-Token", csrfToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("unauthorized access", () => {
    it("rejects requests without auth", async () => {
      const res = await request(app).get("/api/collections");
      expect(res.status).toBe(401);
    });

    it("rejects requests with invalid CSRF", async () => {
      const res = await agent
        .post("/api/collections")
        .set("X-CSRF-Token", "invalid-token")
        .send({ name: "Test" });

      expect(res.status).toBe(403);
    });
  });
});
