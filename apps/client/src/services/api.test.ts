import { describe, it, expect, afterEach, vi } from "vitest";
import { api, ApiError, cancelRequest, teardownApiDedup } from "./api";
import * as state from "@features/state.ts";

const jsonHeaders = { get: () => "application/json" } as const;

describe("api helper", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cancelRequest("/test");
    cancelRequest("/error");
    cancelRequest("/dedupe");
    cancelRequest("/abort");
    teardownApiDedup();
    state.setCsrfToken(null);
    state.setCurrentUser(null);
    state.setIsAuthenticated(false);
  });

  it("returns parsed JSON and sends headers", async () => {
    state.setCsrfToken("csrf-token");

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: jsonHeaders,
      json: async () => ({ success: true }),
    }));
    global.fetch = fetchMock as any;

    const result = await api<{ success: boolean }>("/test", {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
    });

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-Token": "csrf-token",
        }),
      }),
    );
  });

  it("throws a helpful error when response is not JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "text/html" },
      text: async () => "<html>oops</html>",
    }));
    global.fetch = fetchMock as any;

    await expect(api("/bad")).rejects.toThrow("Invalid response format");
  });

  it("surfaces API error messages from JSON responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: jsonHeaders,
      json: async () => ({ error: "Invalid request" }),
    }));
    global.fetch = fetchMock as any;

    await expect(api("/error")).rejects.toThrow("Invalid request");
  });

  it("deduplicates concurrent GET requests", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: jsonHeaders,
      json: async () => ({ value: 1 }),
    }));
    global.fetch = fetchMock as any;

    const resultA = api("/dedupe");
    const resultB = api("/dedupe");

    const [resolvedA, resolvedB] = await Promise.all([resultA, resultB]);
    expect(resolvedA).toEqual({ value: 1 });
    expect(resolvedB).toEqual({ value: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels pending requests and reports cancellation", async () => {
    vi.useFakeTimers();

    const abortError = new Error("Aborted");
    abortError.name = "AbortError";

    const fetchMock = vi.fn((_, options: any) => {
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          // Use the abort reason (e.g. "Request cancelled") when provided
          const reason = (options.signal as AbortSignal & { reason?: unknown })
            ?.reason;
          reject(reason ?? abortError);
        });
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: jsonHeaders,
            json: async () => ({ cancelled: false }),
          });
        }, 100);
      });
    });
    global.fetch = fetchMock as any;

    const promise = api("/abort");
    cancelRequest("/abort");

    await expect(promise).rejects.toThrow(/Request (timeout or )?cancelled/);
    vi.runAllTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("ApiError and 429 handling", () => {
  afterEach(() => {
    vi.clearAllMocks();
    teardownApiDedup();
    state.setCsrfToken(null);
    state.setCurrentUser(null);
    state.setIsAuthenticated(false);
  });

  const errorResponse = (status: number, retryAfter?: string) => ({
    ok: false,
    status,
    statusText: status === 429 ? "Too Many Requests" : "Server Error",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "retry-after"
          ? (retryAfter ?? null)
          : "application/json",
    },
    json: async () => ({ error: "Rate limit exceeded" }),
  });

  it("carries the status and the parsed Retry-After hint on 429", async () => {
    global.fetch = vi.fn(async () => errorResponse(429, "17")) as any;

    const err: any = await api("/limit-with-header").catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(17);
    expect(err.message).toBe("Rate limit exceeded");
  });

  it("leaves retryAfter undefined when the header is missing or invalid", async () => {
    global.fetch = vi.fn(async () => errorResponse(429)) as any;
    const noHeader: any = await api("/limit-no-header").catch((e) => e);
    expect(noHeader).toBeInstanceOf(ApiError);
    expect(noHeader.retryAfter).toBeUndefined();

    global.fetch = vi.fn(async () => errorResponse(429, "soon")) as any;
    const garbage: any = await api("/limit-bad-header").catch((e) => e);
    expect(garbage).toBeInstanceOf(ApiError);
    expect(garbage.retryAfter).toBeUndefined();

    global.fetch = vi.fn(async () => errorResponse(429, "0")) as any;
    const zero: any = await api("/limit-zero-header").catch((e) => e);
    expect(zero).toBeInstanceOf(ApiError);
    expect(zero.retryAfter).toBeUndefined();
  });

  it("ignores Retry-After on non-429 responses", async () => {
    global.fetch = vi.fn(async () => errorResponse(503, "30")) as any;

    const err: any = await api("/unavailable").catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.retryAfter).toBeUndefined();
  });

  it("keeps the typed error (with Retry-After) through the token-refresh retry path", async () => {
    const fetchMock = vi
      .fn()
      // 1) original request → 401 triggers a refresh attempt
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: { get: () => "application/json" },
        json: async () => ({ error: "Access token expired" }),
      })
      // 2) POST /auth/refresh → succeeds
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => "application/json" },
        json: async () => ({
          csrfToken: "fresh-csrf",
          user: { id: "u1", email: "user@example.com" },
        }),
      })
      // 3) retried request → rate limited
      .mockResolvedValueOnce(errorResponse(429, "23"));
    global.fetch = fetchMock as any;

    const err: any = await api("/limit-after-refresh").catch((e) => e);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(23);
  });
});
