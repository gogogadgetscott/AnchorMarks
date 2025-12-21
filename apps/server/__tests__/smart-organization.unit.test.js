const so = require("../helpers/smart-organization");

describe("helpers/smart-organization (unit)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getDomainCategory", () => {
    it("returns known domain category for github.com", () => {
      const meta = so.getDomainCategory("https://github.com/owner/repo");
      expect(meta).toHaveProperty("category", "development");
      expect(Array.isArray(meta.tags)).toBe(true);
      expect(meta.tags).toContain("github");
      expect(typeof meta.priority).toBe("number");
    });

    it("returns fallback category for unknown hosts", () => {
      const meta = so.getDomainCategory("https://sub.example.co.uk/path");
      expect(meta.category).toBe("web");
      // fallback tag should be the first subdomain part
      expect(meta.tags[0]).toBe("sub");
      expect(meta.priority).toBeCloseTo(0.6);
    });

    it("returns unknown category for invalid URLs", () => {
      const meta = so.getDomainCategory("not-a-url");
      expect(meta.category).toBe("unknown");
      expect(Array.isArray(meta.tags)).toBe(true);
    });
  });

  describe("tokenizeText", () => {
    it("tokenizes and filters short tokens and punctuation", () => {
      const tokens = so.tokenizeText("Hello, World! -- 123 / dev-tools");
      // "hello" and "world" should appear; numbers and tiny tokens are filtered
      expect(tokens).toContain("hello");
      expect(tokens).toContain("world");
      // tokens shorter than 3 chars are filtered out
      expect(tokens.some((t) => t.length < 3)).toBe(false);
    });

    it("returns empty array for falsy input", () => {
      expect(so.tokenizeText(null)).toEqual([]);
      expect(so.tokenizeText("")).toEqual([]);
    });
  });

  describe("getTopSource", () => {
    it("chooses domain when domainScore is highest", () => {
      expect(so.getTopSource({ domainScore: 0.6, activityScore: 0.2, similarityScore: 0.1 })).toBe("domain");
    });

    it("chooses activity when activityScore is highest", () => {
      expect(so.getTopSource({ domainScore: 0.2, activityScore: 0.7, similarityScore: 0.1 })).toBe("activity");
    });

    it("chooses similar when similarityScore is highest", () => {
      expect(so.getTopSource({ domainScore: 0.1, activityScore: 0.1, similarityScore: 0.5 })).toBe("similar");
    });
  });

  describe("calculateTagScore", () => {
    it("returns zeroed scores for invalid URL", () => {
      const res = so.calculateTagScore({}, 1, "not-a-url", "anytag");
      expect(res.score).toBe(0);
      expect(res.domainScore).toBe(0);
      expect(res.activityScore).toBe(0);
      expect(res.similarityScore).toBe(0);
      expect(res.sources).toEqual({});
    });

    it("combines sub-scores using weights with minimal fake db", () => {
      // Create a minimal fake DB that returns predictable values for the scoring functions
      const fakeDb = {
        prepare: (query) => ({
          get: () => {
            // Return counts that produce known scores
            if (query.includes("COUNT(*) as count FROM bookmarks WHERE user_id")) {
              // For domain score: return 10 total bookmarks and 5 tagged
              return { count: 10 };
            }
            return { count: 5 };
          },
          all: () => {
            // For similarity score: return empty array (no similar bookmarks)
            return [];
          },
        }),
      };

      const result = so.calculateTagScore(fakeDb, 42, "https://example.com/page", "testing", {
        domain: 0.35,
        activity: 0.4,
        similarity: 0.25,
      });

      // Verify the result has the expected structure
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("domainScore");
      expect(result).toHaveProperty("activityScore");
      expect(result).toHaveProperty("similarityScore");
      expect(result).toHaveProperty("sources");

      // All scores should be between 0 and 1
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.domainScore).toBeGreaterThanOrEqual(0);
      expect(result.domainScore).toBeLessThanOrEqual(1);
      expect(result.activityScore).toBeGreaterThanOrEqual(0);
      expect(result.activityScore).toBeLessThanOrEqual(1);
      expect(result.similarityScore).toBeGreaterThanOrEqual(0);
      expect(result.similarityScore).toBeLessThanOrEqual(1);

      // sources should be an object with boolean values
      expect(typeof result.sources.domain).toBe("boolean");
      expect(typeof result.sources.activity).toBe("boolean");
      expect(typeof result.sources.similarity).toBe("boolean");
    });
  });
});
