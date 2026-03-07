import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bookmark } from "../../types";

let state: typeof import("../state.ts");
let eventCleanup: typeof import("../../utils/event-cleanup.ts");

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = "";
  document.body.className = "";
  window.__tagCloudResizeCleanup = undefined;
  state = await import("../state.ts");
  eventCleanup = await import("../../utils/event-cleanup.ts");
});

describe("state module", () => {
  it("notifies subscribers and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.setAuthToken("abc123");
    expect(listener).toHaveBeenCalledWith("authToken", "abc123");

    unsubscribe();
    state.setAuthToken("def456");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("clears widget cache when toggling includeChildBookmarks", () => {
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.setWidgetDataCache("widget-1", [
      { id: "1", title: "Example" } as Bookmark,
    ]);
    expect(Object.keys(state.widgetDataCache)).toHaveLength(1);

    state.setIncludeChildBookmarks(true);

    expect(Object.keys(state.widgetDataCache)).toHaveLength(0);
    expect(listener).toHaveBeenCalledWith("widgetDataCache", null);
    expect(state.includeChildBookmarks).toBe(true);

    unsubscribe();
  });

  it("cleans dashboard artifacts and resets filters when leaving dashboard views", async () => {
    document.body.innerHTML = `
      <div id="views-dropdown"></div>
      <div id="main-view-outlet" class="dashboard">content</div>
      <span id="dashboard-view-name">Custom View</span>
      <div id="dashboard-unsaved-indicator" class="flag"></div>
      <input id="search-input" value="q" />
      <input id="filter-search-input" value="tag" />
    `;
    const cleanupSpy = vi.spyOn(eventCleanup, "cleanupView");

    state.setFilterConfig({
      ...state.filterConfig,
      tags: ["focus"],
      search: "abc",
    } as any);

    await state.setCurrentView("favorites");

    expect(cleanupSpy).toHaveBeenCalledWith("dashboard");
    expect(document.getElementById("views-dropdown")).toBeNull();

    const outlet = document.getElementById("main-view-outlet");
    expect(outlet?.className).toBe("");
    expect(outlet?.innerHTML).toBe("");

    const badge = document.getElementById("dashboard-view-name");
    expect(badge?.textContent).toBe("");
    expect(badge?.classList.contains("hidden")).toBe(true);

    const unsaved = document.getElementById("dashboard-unsaved-indicator");
    expect(unsaved?.classList.contains("hidden")).toBe(true);

    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement | null;
    const filterSearchInput = document.getElementById(
      "filter-search-input",
    ) as HTMLInputElement | null;
    expect(searchInput?.value).toBe("");
    expect(filterSearchInput?.value).toBe("");

    expect(state.filterConfig.tags).toEqual([]);
    expect((state.filterConfig as any).search).toBeUndefined();
    expect(state.currentView).toBe("favorites");
    expect(document.body.classList.contains("dashboard-active")).toBe(false);
  });

  it("runs tag cloud cleanup when switching away", async () => {
    const cleanupSpy = vi.spyOn(eventCleanup, "cleanupView");
    const cloudCleanup = vi.fn();
    window.__tagCloudResizeCleanup = cloudCleanup;

    await state.setCurrentView("tag-cloud");
    await state.setCurrentView("all");

    expect(cleanupSpy).toHaveBeenCalledWith("tag-cloud");
    expect(cloudCleanup).toHaveBeenCalledTimes(1);
    expect(window.__tagCloudResizeCleanup).toBeUndefined();
    expect(state.currentView).toBe("all");
  });
});
