/**
 * Rate limiter unit tests.
 *
 * Covers the per-user bucket keying (traffic behind Docker/reverse proxies
 * shares one source IP, so IP-only keys made every client exhaust a single
 * 60 req/min bucket), the 429 response contract (Retry-After + consistent
 * message), and the skip rules.
 */
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const {
  rateLimiterImpl,
  getClientKey,
  _maps,
  _effectiveMax,
  _effectiveApiKeyWriteMax,
  _effectiveAuthMax,
} = require("../middleware/rateLimiter");
const config = require("../config");

const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-rate-limiter-auth.db",
);

function makeRes() {
  const res = {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      res.headers[name] = value;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    method: "GET",
    path: "/api/bookmarks",
    ip: "10.0.0.1",
    headers: {},
    cookies: {},
    ...overrides,
  };
}

function tokenFor(userId) {
  return jwt.sign({ userId }, config.JWT_SECRET);
}

const cookieName = `${config.COOKIE_PREFIX}token`;

function run(db, req) {
  const res = makeRes();
  let nextCount = 0;
  rateLimiterImpl(db, req, res, () => {
    nextCount++;
  });
  return { res, nextCount };
}

beforeEach(() => {
  _maps.requestCounts.clear();
  _maps.apiKeyWriteCounts.clear();
  _maps.maintenanceRequestCounts.clear();
});

describe("General API rate limiting", () => {
  it("allows up to the limit, then answers 429 with Retry-After", () => {
    for (let i = 0; i < _effectiveMax; i++) {
      const { res, nextCount } = run(null, makeReq());
      expect(nextCount).toBe(1);
      expect(res.statusCode).toBeNull();
    }

    const { res, nextCount } = run(null, makeReq());
    expect(nextCount).toBe(0);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "Rate limit exceeded" });
    const retryAfter = Number(res.headers["Retry-After"]);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("keys authenticated traffic per user across IPs (proxy/Docker NAT)", () => {
    const cookies = { [cookieName]: tokenFor("user-a") };
    // Fill the bucket from several different source IPs (shared-NAT case)
    for (let i = 0; i < _effectiveMax; i++) {
      const { nextCount } = run(
        null,
        makeReq({ ip: `10.0.0.${(i % 3) + 1}`, cookies }),
      );
      expect(nextCount).toBe(1);
    }
    // Same session from a brand-new IP is still the same bucket
    const { res } = run(null, makeReq({ ip: "203.0.113.9", cookies }));
    expect(res.statusCode).toBe(429);
  });

  it("gives each user an independent bucket", () => {
    const cookiesA = { [cookieName]: tokenFor("user-a") };
    const cookiesB = { [cookieName]: tokenFor("user-b") };

    for (let i = 0; i < _effectiveMax; i++) {
      run(null, makeReq({ ip: "1.2.3.4", cookies: cookiesA }));
    }
    const exhausted = run(null, makeReq({ ip: "1.2.3.4", cookies: cookiesA }));
    expect(exhausted.res.statusCode).toBe(429);

    // A different user on the same IP gets a fresh bucket
    const other = run(null, makeReq({ ip: "1.2.3.4", cookies: cookiesB }));
    expect(other.nextCount).toBe(1);
  });

  it("falls back to IP keying when there is no session", () => {
    for (let i = 0; i < _effectiveMax; i++) {
      run(null, makeReq({ ip: "9.9.9.9" }));
    }
    const sameIp = run(null, makeReq({ ip: "9.9.9.9" }));
    expect(sameIp.res.statusCode).toBe(429);
    const otherIp = run(null, makeReq({ ip: "9.9.9.10" }));
    expect(otherIp.nextCount).toBe(1);
  });

  it("falls back to IP keying for an invalid session cookie without throwing", () => {
    const key = getClientKey(
      makeReq({ ip: "5.5.5.5", cookies: { [cookieName]: "not-a-jwt" } }),
    );
    expect(key).toBe("5.5.5.5");
  });

  it("skips static assets, health endpoints, and session refresh", () => {
    for (let i = 0; i < _effectiveMax + 5; i++) {
      expect(
        run(null, makeReq({ path: "/favicons/example_com.png" })).nextCount,
      ).toBe(1);
      expect(run(null, makeReq({ path: "/api/health" })).nextCount).toBe(1);
      expect(run(null, makeReq({ path: "/app.js" })).nextCount).toBe(1);
      expect(run(null, makeReq({ path: "/api/auth/refresh" })).nextCount).toBe(
        1,
      );
    }
    // The skipped paths never consumed from the general bucket...
    expect(_maps.requestCounts.size).toBe(0);
  });
});

describe("API key write rate limiting", () => {
  it("hashes API keys so the raw key is never stored in a map", () => {
    const key = getClientKey(
      makeReq({ headers: { "x-api-key": "super-secret-key" } }),
    );
    expect(key.startsWith("k:")).toBe(true);
    expect(key).not.toContain("super-secret-key");
  });

  it("limits API-key writes with their own bucket", () => {
    for (let i = 0; i < _effectiveApiKeyWriteMax; i++) {
      const { nextCount } = run(
        null,
        makeReq({
          method: "POST",
          path: "/api/bookmarks",
          headers: { "x-api-key": "test-key" },
        }),
      );
      expect(nextCount).toBe(1);
    }
    const { res, nextCount } = run(
      null,
      makeReq({
        method: "POST",
        path: "/api/bookmarks",
        headers: { "x-api-key": "test-key" },
      }),
    );
    expect(nextCount).toBe(0);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBeDefined();
  });
});

describe("Auth brute-force limiting (SQLite-persisted)", () => {
  let db;

  beforeAll(() => {
    [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      },
    );
    const { initializeDatabase } = require("../models/database");
    db = initializeDatabase(TEST_DB_PATH);
  });

  afterAll(() => {
    [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
      (file) => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      },
    );
  });

  it("rate limits login attempts with a stricter bucket", () => {
    const key = "ip-198.51.100.7";
    for (let i = 0; i < _effectiveAuthMax; i++) {
      const { nextCount } = run(
        db,
        makeReq({ method: "POST", path: "/api/auth/login", ip: key }),
      );
      expect(nextCount).toBe(1);
    }
    const { res, nextCount } = run(
      db,
      makeReq({ method: "POST", path: "/api/auth/login", ip: key }),
    );
    expect(nextCount).toBe(0);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "Rate limit exceeded" });

    // A different source IP still has its own auth bucket
    const other = run(
      db,
      makeReq({
        method: "POST",
        path: "/api/auth/login",
        ip: "ip-198.51.100.8",
      }),
    );
    expect(other.nextCount).toBe(1);
  });

  it("never throws when the database is unavailable (fails open)", () => {
    const { res, nextCount } = run(
      null,
      makeReq({
        method: "POST",
        path: "/api/auth/login",
        ip: "ip-203.0.113.1",
      }),
    );
    expect(nextCount).toBe(1);
    expect(res.statusCode).toBeNull();
  });
});
