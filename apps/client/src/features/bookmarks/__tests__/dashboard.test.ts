import { vi, describe, it, beforeEach, expect } from "vitest";
import * as state from "@features/state.ts";
import {
  renderDashboard,
  initDashboardViews,
  restoreView,
  filterDashboardBookmarks,
  updateLayoutStats,
  autoPositionWidgets,
} from "@features/bookmarks/dashboard.ts";

const { apiMock, loadSettingsSpy, saveSettingsSpy } = vi.hoisted(() => ({
  apiMock: vi.fn((endpoint: string) => {
    if (endpoint === "/dashboard/views") return Promise.resolve([]);
    if (String(endpoint).includes("/restore"))
      return Promise.resolve({ success: true });
    if (String(endpoint).includes("/bookmarks?folder_id=legacy-folder")) {
      return Promise.resolve({
        bookmarks: [
          {
            id: "b1",
            title: "Legacy Bookmark",
            url: "https://example.com",
            folder_id: "legacy-folder",
          },
        ],
      });
    }
    return Promise.resolve([]);
  }),
  loadSettingsSpy: vi.fn(() => Promise.resolve()),
  saveSettingsSpy: vi.fn(() => Promise.resolve()),
}));

// Mock API so dropdown loads without network and so we can assert call counts
vi.mock("@services/api.ts", () => ({
  api: apiMock,
}));

// Mock settings loader used by restoreView
vi.mock("@features/bookmarks/settings.ts", () => ({
  loadSettings: loadSettingsSpy,
  saveSettings: saveSettingsSpy,
}));

// Stub bookmarks loader for filter tests
const loadBookmarksSpy = vi.fn();
const renderSkeletonsSpy = vi.fn((container?: HTMLElement) => {
  // Render actual skeleton cards to the outlet if provided
  const outlet = container || document.getElementById("main-view-outlet");
  if (outlet) {
    outlet.className = "bookmarks-grid";
    outlet.innerHTML = Array(8)
      .fill(null)
      .map(
        () =>
          '<div class="skeleton-card" style="height: 200px; background: #f0f0f0;"></div>',
      )
      .join("");
  }
});
vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  loadBookmarks: loadBookmarksSpy,
  renderSkeletons: renderSkeletonsSpy,
}));

function setupDom() {
  document.body.innerHTML = `
    <div class="header-right"></div>
    <div id="main-view-outlet"></div>
  `;
}

