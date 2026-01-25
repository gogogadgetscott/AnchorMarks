import { vi, describe, it, beforeEach, afterEach, expect } from "vitest";
import * as state from "@features/state.ts";
import { renderTagCloud } from "@features/bookmarks/tag-cloud.ts";

// Top-level spies used by hoisted mocks
const updateHeaderSpy = vi.fn();
const loadBookmarksSpy = vi.fn();

// Mock App updateHeaderContent and bookmarks.loadBookmarks at top-level
vi.mock("@/App.ts", () => ({
  updateHeaderContent: (...args: any[]) => updateHeaderSpy(...args),
}));
vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  loadBookmarks: (...args: any[]) => loadBookmarksSpy(...args),
}));

// Mock API to avoid network calls invoked by tag-cloud buildTagData
vi.mock("@services/api.ts", () => ({
  api: (endpoint: string) => {
    // Return state.bookmarks for bookmark list requests
    if (endpoint.startsWith("/bookmarks"))
      return Promise.resolve(state.bookmarks);
    return Promise.resolve([]);
  },
}));

// Minimal DOM setup helpers
function setupDom() {
  document.body.innerHTML = `
    <div id="main-view-outlet"></div>
    <div id="view-title"></div>
    <div id="sidebar-tags-list"></div>
    <div id="search-input"></div>
  `;
}

describe("Tag Cloud - clicking a tag", () => {
  beforeEach(() => {
    // Reset spies and DOM
    updateHeaderSpy.mockClear();
    loadBookmarksSpy.mockClear();
    setupDom();

    state.setBookmarks([
      { id: "1", title: "One", url: "https://a", tags: "foo,bar" },
      { id: "2", title: "Two", url: "https://b", tags: "foo" },
    ] as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    // Clear any window cleanup functions
    (window as any).__tagCloudResizeCleanup?.();
    (window as any).__tagCloudResizeCleanup = undefined;
  });

  it("calls header update and loads bookmarks when a tag is clicked", async () => {
    // Ensure we're in tag-cloud view
    state.setCurrentView("tag-cloud");

    await renderTagCloud();

    const tagBtn = document.querySelector(
      '.tag-cloud-tag[data-tag="foo"]',
    ) as HTMLElement | null;
    expect(tagBtn).toBeTruthy();

    // Click it
    tagBtn!.click();

    // Wait for async click handler to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(updateHeaderSpy).toHaveBeenCalled();
    expect(loadBookmarksSpy).toHaveBeenCalled();

    // Confirm view title updated
    const viewTitle = document.getElementById("view-title");
    expect(viewTitle?.textContent).toContain("Tag: foo");
  });
});
