/**
 * Unit tests for routes/static.js (catch-all SPA fallback).
 * Mocks fs.existsSync so no real client files are required.
 */
const mockExistsSync = vi.fn();
vi.mock("fs", () => ({
  existsSync: (...args) => mockExistsSync(...args),
}));

describe("routes/static", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it("registers a catch-all route", () => {
    const app = { all: vi.fn() };
    const setupStaticRoutes = require("../routes/static");
    setupStaticRoutes(app);
    expect(app.all).toHaveBeenCalledWith(/(.*)/, expect.any(Function));
  });

  it("calls res.sendFile with client index path when not production", () => {
    process.env.NODE_ENV = "test";
    const app = { all: vi.fn() };
    const setupStaticRoutes = require("../routes/static");
    setupStaticRoutes(app);
    const handler = app.all.mock.calls[0][1];
    const res = { sendFile: vi.fn() };
    const req = { path: "/any" };

    handler(req, res);

    expect(res.sendFile).toHaveBeenCalledTimes(1);
    const sentPath = res.sendFile.mock.calls[0][0];
    expect(sentPath).toContain("client");
    expect(sentPath).toMatch(/index\.html$/);
  });

  it("in production, sendFile is called with a path ending in index.html", () => {
    process.env.NODE_ENV = "production";
    mockExistsSync.mockReturnValue(false);
    vi.resetModules();
    const app = { all: vi.fn() };
    const setupStaticRoutes = require("../routes/static");
    setupStaticRoutes(app);
    const handler = app.all.mock.calls[0][1];
    const res = { sendFile: vi.fn() };

    handler({}, res);

    expect(res.sendFile).toHaveBeenCalledTimes(1);
    expect(res.sendFile.mock.calls[0][0]).toMatch(/index\.html$/);
    expect(res.sendFile.mock.calls[0][0]).toContain("client");
  });
});