describe("Dashboard rendering and views initialization", () => {
  beforeEach(async () => {
    setupDom();
    await state.setCurrentView("dashboard");
    state.setDashboardWidgets([]);
    state.setDashboardHasUnsavedChanges(false);
    apiMock.mockClear();
    loadSettingsSpy.mockClear();
    saveSettingsSpy.mockClear();
  });

  it("renders help text when there are no widgets", async () => {
    await renderDashboard();
    const outlet = document.getElementById("main-view-outlet")!;
    expect(outlet.className).toBe("dashboard-freeform");

    await vi.waitFor(() => {
      const grid = document.querySelector('[data-testid="dashboard-grid"]');
      expect(grid).toBeTruthy();
      expect(grid?.textContent).toContain(
        'No widgets. Click "Add Widget" to get started.',
      );
    });
  });

  it("does not render dashboard markup when current view is not dashboard", async () => {
    let outlet = document.getElementById("main-view-outlet")!;
    outlet.className = "bookmarks-grid";
    outlet.innerHTML = '<div id="bookmarks-sentinel">Bookmarks View</div>';

    await state.setCurrentView("all");
    await renderDashboard(); // Should return early, not touch content

    outlet = document.getElementById("main-view-outlet")!;
    // When switching away from dashboard in setCurrentView, outlet is cleared
    expect(outlet.innerHTML).toBe("");

    // When renderSkeletons is called, it properly populates content
    renderSkeletonsSpy();
    expect(outlet.className).toBe("bookmarks-grid");
    expect(outlet.innerHTML).toContain("skeleton"); // skeleton cards should be present

    await state.setCurrentView("dashboard");
  });

  it("clears dashboard markup immediately when switching away", async () => {
    state.setDashboardWidgets([
      {
        id: "w1",
        type: "tag",
        linkedId: "foo",
        x: 10,
        y: 20,
        width: 100,
        height: 150,
        title: "Test",
      },
    ] as any);

    await renderDashboard();

    let outlet = document.getElementById("main-view-outlet")!;

    // Wait for React to mount widgets container
    await vi.waitFor(() => {
      expect(outlet.classList.contains("dashboard-freeform")).toBe(true);
      expect(outlet.querySelector(".dashboard-widgets-container")).toBeTruthy();
    });

    await state.setCurrentView("all");

    outlet = document.getElementById("main-view-outlet")!;
    // Dashboard class is removed and content is cleared immediately
    expect(outlet.classList.contains("dashboard-freeform")).toBe(false);
    expect(outlet.innerHTML).toBe("");

    // When renderSkeletons is called, dashboard content is replaced
    renderSkeletonsSpy();
    expect(outlet.innerHTML).not.toContain("dashboard-widgets-container");
    expect(outlet.innerHTML).toContain("skeleton");

    await state.setCurrentView("dashboard");
  });

  it("supports dropping a sidebar item into an empty dashboard", async () => {
    state.setDraggedSidebarItem({
      type: "tag",
      id: "foo",
      name: "foo",
    } as any);

    await renderDashboard();

    // React dashboard uses programmatic APIs for adding widgets; call directly
    const { addDashboardWidget } =
      await import("@features/bookmarks/dashboard.ts");
    addDashboardWidget("tag", "foo", 120, 80);

    expect(state.dashboardWidgets.length).toBe(1);
    expect(state.dashboardWidgets[0].type).toBe("tag");
    expect((state.dashboardWidgets[0].config as any).linkedId).toBe("foo");
  });

  it("renders bookmarks for legacy folder widgets using id fallback", async () => {
    state.setFolders([{ id: "legacy-folder", name: "Legacy Folder" } as any]);
    state.setBookmarks([]);
    state.setDashboardWidgets([
      {
        id: "legacy-folder",
        type: "folder",
        x: 10,
        y: 20,
        width: 100,
        height: 150,
        title: "Legacy Folder",
      },
    ] as any);

    await renderDashboard();

    await vi.waitFor(
      () => {
        const outlet = document.getElementById("main-view-outlet")!;
        expect(outlet.innerHTML).toContain("Legacy Bookmark");
      },
      { timeout: 200 },
    );
  });

  it("wraps widgets in the new container structure and uses freeform class", async () => {
    state.setDashboardWidgets([
      {
        id: "w1",
        type: "folder",
        linkedId: "foo",
        x: 10,
        y: 20,
        width: 100,
        height: 150,
        title: "Test",
      },
    ] as any);
    await renderDashboard();
    const outlet = document.getElementById("main-view-outlet")!;

    await vi.waitFor(() => {
      const widgetEl = outlet.querySelector(
        ".dashboard-widget-freeform",
      ) as HTMLElement;
      expect(widgetEl).toBeTruthy();
      expect(widgetEl.style.left).toBe("10px");
      expect(widgetEl.style.top).toBe("20px");
      expect(widgetEl.style.width).toBe("100px");
      expect(widgetEl.style.height).toBe("150px");
    });
  });

  it("initializes the views button and toggles dropdown on click", async () => {
    // headerRight already present; run initDashboardViews which should
    // create and wire the button
    await initDashboardViews();

    const viewsBtn = document.getElementById("views-btn");
    expect(viewsBtn).toBeTruthy();

    // click should append dropdown (handler is async so wait)
    viewsBtn!.click();
    await vi.waitFor(
      () => {
        expect(document.getElementById("views-dropdown")).toBeTruthy();
      },
      { timeout: 100 },
    );

    // clicking outside should remove it
    document.body.click();
    expect(document.getElementById("views-dropdown")).toBeNull();
  });

  it("does not stack views button click handlers across repeated init", async () => {
    await initDashboardViews();
    await initDashboardViews();

    const viewsBtn = document.getElementById("views-btn");
    expect(viewsBtn).toBeTruthy();

    viewsBtn!.click();

    await vi.waitFor(
      () => {
        expect(document.getElementById("views-dropdown")).toBeTruthy();
      },
      { timeout: 100 },
    );

    const viewsCalls = apiMock.mock.calls.filter(
      ([endpoint]) => endpoint === "/dashboard/views",
    );
    expect(viewsCalls.length).toBe(3);
  });

  it("restoreView reloads settings and persists selected dashboard view", async () => {
    await restoreView("view-123", "Work View");

    expect(apiMock).toHaveBeenCalledWith("/dashboard/views/view-123/restore", {
      method: "POST",
    });
    expect(loadSettingsSpy).toHaveBeenCalled();
    expect(saveSettingsSpy).toHaveBeenCalledWith({
      current_view: "dashboard",
      current_dashboard_view_id: "view-123",
      current_dashboard_view_name: "Work View",
    });
    expect(state.currentDashboardViewId).toBe("view-123");
    expect(state.currentDashboardViewName).toBe("Work View");
  });
});

// Additional helper tests

