import { vi, describe, it, beforeEach, afterEach, expect } from "vitest";
import * as state from "@features/state.ts";
import { renderTagCloud } from "@features/bookmarks/tag-cloud.ts";

// Top-level spies and data used by hoisted mocks (must be set before api() is called)
const updateHeaderSpy = vi.fn();
const loadBookmarksSpy = vi.fn();
const mockBookmarksForApi: any[] = [
  { id: "1", title: "One", url: "https://a", tags: "foo,bar" },
  { id: "2", title: "Two", url: "https://b", tags: "foo" },
];

// Mock App updateHeaderContent and bookmarks.loadBookmarks at top-level
vi.mock("@/App.ts", () => ({
  updateHeaderContent: (...args: any[]) => updateHeaderSpy(...args),
}));
vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  loadBookmarks: (...args: any[]) => loadBookmarksSpy(...args),
}));

// Mock API: use mockBookmarksForApi so tag-cloud buildTagData always gets tag data
vi.mock("@services/api.ts", () => ({
  api: (endpoint: string) => {
    if (endpoint.startsWith("/bookmarks"))
      return Promise.resolve(mockBookmarksForApi);
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

    state.setBookmarks(mockBookmarksForApi);
  });

  afterEach(() => {
    // Don't use vi.resetAllMocks() — it resets mock implementations and breaks
    // the vi.mock("@/App.ts") forward to updateHeaderSpy on the next run.
    // Clear any window cleanup functions
    (window as any).__tagCloudResizeCleanup?.();
    (window as any).__tagCloudResizeCleanup = undefined;
  });

  it("calls header update and loads bookmarks when a tag is clicked", async () => {
    // Ensure we're in tag-cloud view
    await state.setCurrentView("tag-cloud");

    const outlet = document.getElementById("main-view-outlet")!;
    await renderTagCloud(outlet, { skipViewCheck: true });

    expect(outlet.innerHTML).toContain('data-tag="foo"');

    const tagBtn = outlet.querySelector(
      '.tag-cloud-tag[data-tag="foo"]',
    ) as HTMLElement | null;
    expect(tagBtn).toBeTruthy();

    // Click it
    tagBtn!.click();

    // Wait for async click handler (dynamic imports + loadBookmarks) to complete
    await vi.waitFor(
      () => {
        expect(updateHeaderSpy).toHaveBeenCalled();
        expect(loadBookmarksSpy).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );

    // Confirm view title updated
    const viewTitle = document.getElementById("view-title");
    expect(viewTitle?.textContent).toContain("Tag: foo");
  });
});
