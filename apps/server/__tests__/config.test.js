function loadConfigWithEnv(env) {
  jest.resetModules();

  // Restore process.env to a clean baseline for each load
  process.env = { ...process.env, ...env };

  return require("../config");
}

describe("server/config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("validateSecurityConfig does nothing outside production", () => {
    const config = loadConfigWithEnv({ NODE_ENV: "development" });
    expect(() => config.validateSecurityConfig()).not.toThrow();
  });

  it("validateSecurityConfig throws if JWT_SECRET missing in production", () => {
    const config = loadConfigWithEnv({
      NODE_ENV: "production",
      JWT_SECRET: "",
      CORS_ORIGIN: "https://example.com",
    });
    expect(() => config.validateSecurityConfig()).toThrow(/JWT_SECRET/i);
  });

  it("validateSecurityConfig throws if JWT_SECRET is insecure default in production", () => {
    const config = loadConfigWithEnv({
      NODE_ENV: "production",
      JWT_SECRET: "anchormarks-secret-key-change-in-production",
      CORS_ORIGIN: "https://example.com",
    });
    expect(() => config.validateSecurityConfig()).toThrow(/JWT_SECRET/i);
  });

  it("validateSecurityConfig throws if CORS_ORIGIN missing in production", () => {
    const config = loadConfigWithEnv({
      NODE_ENV: "production",
      JWT_SECRET: "super-secure",
      CORS_ORIGIN: "",
    });
    expect(() => config.validateSecurityConfig()).toThrow(/CORS_ORIGIN/i);
  });

  it("validateSecurityConfig passes with secure settings in production", () => {
    const config = loadConfigWithEnv({
      NODE_ENV: "production",
      JWT_SECRET: "super-secure",
      CORS_ORIGIN: "https://example.com",
    });
    expect(() => config.validateSecurityConfig()).not.toThrow();
  });

  it("resolveCorsOrigin returns true outside production", () => {
    const config = loadConfigWithEnv({ NODE_ENV: "test" });
    expect(config.resolveCorsOrigin()).toBe(true);
  });

  it("resolveCorsOrigin rejects wildcard * in production", () => {
    const config = loadConfigWithEnv({
      NODE_ENV: "production",
      CORS_ORIGIN: "*",
    });
    expect(() => config.resolveCorsOrigin()).toThrow(/cannot be \*/i);
  });

  it("resolveCorsOrigin returns trimmed array in production", () => {
    const config = loadConfigWithEnv({
      NODE_ENV: "production",
      CORS_ORIGIN: " https://a.test,https://b.test  , ",
    });
    expect(config.resolveCorsOrigin()).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("isApiKeyAllowed matches whitelist rules", () => {
    const config = loadConfigWithEnv({ NODE_ENV: "test" });

    expect(
      config.isApiKeyAllowed({ method: "GET", path: "/api/quick-search" }),
    ).toBe(true);
    expect(
      config.isApiKeyAllowed({ method: "GET", path: "/api/bookmarks" }),
    ).toBe(true);
    expect(
      config.isApiKeyAllowed({ method: "POST", path: "/api/bookmarks" }),
    ).toBe(true);
    expect(
      config.isApiKeyAllowed({ method: "GET", path: "/api/folders" }),
    ).toBe(true);

    expect(
      config.isApiKeyAllowed({ method: "DELETE", path: "/api/bookmarks/123" }),
    ).toBe(false);
    expect(config.isApiKeyAllowed({ method: "GET", path: "/api/tags" })).toBe(
      false,
    );
  });
});