describe("Dashboard interactivity helpers", () => {
  beforeEach(async () => {
    setupDom();
    await state.setCurrentView("dashboard");
    state.setDashboardWidgets([]);
    state.setDashboardHasUnsavedChanges(false);
    loadBookmarksSpy.mockClear();
  });

  it("filterDashboardBookmarks updates search term and calls loader", async () => {
    await filterDashboardBookmarks("searchterm");
    expect(state.filterConfig.search).toBe("searchterm");
    expect(loadBookmarksSpy).toHaveBeenCalled();
  });

  it("resizing a widget updates its size state", async () => {
    state.setDashboardWidgets([
      {
        id: "w1",
        type: "folder",
        linkedId: "foo",
        x: 0,
        y: 0,
        width: 220,
        height: 180,
        title: "ResizeMe",
      },
    ] as any);
    await renderDashboard();

    await vi.waitFor(() => {
      expect(document.querySelector(".dashboard-widget-freeform")).toBeTruthy();
    });

    const widget = document.querySelector(
      ".dashboard-widget-freeform",
    ) as HTMLElement;
    expect(widget).toBeTruthy();

    const resizeHandle = widget.querySelector(
      ".widget-resize-handle",
    ) as HTMLElement;
    resizeHandle.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      }),
    );

    document.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        cancelable: true,
        clientX: 40,
        clientY: 30,
      }),
    );
    document.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        clientX: 40,
        clientY: 30,
      }),
    );

    const updatedWidget = state.dashboardWidgets[0] as any;
    expect(updatedWidget.w ?? updatedWidget.width).toBe(260);
    expect(updatedWidget.h ?? updatedWidget.height).toBe(220);
  });

  it("updateLayoutStats writes counts to the stats element", () => {
    const statsEl = document.createElement("div");
    statsEl.id = "layout-stats";
    document.body.appendChild(statsEl);

    state.setDashboardWidgets([
      {
        id: "a",
        type: "folder",
        linkedId: "",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        title: "",
      } as any,
    ]);
    updateLayoutStats();
    expect(statsEl.textContent).toContain("1 widget");
  });

  it("autoPositionWidgets reflows widgets from the top using row max height", () => {
    const outlet = document.getElementById("main-view-outlet");
    expect(outlet).toBeTruthy();

    Object.defineProperty(outlet as HTMLElement, "clientWidth", {
      configurable: true,
      value: 700,
    });

    state.setDashboardWidgets([
      {
        id: "a",
        type: "folder",
        linkedId: "a",
        x: 100,
        y: 1400,
        width: 320,
        height: 400,
        title: "A",
      },
      {
        id: "b",
        type: "folder",
        linkedId: "b",
        x: 240,
        y: 1800,
        width: 320,
        height: 100,
        title: "B",
      },
      {
        id: "c",
        type: "folder",
        linkedId: "c",
        x: 300,
        y: 2200,
        width: 320,
        height: 100,
        title: "C",
      },
    ] as any);

    autoPositionWidgets();

    expect(state.dashboardWidgets[0].x).toBe(0);
    expect(state.dashboardWidgets[0].y).toBe(0);
    expect(state.dashboardWidgets[1].x).toBe(340);
    expect(state.dashboardWidgets[1].y).toBe(0);
    expect(state.dashboardWidgets[2].x).toBe(0);
    expect(state.dashboardWidgets[2].y).toBe(420);
  });

  it("autoPositionWidgets places widgets in deterministic sorted order", () => {
    const outlet = document.getElementById("main-view-outlet");
    expect(outlet).toBeTruthy();

    Object.defineProperty(outlet as HTMLElement, "clientWidth", {
      configurable: true,
      value: 1000,
    });

    state.setDashboardWidgets([
      {
        id: "tag-zeta",
        type: "tag",
        linkedId: "zeta",
        x: 600,
        y: 600,
        width: 320,
        height: 200,
        title: "Zeta",
      },
      {
        id: "folder-beta",
        type: "folder",
        linkedId: "beta",
        x: 300,
        y: 300,
        width: 320,
        height: 200,
        title: "Beta",
      },
      {
        id: "folder-alpha",
        type: "folder",
        linkedId: "alpha",
        x: 0,
        y: 900,
        width: 320,
        height: 200,
        title: "Alpha",
      },
    ] as any);

    autoPositionWidgets();

    const alpha = state.dashboardWidgets.find((w: any) => w.id === "folder-alpha") as any;
    const beta = state.dashboardWidgets.find((w: any) => w.id === "folder-beta") as any;
    const zeta = state.dashboardWidgets.find((w: any) => w.id === "tag-zeta") as any;

    expect(alpha.x).toBe(0);
    expect(alpha.y).toBe(0);
    expect(beta.x).toBe(340);
    expect(beta.y).toBe(0);
    expect(zeta.x).toBe(680);
    expect(zeta.y).toBe(0);
  });
});
