/**
 * Unit tests for middleware/index.js (authenticateToken, validateCsrfToken).
 * Uses mocks for db and config so no real DB is required. JWT tests use real tokens.
 */
process.env.JWT_SECRET = "test-jwt-secret-middleware";
const jwt = require("jsonwebtoken");
const mockIsApiKeyAllowed = vi.fn();

vi.mock("../config", () => ({
  get JWT_SECRET() {
    return process.env.JWT_SECRET || "test-jwt-secret-middleware";
  },
  isApiKeyAllowed: (req) => mockIsApiKeyAllowed(req),
}));

function createMockDb(userByApiKey = null, userById = null) {
  const get = vi.fn().mockImplementation((arg) => {
    if (userByApiKey != null && (arg === "valid-key" || userByApiKey.id === arg))
      return userByApiKey;
    if (userById != null && arg === (userById.id || "user-1")) return userById;
    return userByApiKey != null && arg === "valid-key"
      ? userByApiKey
      : userById != null && arg === "user-1"
        ? userById
        : null;
  });
  return {
    prepare: vi.fn().mockReturnValue({ get }),
  };
}

describe("middleware/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockIsApiKeyAllowed.mockReturnValue(true);
  });

  describe("authenticateToken", () => {
    it("returns 401 when no cookie and no API key", () => {
      vi.resetModules();
      const { authenticateToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = authenticateToken(db);
      const req = { headers: {}, cookies: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Access token required" });
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next with user when valid API key and isApiKeyAllowed", () => {
      const { authenticateToken } = require("../middleware/index");
      const user = { id: "user-1", email: "u@x.com", api_key: "valid-key" };
      const db = createMockDb(user, user);
      db.prepare().get.mockImplementation((key) =>
        key === "valid-key" ? user : null,
      );
      const middleware = authenticateToken(db);
      const req = {
        headers: { "x-api-key": "valid-key" },
        method: "GET",
        path: "/api/bookmarks",
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(user);
      expect(req.authType).toBe("api-key");
    });

    it("returns 403 when API key is invalid (user not found)", () => {
      const { authenticateToken } = require("../middleware/index");
      const db = createMockDb(null, null);
      db.prepare().get.mockReturnValue(null);
      const middleware = authenticateToken(db);
      const req = { headers: { "x-api-key": "bad-key" }, method: "GET", path: "/api/bookmarks" };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Invalid API key." }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when API key valid but isApiKeyAllowed returns false", () => {
      const { authenticateToken } = require("../middleware/index");
      const user = { id: "user-1", api_key: "valid-key" };
      const db = createMockDb(user, user);
      db.prepare().get.mockImplementation((key) =>
        key === "valid-key" ? user : null,
      );
      mockIsApiKeyAllowed.mockReturnValue(false);
      const middleware = authenticateToken(db);
      const req = {
        headers: { "x-api-key": "valid-key" },
        method: "POST",
        path: "/api/other",
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "API key not permitted for this endpoint.",
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when cookie has no token", () => {
      const { authenticateToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = authenticateToken(db);
      const req = { headers: {}, cookies: {} };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next with user when valid JWT cookie", () => {
      vi.resetModules();
      const { authenticateToken } = require("../middleware/index");
      const user = { id: "user-1", email: "u@x.com" };
      const db = createMockDb(null, user);
      db.prepare().get.mockImplementation((id) =>
        id === "user-1" ? user : null,
      );
      const secret = process.env.JWT_SECRET || "test-jwt-secret-middleware";
      const token = jwt.sign(
        { userId: "user-1" },
        secret,
        { expiresIn: "1h" },
      );
      const middleware = authenticateToken(db);
      const req = { headers: {}, cookies: { token } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), clearCookie: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual(user);
      expect(req.authType).toBe("jwt");
      expect(res.clearCookie).not.toHaveBeenCalled();
    });

    it("returns 403 and clears cookie when JWT is invalid", () => {
      vi.resetModules();
      const { authenticateToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = authenticateToken(db);
      const req = { headers: {}, cookies: { token: "bad-jwt" } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        clearCookie: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith("token");
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when JWT valid but user not found in db", () => {
      vi.resetModules();
      const { authenticateToken } = require("../middleware/index");
      const db = createMockDb(null, null);
      db.prepare().get.mockImplementation(() => null);
      const secret = process.env.JWT_SECRET || "test-jwt-secret-middleware";
      const token = jwt.sign(
        { userId: "user-1" },
        secret,
        { expiresIn: "1h" },
      );
      const middleware = authenticateToken(db);
      const req = { headers: {}, cookies: { token } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        clearCookie: vi.fn(),
      };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("validateCsrfToken", () => {
    it("calls next for GET requests without checking CSRF", () => {
      const { validateCsrfToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = validateCsrfToken(db);
      const req = {
        method: "GET",
        headers: {},
        cookies: {},
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("calls next when API key is present and user exists", () => {
      const { validateCsrfToken } = require("../middleware/index");
      const user = { id: "user-1" };
      const db = createMockDb(user, user);
      db.prepare().get.mockReturnValue(user);
      const middleware = validateCsrfToken(db);
      const req = {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
        cookies: {},
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("returns 403 when X-CSRF-Token header is missing for POST", () => {
      const { validateCsrfToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = validateCsrfToken(db);
      const req = {
        method: "POST",
        headers: {},
        cookies: { csrfToken: "session-csrf" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("X-CSRF-Token"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when CSRF cookie is missing for POST", () => {
      const { validateCsrfToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = validateCsrfToken(db);
      const req = {
        method: "POST",
        headers: { "x-csrf-token": "header-csrf" },
        cookies: {},
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("CSRF cookie"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when CSRF header and cookie do not match", () => {
      const { validateCsrfToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = validateCsrfToken(db);
      const req = {
        method: "POST",
        headers: { "x-csrf-token": "header-csrf" },
        cookies: { csrfToken: "different-cookie-csrf" },
      };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("mismatch"),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next when CSRF header matches cookie", () => {
      const { validateCsrfToken } = require("../middleware/index");
      const db = createMockDb();
      const middleware = validateCsrfToken(db);
      const token = "same-csrf-token";
      const req = {
        method: "POST",
        headers: { "x-csrf-token": token },
        cookies: { csrfToken: token },
      };
      const res = {};
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
