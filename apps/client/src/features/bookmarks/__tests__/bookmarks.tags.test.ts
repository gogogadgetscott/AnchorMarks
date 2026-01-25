import { vi, describe, it, beforeEach, expect } from "vitest";
import * as state from "@features/state.ts";
import { loadBookmarks } from "@features/bookmarks/bookmarks.ts";

// Mock API
let apiCalls: string[] = [];
vi.mock("@services/api.ts", () => ({
  api: (endpoint: string) => {
    apiCalls.push(endpoint);
    // Return appropriate mock shapes depending on endpoint
    if (endpoint.startsWith("/bookmarks")) {
      return Promise.resolve({ bookmarks: [], total: 0 });
    }
    if (endpoint.startsWith("/tags")) {
      return Promise.resolve([]);
    }
    return Promise.resolve(null);
  },
}));

describe("loadBookmarks - tag query", () => {
  beforeEach(() => {
    apiCalls = [];
    state.setFilterConfig({ ...state.filterConfig, tags: [] });
  });

  it("includes single tag in API request when filterConfig.tags has one tag", async () => {
    state.setFilterConfig({ ...state.filterConfig, tags: ["foo"] });

    await loadBookmarks();

    expect(apiCalls.length).toBeGreaterThan(0);
    const calledWith = apiCalls[0];
    expect(calledWith.includes("tags=foo")).toBe(true);
  });

  it("includes comma-separated tags when filterConfig.tags has multiple tags", async () => {
    state.setFilterConfig({
      ...state.filterConfig,
      tags: ["foo", "bar"],
      tagMode: "OR",
    });

    await loadBookmarks();

    expect(apiCalls.length).toBeGreaterThan(0);
    const calledWith = apiCalls[0];
    // URL encodes commas so decode before asserting
    const decoded = decodeURIComponent(calledWith);
    expect(decoded.includes("tags=foo,bar")).toBe(true);
    expect(decoded.includes("tagMode=OR")).toBe(true);
  });

  it("includes tagMode=AND when set to AND", async () => {
    state.setFilterConfig({
      ...state.filterConfig,
      tags: ["a", "b"],
      tagMode: "AND",
    });

    await loadBookmarks();

    expect(apiCalls.length).toBeGreaterThan(0);
    const calledWith = apiCalls[0];
    expect(calledWith.includes("tagMode=AND")).toBe(true);
  });
});
