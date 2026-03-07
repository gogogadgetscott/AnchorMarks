import { describe, expect, it, beforeEach } from "vitest";

import { updateStats, getEmptyStateMessage, dom } from "../ui-helpers.ts";
import * as state from "@features/state.ts";

describe("ui-helpers", () => {
  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="stat-bookmarks"></div>
      <div id="stat-folders"></div>
      <div id="stat-tags"></div>
      <div id="folders-count"></div>
      <div id="stat-label-links"></div>
      <div id="stat-label-folders"></div>
      <div id="stat-label-tags"></div>
      <div id="main-view-outlet"></div>
    `;

    state.setTotalCount(12);
    state.setRenderedBookmarks([
      { id: "1", tags: "alpha,beta" },
      { id: "2", tags: "beta" },
      { id: "3", tags: "" },
    ] as any);
    state.setFolders([
      { id: "f1", name: "Folder 1" },
      { id: "f2", name: "Folder 2" },
    ] as any);
    state.dashboardWidgets.length = 0;
    await state.setCurrentView("all");
    state.setCurrentFolder(null);
    state.setFilterConfig({
      ...state.filterConfig,
      tags: [],
    });
    // ensure dom.searchInput exists
    const searchInput = document.createElement("input");
    searchInput.id = "search-input";
    document.body.appendChild(searchInput);
    dom.searchInput = searchInput;
  });

  it("updateStats reflects current state counts", () => {
    updateStats();
    expect(document.getElementById("stat-bookmarks")?.textContent).toBe("12");
    expect(document.getElementById("stat-folders")?.textContent).toBe("2");
    expect(document.getElementById("stat-tags")?.textContent).toBe("2");
    expect(document.getElementById("stat-label-links")?.textContent).toBe(
      "links",
    );
    expect(document.getElementById("folders-count")?.textContent).toBe("2");
  });

  it("getEmptyStateMessage changes with filters and views", async () => {
    state.setFilterConfig({ ...state.filterConfig, tags: ["alpha"] });
    let html = getEmptyStateMessage();
    expect(html).toContain("No bookmarks with these tags");

    state.setFilterConfig({ ...state.filterConfig, tags: [] });
    dom.searchInput!.value = "react";
    html = getEmptyStateMessage();
    expect(html).toContain("No results found");

    await state.setCurrentView("favorites");
    html = getEmptyStateMessage();
    expect(html).toContain("You haven't added any favorites yet");
  });
});
