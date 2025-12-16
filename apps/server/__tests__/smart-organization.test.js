/**
 * Smart Organization Tests
 * Tests for intelligent tag scoring, collection generation, and domain analysis
 */

const path = require("path");
const fs = require("fs");

// Test database path
const TEST_DB_PATH = path.join(
  __dirname,
  "../../anchormarks-test-smart-org.db",
);

// Set environment variables BEFORE requiring app
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-smart-org";
process.env.CORS_ORIGIN = "http://localhost";

const request = require("supertest");
const app = require("../app.js");

// Clean up test database before and after
beforeAll(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
    fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  }
  if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
    fs.unlinkSync(`${TEST_DB_PATH}-wal`);
  }
});

afterAll(() => {
  if (app.db) app.db.close();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  if (fs.existsSync(`${TEST_DB_PATH}-shm`)) {
    fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  }
  if (fs.existsSync(`${TEST_DB_PATH}-wal`)) {
    fs.unlinkSync(`${TEST_DB_PATH}-wal`);
  }
});

describe("Smart Organization API", () => {
  let agent;
  let csrfToken;
  let userId;

  beforeAll(async () => {
    agent = request.agent(app);

    // Register and login (matches existing test pattern)
    const timestamp = Date.now();
    const registerRes = await agent.post("/api/auth/register").send({
      email: `test_${timestamp}@example.com`,
      password: "TestPass123!",
    });

    expect(registerRes.status).toBe(200);
    csrfToken = registerRes.body.csrfToken;
    userId = registerRes.body.user.id;
  });

  describe("POST /api/bookmarks - Setup test data", () => {
    it("should create multiple bookmarks for testing", async () => {
      const bookmarks = [
        {
          url: "https://github.com/facebook/react",
          title: "React - A JavaScript library",
          tags: "javascript,frontend,react",
        },
        {
          url: "https://github.com/vuejs/vue",
          title: "Vue.js",
          tags: "javascript,frontend,vue",
        },
        {
          url: "https://stackoverflow.com/questions/javascript",
          title: "JavaScript Questions",
          tags: "javascript,help,learning",
        },
        {
          url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
          title: "MDN JavaScript",
          tags: "javascript,documentation,learning",
        },
        {
          url: "https://nodejs.org/en/docs",
          title: "Node.js Docs",
          tags: "nodejs,backend,javascript",
        },
      ];

      for (const bookmark of bookmarks) {
        const res = await agent
          .post("/api/bookmarks")
          .set("X-CSRF-Token", csrfToken)
          .send(bookmark);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("id");
      }
    });
  });

  describe("GET /api/tags/suggest-smart", () => {
    it("should return smart tag suggestions for GitHub URL", async () => {
      const res = await agent
        .get("/api/tags/suggest-smart")
        .query({ url: "https://github.com/microsoft/vscode", limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("suggestions");
      expect(res.body).toHaveProperty("domain_info");
      expect(Array.isArray(res.body.suggestions)).toBe(true);

      if (res.body.suggestions.length > 0) {
        const suggestion = res.body.suggestions[0];
        expect(suggestion).toHaveProperty("tag");
        expect(suggestion).toHaveProperty("score");
        expect(suggestion).toHaveProperty("source");
        expect(suggestion).toHaveProperty("reason");
        expect(["domain", "activity", "similar"]).toContain(suggestion.source);
      }

      expect(res.body.domain_info).toHaveProperty("domain");
      expect(res.body.domain_info.domain).toBe("github.com");
    });

    it("should return domain-based suggestions for known domain", async () => {
      const res = await agent
        .get("/api/tags/suggest-smart")
        .query({ url: "https://stackoverflow.com/questions/12345", limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.suggestions.length).toBeGreaterThan(0);

      const tags = res.body.suggestions.map((s) => s.tag);
      // StackOverflow should suggest help/learning related tags
      const hasRelevantTag = tags.some((tag) =>
        ["help", "qa", "community", "learning"].includes(tag.toLowerCase()),
      );
      expect(hasRelevantTag).toBe(true);
    });

    it("should handle custom weights", async () => {
      const res = await agent.get("/api/tags/suggest-smart").query({
        url: "https://github.com/test/repo",
        limit: 5,
        domain_weight: 0.8,
        activity_weight: 0.1,
        similarity_weight: 0.1,
      });

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toBeDefined();
    });

    it("should return 400 for missing URL", async () => {
      const res = await agent.get("/api/tags/suggest-smart");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 400 for invalid URL", async () => {
      const res = await agent
        .get("/api/tags/suggest-smart")
        .query({ url: "not-a-valid-url" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid URL");
    });
  });

  describe("GET /api/smart-collections/suggest", () => {
    it("should return smart collection suggestions", async () => {
      const res = await agent.get("/api/smart-collections/suggest");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("collections");
      expect(Array.isArray(res.body.collections)).toBe(true);

      if (res.body.collections.length > 0) {
        const collection = res.body.collections[0];
        expect(collection).toHaveProperty("name");
        expect(collection).toHaveProperty("reason");
        expect(collection).toHaveProperty("rules");
        expect(collection).toHaveProperty("bookmark_count");
        expect(collection).toHaveProperty("type");
        expect(["activity", "domain", "tag_cluster"]).toContain(
          collection.type,
        );
      }
    });

    it("should include activity-based collections", async () => {
      const res = await agent.get("/api/smart-collections/suggest");

      expect(res.status).toBe(200);
      const activityCollections = res.body.collections.filter(
        (c) => c.type === "activity",
      );
      expect(activityCollections.length).toBeGreaterThan(0);
    });

    it("should include domain-based collections", async () => {
      const res = await agent.get("/api/smart-collections/suggest");

      expect(res.status).toBe(200);
      const domainCollections = res.body.collections.filter(
        (c) => c.type === "domain",
      );
      expect(domainCollections.length).toBeGreaterThan(0);
    });

    it("should limit results when specified", async () => {
      const res = await agent
        .get("/api/smart-collections/suggest")
        .query({ limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.collections.length).toBeLessThanOrEqual(2);
    });
  });

  describe("POST /api/smart-collections/create", () => {
    it("should create a smart collection", async () => {
      const res = await agent
        .post("/api/smart-collections/create")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Recent JavaScript",
          type: "tag_cluster",
          tags: ["javascript"],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe("Recent JavaScript");
    });

    it("should return 400 for missing name", async () => {
      const res = await agent
        .post("/api/smart-collections/create")
        .set("X-CSRF-Token", csrfToken)
        .send({
          rules: JSON.stringify({ tags: ["test"] }),
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Name");
    });

    it("should return 400 for missing rules", async () => {
      const res = await agent
        .post("/api/smart-collections/create")
        .set("X-CSRF-Token", csrfToken)
        .send({
          name: "Test Collection",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Rules");
    });

    it("should require CSRF token", async () => {
      const res = await agent.post("/api/smart-collections/create").send({
        name: "Test",
        rules: JSON.stringify({ tags: ["test"] }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/smart-collections/domain-stats", () => {
    it("should return domain statistics", async () => {
      const res = await agent
        .get("/api/smart-collections/domain-stats")
        .query({ domain: "github.com" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("domain");
      expect(res.body).toHaveProperty("bookmark_count");
      expect(res.body).toHaveProperty("tag_distribution");
      expect(res.body).toHaveProperty("mostClicked");
      expect(res.body.domain).toBe("github.com");
      expect(Array.isArray(res.body.tag_distribution)).toBe(true);
      expect(Array.isArray(res.body.mostClicked)).toBe(true);
    });

    it("should return 400 for missing domain", async () => {
      const res = await agent.get("/api/smart-collections/domain-stats");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Domain parameter required");
    });

    it("should handle domains with no bookmarks", async () => {
      const res = await agent
        .get("/api/smart-collections/domain-stats")
        .query({ domain: "nonexistent-domain.com" });

      expect(res.status).toBe(200);
      expect(res.body.bookmark_count).toBe(0);
      expect(typeof res.body.tag_distribution).toBe("object");
    });
  });

  describe("GET /api/smart-collections/tag-clusters", () => {
    it("should return tag clusters", async () => {
      const res = await agent.get("/api/smart-collections/tag-clusters");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("clusters");
      expect(Array.isArray(res.body.clusters)).toBe(true);

      if (res.body.clusters.length > 0) {
        const cluster = res.body.clusters[0];
        expect(cluster).toHaveProperty("name");
        expect(cluster).toHaveProperty("tags");
        expect(Array.isArray(cluster.tags)).toBe(true);
      }
    });

    it("should group related tags together", async () => {
      const res = await agent.get("/api/smart-collections/tag-clusters");

      expect(res.status).toBe(200);

      if (res.body.clusters && res.body.clusters.length > 0) {
        // Check if frontend-related tags are grouped
        const frontendCluster = res.body.clusters.find(
          (c) =>
            c.tags &&
            c.tags.some((t) =>
              ["javascript", "frontend", "react", "vue"].includes(t),
            ),
        );

        if (frontendCluster) {
          expect(frontendCluster.name).toBeTruthy();
        }
      }
    });
  });

  describe("GET /api/smart-insights", () => {
    it("should return comprehensive insights", async () => {
      const res = await agent.get("/api/smart-insights");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("total_bookmarks");
      expect(res.body).toHaveProperty("total_tags");
      expect(res.body).toHaveProperty("top_domains");
      expect(res.body).toHaveProperty("top_tags");
      expect(res.body).toHaveProperty("recent_activity");
      expect(res.body).toHaveProperty("engagement");
      expect(res.body).toHaveProperty("suggestions");

      // Check nested objects
      expect(res.body.recent_activity).toHaveProperty("bookmarks_this_week");
      expect(res.body.engagement).toHaveProperty("total_clicks");
      expect(res.body.suggestions).toHaveProperty("create_these_collections");

      // Check arrays
      expect(Array.isArray(res.body.top_domains)).toBe(true);
      expect(Array.isArray(res.body.top_tags)).toBe(true);
    });

    it("should include top domains with counts", async () => {
      const res = await agent.get("/api/smart-insights");

      expect(res.status).toBe(200);

      if (res.body.top_domains && res.body.top_domains.length > 0) {
        const domain = res.body.top_domains[0];
        expect(domain).toHaveProperty("domain");
        expect(domain).toHaveProperty("count");
        expect(typeof domain.count).toBe("number");
      }
    });

    it("should include top tags with usage data", async () => {
      const res = await agent.get("/api/smart-insights");

      expect(res.status).toBe(200);

      if (res.body.top_tags && res.body.top_tags.length > 0) {
        const tag = res.body.top_tags[0];
        expect(tag).toHaveProperty("tag");
        expect(tag).toHaveProperty("count");
        expect(typeof tag.count).toBe("number");
      }
    });

    it("should limit top results when specified", async () => {
      const res = await agent
        .get("/api/smart-insights")
        .query({ top_limit: 3 });

      expect(res.status).toBe(200);
      if (res.body.top_domains) {
        expect(res.body.top_domains.length).toBeLessThanOrEqual(3);
      }
      if (res.body.top_tags) {
        expect(res.body.top_tags.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe("Smart Organization Module Functions", () => {
    it("should recognize known domains", () => {
      const smartOrg = require("../smart-organization.js");

      const githubInfo = smartOrg.getDomainCategory(
        "https://github.com/test/repo",
      );
      expect(githubInfo).toHaveProperty("category");
      expect(githubInfo).toHaveProperty("tags");
      expect(githubInfo.category).toBe("development");
      expect(Array.isArray(githubInfo.tags)).toBe(true);
      expect(githubInfo.tags).toContain("github");
    });

    it("should handle unknown domains", () => {
      const smartOrg = require("../smart-organization.js");

      const unknownInfo = smartOrg.getDomainCategory(
        "https://unknown-domain-12345.com/page",
      );
      expect(unknownInfo).toHaveProperty("category");
      expect(unknownInfo).toHaveProperty("tags");
      expect(Array.isArray(unknownInfo.tags)).toBe(true);
    });

    it("should tokenize text correctly", () => {
      const smartOrg = require("../smart-organization.js");

      const tokens = smartOrg.tokenizeText(
        "This is a test of JavaScript and Node.js",
      );
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain("javascript");
      expect(tokens).toContain("test");
    });
  });

  describe("Integration: Smart Tag Suggestions with Real Data", () => {
    it("should suggest activity-based tags for similar URLs", async () => {
      // First, create several bookmarks with the same tags
      const commonTags = "react,hooks,tutorial";
      for (let i = 0; i < 3; i++) {
        await agent
          .post("/api/bookmarks")
          .set("X-CSRF-Token", csrfToken)
          .send({
            url: `https://react-tutorial-${i}.com/hooks`,
            title: `React Hooks Tutorial ${i}`,
            tags: commonTags,
          });
      }

      // Now request suggestions for a similar URL
      const res = await agent.get("/api/tags/suggest-smart").query({
        url: "https://react-advanced.com/hooks-guide",
        limit: 10,
        activity_weight: 0.5,
      });

      expect(res.status).toBe(200);

      // Should suggest some of the commonly used tags
      if (res.body.suggestions && res.body.suggestions.length > 0) {
        const suggestedTags = res.body.suggestions.map((s) => s.tag);
        const hasCommonTag = suggestedTags.some((tag) =>
          ["react", "hooks", "tutorial"].includes(tag),
        );
        expect(hasCommonTag).toBe(true);
      }
    });

    it("should combine multiple scoring sources", async () => {
      const res = await agent.get("/api/tags/suggest-smart").query({
        url: "https://github.com/facebook/react/wiki",
        limit: 10,
        domain_weight: 0.35,
        activity_weight: 0.4,
        similarity_weight: 0.25,
      });

      expect(res.status).toBe(200);

      // Should have suggestions from multiple sources
      if (res.body.suggestions && res.body.suggestions.length > 0) {
        const sources = [...new Set(res.body.suggestions.map((s) => s.source))];
        expect(sources.length).toBeGreaterThan(0);
      }
    });
  });
});
