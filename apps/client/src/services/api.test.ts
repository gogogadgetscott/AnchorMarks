import { describe, it, expect, afterEach, vi } from "vitest";
import { api, cancelRequest } from "./api";
import * as state from "@features/state.ts";

const jsonHeaders = { get: () => "application/json" } as const;

describe("api helper", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cancelRequest("/test");
    cancelRequest("/error");
    cancelRequest("/dedupe");
    cancelRequest("/abort");
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
        options.signal?.addEventListener("abort", () => reject(abortError));
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

    await expect(promise).rejects.toThrow("Request cancelled");
    vi.runAllTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
