import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("logger utility", () => {
  let safeLocalStorageMock: Record<string, string | null>;
  let loggerModule: typeof import("../logger.ts");
  let originalEnv: Record<string, unknown>;

  beforeEach(async () => {
    vi.resetModules();
    safeLocalStorageMock = {};
    originalEnv = { ...(import.meta.env as Record<string, unknown>) };
    const env = import.meta.env as Record<string, unknown>;
    env.DEV = false;
    env.MODE = "test";

    // mock dependencies before importing module under test
    vi.doMock("../index.ts", () => ({
      safeLocalStorage: {
        getItem: (key: string) => safeLocalStorageMock[key] ?? null,
        setItem: (key: string, value: string) => {
          safeLocalStorageMock[key] = value;
          return true;
        },
        removeItem: (key: string) => {
          delete safeLocalStorageMock[key];
          return true;
        },
      },
    }));

    loggerModule = await import("../logger.ts");

    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(import.meta.env as Record<string, unknown>, originalEnv);
    vi.restoreAllMocks();
  });

  it("logs debug/info when in development mode", () => {
    (import.meta.env as Record<string, unknown>).DEV = true;

    loggerModule.logger.debug("dev debug");
    loggerModule.logger.info("dev info");

    expect(console.debug).toHaveBeenCalledWith("dev debug");
    expect(console.info).toHaveBeenCalledWith("dev info");
  });

  it("suppresses debug/info in production but allows warn/error", () => {
    const env = import.meta.env as Record<string, unknown>;
    env.DEV = false;
    env.MODE = "production";

    loggerModule.logger.debug("prod debug");
    loggerModule.logger.info("prod info");
    loggerModule.logger.warn("prod warn");
    loggerModule.logger.error("prod error");

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("prod warn");
    expect(console.error).toHaveBeenCalledWith("prod error");
  });

  it("treats local debug flag as development", () => {
    (import.meta.env as Record<string, unknown>).DEV = false;
    safeLocalStorageMock["anchormarks_debug"] = "true";

    loggerModule.logger.debug("flag debug");

    expect(console.debug).toHaveBeenCalledWith("flag debug");
  });

  it("formats context using helper wrappers", () => {
    const err = new Error("boom");
    (import.meta.env as Record<string, unknown>).DEV = true;

    loggerModule.logInfo("info", "context");
    loggerModule.logWarn("warn", "context");
    loggerModule.logError("error", err);

    expect(console.info).toHaveBeenCalledWith("info", "context");
    expect(console.warn).toHaveBeenCalledWith("warn", "context");
    expect(console.error).toHaveBeenCalledWith("error", err);
  });
});
