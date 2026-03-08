import { beforeEach, describe, expect, it, vi } from "vitest";

import * as state from "@features/state.ts";
import { loadBookmarks } from "@features/bookmarks/bookmarks.ts";
import {
  renderActiveFilters,
  clearAllFilters,
} from "@features/bookmarks/search.ts";

vi.mock("@services/api.ts", () => ({
  api: vi.fn(async (endpoint: string, options?: RequestInit) => {
    if (endpoint.startsWith("/bookmarks")) {
      const response = {
        bookmarks: state.bookmarks,
        total: state.bookmarks.length,
      };
      if (options?.method === "POST" && endpoint.endsWith("/fetch-metadata")) {
        return { og_image: "https://img.test/meta.png" };
      }
      return response;
    }
    if (endpoint === "/tags") {
      return Object.keys(state.tagMetadata).map((name, idx) => ({
        id: `tag-${idx}`,
        name,
        color: state.tagMetadata[name]?.color,
        count: state.tagMetadata[name]?.count ?? 0,
      }));
    }
    if (endpoint.startsWith("/bookmark/views")) {
      if (endpoint.endsWith("/restore")) {
        return {
          config: {
            search_query: "restored term",
            filter_tags: ["restored"],
            filter_folder: null,
            sort_order: "a_z",
            tag_sort: "name_asc",
            tag_mode: "AND",
          },
        };
      }
      if (options?.method === "POST") {
        return { id: "view-123" };
      }
      return [];
    }
    return {};
  }),
}));

describe("bookmarks filtering + active filter UI", () => {
  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="main-view-outlet" class="bookmarks-grid"></div>
      <div id="empty-state"></div>
      <input id="search-input" value="" />
      <div id="view-title">Bookmarks</div>
      <div id="active-filters-section" class="hidden">
        <div id="active-filters-chips"></div>
      </div>
      <div id="sidebar-tags-list"></div>
      <div id="tags-count"></div>
      <button id="tags-show-more" class="hidden"></button>
    `;

    state.setBookmarks([
      {
        id: "b1",
        title: "Alpha Note",
        url: "https://alpha.test",
        tags: "alpha,common",
        created_at: "2024-01-01",
      } as any,
      {
        id: "b2",
        title: "Beta Doc",
        url: "https://beta.test",
        tags: "beta,common",
        created_at: "2024-02-01",
        click_count: 2,
      } as any,
    ]);
    state.setRenderedBookmarks(state.bookmarks);
    state.setFolders([{ id: "f-1", name: "Work" } as any]);
    state.setCollections([{ id: "c-1", name: "Focus" } as any]);
    state.setTagMetadata({
      alpha: { color: "#f00", count: 1 },
      beta: { color: "#0f0", count: 1 },
      common: { color: "#00f", count: 2 },
    });
    await state.setCurrentView("all");
    state.setCurrentFolder(null);
    state.setFilterConfig({
      sort: "recently_added",
      tags: [],
      tagSort: "count_desc",
      tagMode: "OR",
    });
    // renderSidebarTags() removed - React components handle sidebar rendering
  });

  it("renderActiveFilters shows folder, tags, and search chips", async () => {
    state.setCurrentFolder("f-1");
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    searchInput.value = "alpha";
    state.setFilterConfig({
      ...state.filterConfig,
      tags: ["alpha", "beta"],
      search: "alpha",
    });

    renderActiveFilters();

    const section = document.getElementById("active-filters-section")!;
    expect(section.classList.contains("hidden")).toBe(false);
    const chips = document.getElementById("active-filters-chips")!;
    expect(chips.innerHTML).toContain("Work");
    expect(chips.innerHTML).toContain("Search: alpha");
    const tagButtons = Array.from(
      chips.querySelectorAll('[data-action="remove-tag-filter"]'),
    ).map((btn) => btn.getAttribute("data-tag"));
    expect(tagButtons).toEqual(expect.arrayContaining(["alpha", "beta"]));
    expect(
      chips.querySelector("#filter-tag-mode-btn")?.textContent?.trim(),
    ).toContain("Match: OR");
  });

  it("clearAllFilters resets filters, hides section, and triggers load", async () => {
    const bookmarksModule = await import("@features/bookmarks/bookmarks.ts");
    const loadSpy = vi.spyOn(bookmarksModule, "loadBookmarks");
    state.setCurrentFolder("f-1");
    state.setFilterConfig({
      ...state.filterConfig,
      tags: ["alpha"],
    });
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    searchInput.value = "alpha";
    renderActiveFilters();
    const section = document.getElementById("active-filters-section")!;
    expect(section.classList.contains("hidden")).toBe(false);

    await clearAllFilters();
    await vi.waitFor(() => {
      expect(loadSpy).toHaveBeenCalled();
    });

    expect(state.filterConfig.tags).toEqual([]);
    expect(state.filterConfig.sort).toBe("recently_added");
    expect(state.currentFolder).toBeNull();
    expect(
      document
        .getElementById("active-filters-section")!
        .classList.contains("hidden"),
    ).toBe(true);
  });

  it("loadBookmarks sends tags + tagMode for AND matching", async () => {
    state.setFilterConfig({
      ...state.filterConfig,
      tags: ["alpha", "beta"],
      tagMode: "AND",
    });

    const apiModule = await import("@services/api.ts");
    const api = apiModule.api as ReturnType<typeof vi.fn>;
    api.mockClear();

    await loadBookmarks();

    const calledEndpoint = api.mock.calls
      .map((args: any[]) => args[0] as string)
      .find(
        (endpoint) =>
          typeof endpoint === "string" && endpoint.startsWith("/bookmarks"),
      );

    expect(calledEndpoint).toBeDefined();
    expect(decodeURIComponent(calledEndpoint!)).toContain("tags=alpha,beta");
    expect(decodeURIComponent(calledEndpoint!)).toContain("tagMode=AND");
  });

  it("loadBookmarks includes search + folder filters", async () => {
    state.setCurrentFolder("f-1");
    state.setFilterConfig({
      ...state.filterConfig,
      search: "beta",
    });

    const apiModule = await import("@services/api.ts");
    const api = apiModule.api as ReturnType<typeof vi.fn>;
    api.mockClear();

    await loadBookmarks();

    const calledEndpoint = api.mock.calls
      .map((args: any[]) => args[0] as string)
      .find(
        (endpoint) =>
          typeof endpoint === "string" && endpoint.startsWith("/bookmarks"),
      );

    expect(calledEndpoint).toBeDefined();
    expect(calledEndpoint!).toContain("folder_id=f-1");
    expect(decodeURIComponent(calledEndpoint!)).toContain("search=beta");
  });
});
