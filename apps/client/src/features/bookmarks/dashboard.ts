/**
 * AnchorMarks - Dashboard Module
 * Handles dashboard rendering and widget management
 */

import * as state from "@features/state.ts";
import { escapeHtml } from "@utils/index.ts";
import { showToast, dom, updateCounts } from "@utils/ui-helpers.ts";
// Settings imported dynamically
import { api } from "@services/api.ts";
import { updateFilterButtonVisibility } from "@features/bookmarks/filters.ts";

// Grid size for snap-to-grid feature
const GRID_SIZE = 20;

// Snap value to grid
function snapToGrid(value: number): number {
  if (!state.snapToGrid) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Init dashboard views UI
export async function initDashboardViews(): Promise<void> {
  const headerActions = document.querySelector(".header-right");
  if (!headerActions) return;

  // Remove bookmark views button if it exists
  document.getElementById("bookmark-views-btn")?.remove();

  // Check if Views button already exists
  if (!document.getElementById("dashboard-views-btn")) {
    const btn = document.createElement("button");
    btn.id = "dashboard-views-btn";
    btn.className = "btn btn-secondary";
    btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
                <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
            </svg>
            Views
        `;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showViewsMenu();
    });

    headerActions.insertBefore(btn, headerActions.firstChild);
  }

  // Initial load
  await loadViews();
}

// Show views menu (simple dropdown or modal)
async function showViewsMenu(): Promise<void> {
  // Remove existing dropdown if any
  document.getElementById("views-dropdown")?.remove();

  const views = await loadViews();

  const dropdown = document.createElement("div");
  dropdown.id = "views-dropdown";
  dropdown.className = "dropdown-menu";
  dropdown.style.cssText = `
        position: absolute;
        top: 3rem;
        right: 1rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 50;
        min-width: 200px;
        padding: 0.5rem;
    `;

  let html = `
        <div style="font-weight:600;padding:0.5rem;border-bottom:1px solid var(--border-color);margin-bottom:0.5rem">
            Dashboard Views
        </div>
        <div class="views-list" style="max-height:200px;overflow-y:auto">
    `;

  if (views.length === 0) {
    html += `<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center">No saved views</div>`;
  } else {
    views.forEach((view: any) => {
      html += `
                <div class="dropdown-item view-item" data-view-id="${view.id}" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;cursor:pointer;border-radius:4px">
                    <span class="view-name" style="flex:1">${escapeHtml(view.name)}</span>
                    <button class="btn-icon small text-danger delete-view-btn" data-view-id="${view.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
    });
  }

  html += `
        </div>
        <div style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:0.5rem">
            <button class="btn btn-primary btn-sm btn-full" id="save-view-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Current View
            </button>
        </div>
    `;

  dropdown.innerHTML = html;
  document.body.appendChild(dropdown);

  // Attach event listeners to view items
  dropdown.querySelectorAll(".view-item").forEach((item: any) => {
    const viewId = item.dataset.viewId;
    const nameSpan = item.querySelector(".view-name");
    const deleteBtn = item.querySelector(".delete-view-btn");

    // Click on view name to restore
    if (nameSpan) {
      nameSpan.addEventListener("click", async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        await restoreView(viewId);
      });
    }

    // Click on delete button
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteView(viewId);
      });
    }
  });

  // Attach event listener to save button
  const saveBtn = dropdown.querySelector("#save-view-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await saveCurrentView();
    });
  }

  // Global click to close
  setTimeout(() => {
    document.addEventListener("click", closeViewsDropdown);
  }, 0);
}

function closeViewsDropdown(e: MouseEvent): void {
  const dropdown = document.getElementById("views-dropdown");
  if (
    dropdown &&
    !dropdown.contains(e.target as Node) &&
    (e.target as HTMLElement).id !== "dashboard-views-btn"
  ) {
    dropdown.remove();
    document.removeEventListener("click", closeViewsDropdown);
  }
}

// Save View
export async function saveCurrentView(): Promise<void> {
  const name = prompt("Enter a name for this view:");
  if (!name) return;

  try {
    const config = {
      dashboard_mode: state.dashboardConfig.mode,
      dashboard_tags: state.dashboardConfig.tags,
      dashboard_sort: state.dashboardConfig.bookmarkSort,
      widget_order: state.widgetOrder,
      dashboard_widgets: state.dashboardWidgets,
      include_child_bookmarks: state.includeChildBookmarks ? 1 : 0,
    };

    const view = await api("/dashboard/views", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });

    showToast("View saved!", "success");
    document.getElementById("views-dropdown")?.remove();

    // Prompt to create bookmark shortcut
    if (confirm("Create a bookmark shortcut for this view?")) {
      const { createBookmark } =
        await import("@features/bookmarks/bookmarks.ts");
      await createBookmark({
        title: name,
        url: `view:${view.id}`,
        description: "Dashboard View Shortcut",
        tags: "dashboard-views",
      });
    }
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Load Views
async function loadViews(): Promise<any[]> {
  try {
    return await api("/dashboard/views");
  } catch {
    return [];
  }
}

// Delete View
export async function deleteView(id: string): Promise<void> {
  if (!confirm("Delete this view?")) return;
  try {
    await api(`/dashboard/views/${id}`, { method: "DELETE" });
    showToast("View deleted", "success");
    // Refresh dropdown if open
    document.getElementById("views-dropdown")?.remove();
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Restore View
export async function restoreView(id: string): Promise<void> {
  try {
    await api(`/dashboard/views/${id}/restore`, { method: "POST" });
    showToast("View restored!", "success");
    document.getElementById("views-dropdown")?.remove();

    // Reload settings to get updated dashboard config
    const { loadSettings, saveSettings } =
      await import("@features/bookmarks/settings.ts");
    await loadSettings();

    // Ensure current view is set to dashboard
    state.setCurrentView("dashboard");
    await saveSettings({ current_view: "dashboard" });

    // Re-render dashboard with new settings
    renderDashboard();
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

(window as any).saveCurrentView = saveCurrentView;
(window as any).deleteView = deleteView;
(window as any).restoreView = restoreView;

// Helper to render compact bookmark item
function renderCompactBookmarkItem(b: any): string {
  const colorStyle = b.color
    ? `--bookmark-color: ${b.color}; background-color: color-mix(in srgb, ${b.color} 20%, var(--bg-primary)); border-left: 6px solid ${b.color};`
    : "";
  return `
    <div class="compact-item${b.color ? " has-color" : ""}" style="${colorStyle}">
        <a href="${b.url}" target="_blank" class="compact-item-link" data-action="track-click" data-id="${b.id}">
            <div class="compact-favicon">
                ${
                  !state.hideFavicons && b.favicon
                    ? `<img src="${b.favicon}" alt="" loading="lazy">`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/></svg>`
                }
            </div>
            <span class="compact-text">${escapeHtml(b.title)}</span>
        </a>
        <div class="compact-actions">
            <button class="compact-action-btn" data-action="edit-bookmark" data-id="${b.id}" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="compact-action-btn" data-action="copy-link" data-url="${escapeHtml(b.url)}" title="Copy link">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="compact-action-btn compact-action-danger" data-action="delete-bookmark" data-id="${b.id}" title="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        </div>
    </div>
    `;
}


// sortBookmarks is defined locally to avoid circular dependency with bookmarks.ts
function sortBookmarks(list: any[], widgetSort?: string): any[] {
  const sort =
    widgetSort || state.dashboardConfig.bookmarkSort || "recently_added";
  return [...list].sort((a, b) => {
    switch (sort) {
      case "a_z":
      case "a-z":
      case "alpha":
        return a.title.localeCompare(b.title);
      case "z_a":
      case "z-a":
        return b.title.localeCompare(a.title);
      case "most_visited":
        return (b.click_count || 0) - (a.click_count || 0);
      case "oldest_first":
      case "created_asc":
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case "recently_added":
      case "created_desc":
      default:
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });
}

// Render dashboard
export function renderDashboard(): void {
  updateFilterButtonVisibility();

  const container =
    dom.bookmarksContainer || document.getElementById("bookmarks-container");
  const emptyState = dom.emptyState || document.getElementById("empty-state");
  const bulkBar = dom.bulkBar || document.getElementById("bulk-bar");

  if (!container) return;

  // Hide view toggle in dashboard
  document.querySelector(".view-toggle")?.classList.add("hidden");
  bulkBar?.classList.add("hidden");

  container.className = "dashboard-freeform";
  container.innerHTML = ""; // Clear existing content
  if (emptyState) emptyState.classList.add("hidden");

  // Initialize dashboard views UI
  initDashboardViews();
  const btn = document.getElementById("dashboard-views-btn");
  if (btn) btn.classList.remove("hidden");

  const dashboardHtml = `
        <div class="dashboard-freeform-container" id="dashboard-drop-zone">
            <div class="dashboard-help-text">
                ${
                  state.dashboardWidgets.length === 0
                    ? "<p>Drag folders or tags from the sidebar to create widgets</p>"
                    : ""
                }
            </div>
            <div class="dashboard-widgets-container" id="dashboard-widgets-freeform">
                ${renderFreeformWidgets()}
            </div>
        </div>
    `;

  container.innerHTML = dashboardHtml;
  container.innerHTML = dashboardHtml;
  initDashboardDragDrop();
  initTagAnalyticsWidgets();
  setupWidgetLazyLoading();
}

// Setup widget lazy loading
function setupWidgetLazyLoading(): void {
  const sentinels = document.querySelectorAll(".widget-load-more");
  if (sentinels.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sentinel = entry.target as HTMLElement;
          loadMoreWidgetItems(sentinel);
        }
      });
    },
    { rootMargin: "100px" },
  );

  sentinels.forEach((s) => observer.observe(s));
}

// Load more items for a widget
function loadMoreWidgetItems(sentinel: HTMLElement): void {
  const index = parseInt(sentinel.dataset.widgetIndex || "-1");
  const widget = state.dashboardWidgets[index];
  if (!widget) return;

  // Prevent multiple loads
  if (sentinel.dataset.loading === "true") return;
  sentinel.dataset.loading = "true";

  const widgetData = getWidgetData(widget);
  if (!widgetData) return;

  const bookmarks = sortBookmarks(widgetData.bookmarks, widget.sort);
  const container = sentinel.parentElement;
  if (!container) return;

  // Count current items to determine offset
  const currentCount = container.querySelectorAll(".compact-item").length;
  const batchSize = 20;

  const nextBatch = bookmarks.slice(currentCount, currentCount + batchSize);

  if (nextBatch.length > 0) {
    const html = nextBatch.map((b: any) => renderCompactBookmarkItem(b)).join("");
    sentinel.insertAdjacentHTML("beforebegin", html);
  }

  // Update sentinel or remove if done
  if (currentCount + nextBatch.length >= bookmarks.length) {
    sentinel.remove();
  } else {
    sentinel.dataset.loading = "false";
  }
}


// Initialize Tag Analytics widgets
export async function initTagAnalyticsWidgets(): Promise<void> {
  try {
    const widgets = document.querySelectorAll(
      '.dashboard-widget-freeform[data-widget-type="tag-analytics"] .tag-analytics',
    );
    if (!widgets || widgets.length === 0) return;

    const res = await api("/tags/analytics");

    // Handle various response formats
    let tags: any[] = [];
    let cooccurrence: any[] = [];

    if (res && typeof res === "object") {
      if (res.success && Array.isArray(res.tags)) {
        tags = res.tags;
        cooccurrence = res.cooccurrence || [];
      } else if (Array.isArray(res)) {
        // Response might be an array directly
        tags = res;
      }
    }

    widgets.forEach((root: any) => {
      const indexAttr = root.getAttribute("data-analytics-widget");
      const idx = parseInt(indexAttr);
      const widgetCfg = state.dashboardWidgets[idx] || {};
      const settings = (widgetCfg as any).settings || {
        metric: "count",
        limit: 20,
        pairSort: "count",
        colors: {
          usage: "#6366f1",
          clicks: "#f97316",
          favorites: "#eab308",
          pairs: "#6b7280",
        },
      };
      const metric = settings.metric || "count";
      const limit = settings.limit || 20;
      const pairSort = settings.pairSort || "count";
      const colors = settings.colors || {
        usage: "#6366f1",
        clicks: "#f97316",
        favorites: "#eab308",
        pairs: "#6b7280",
      };

      const metricSel = root.querySelector(
        ".tag-analytics-metric",
      ) as HTMLSelectElement;
      const limitSel = root.querySelector(
        ".tag-analytics-limit",
      ) as HTMLSelectElement;
      const pairSortSel = root.querySelector(
        ".tag-analytics-pairsort",
      ) as HTMLSelectElement;
      const colorUsage = root.querySelector(
        ".tag-analytics-color-usage",
      ) as HTMLInputElement;
      const colorClicks = root.querySelector(
        ".tag-analytics-color-clicks",
      ) as HTMLInputElement;
      const colorFavorites = root.querySelector(
        ".tag-analytics-color-favorites",
      ) as HTMLInputElement;
      const colorPairs = root.querySelector(
        ".tag-analytics-color-pairs",
      ) as HTMLInputElement;
      const legendUsage = root.querySelector(".legend-usage") as HTMLElement;
      const legendClicks = root.querySelector(".legend-clicks") as HTMLElement;
      const legendFavorites = root.querySelector(
        ".legend-favorites",
      ) as HTMLElement;
      const legendPairs = root.querySelector(".legend-pairs") as HTMLElement;

      if (metricSel) metricSel.value = metric;
      if (limitSel) limitSel.value = String(limit);
      if (pairSortSel) pairSortSel.value = pairSort;
      if (colorUsage) colorUsage.value = colors.usage;
      if (colorClicks) colorClicks.value = colors.clicks;
      if (colorFavorites) colorFavorites.value = colors.favorites;
      if (colorPairs) colorPairs.value = colors.pairs;
      if (legendUsage) legendUsage.style.backgroundColor = colors.usage;
      if (legendClicks) legendClicks.style.backgroundColor = colors.clicks;
      if (legendFavorites)
        legendFavorites.style.backgroundColor = colors.favorites;
      if (legendPairs) legendPairs.style.backgroundColor = colors.pairs;

      const topTagsEl = root.querySelector(".tag-analytics-top-tags");
      const coocEl = root.querySelector(".tag-analytics-cooccurrence");
      if (topTagsEl) {
        const sortedTags = [...tags].sort(
          (a: any, b: any) => (b[metric] || 0) - (a[metric] || 0),
        );
        const topTags = sortedTags.slice(0, limit);
        const metricColor =
          metric === "count"
            ? colors.usage
            : metric === "click_count_sum"
              ? colors.clicks
              : colors.favorites;
        topTagsEl.innerHTML = topTags
          .map(
            (t: any) => `
              <div class="tag-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
              <div class="tag-count" style="text-align:right;color:${metricColor}">${t[metric] || 0}</div>
            `,
          )
          .join("");
      }
      if (coocEl) {
        const sortedPairs = [...cooccurrence].sort((a: any, b: any) => {
          if (pairSort === "alpha") {
            const na = (a.tag_name_a + " + " + a.tag_name_b).toLowerCase();
            const nb = (b.tag_name_a + " + " + b.tag_name_b).toLowerCase();
            return na.localeCompare(nb);
          }
          return (b.count || 0) - (a.count || 0);
        });
        const pairs = sortedPairs.slice(0, limit);
        coocEl.innerHTML = pairs
          .map(
            (p: any) => `
              <div class="pair-name" title="${escapeHtml(p.tag_name_a)} + ${escapeHtml(p.tag_name_b)}">${escapeHtml(p.tag_name_a)} + ${escapeHtml(p.tag_name_b)}</div>
              <div class="pair-count" style="text-align:right;color:${colors.pairs}">${p.count}</div>
            `,
          )
          .join("");
      }

      // Listeners
      if (metricSel) {
        metricSel.addEventListener("change", (e: any) => {
          const val = e.target.value;
          if (!(state.dashboardWidgets[idx] as any).settings)
            (state.dashboardWidgets[idx] as any).settings = {};
          (state.dashboardWidgets[idx] as any).settings.metric = val;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }
      if (limitSel) {
        limitSel.addEventListener("change", (e: any) => {
          const val = parseInt(e.target.value);
          if (!(state.dashboardWidgets[idx] as any).settings)
            (state.dashboardWidgets[idx] as any).settings = {};
          (state.dashboardWidgets[idx] as any).settings.limit = val;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }
      if (pairSortSel) {
        pairSortSel.addEventListener("change", (e: any) => {
          const val = e.target.value;
          if (!(state.dashboardWidgets[idx] as any).settings)
            (state.dashboardWidgets[idx] as any).settings = {};
          (state.dashboardWidgets[idx] as any).settings.pairSort = val;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }

      function ensureColors() {
        if (!(state.dashboardWidgets[idx] as any).settings)
          (state.dashboardWidgets[idx] as any).settings = {};
        if (!(state.dashboardWidgets[idx] as any).settings.colors)
          (state.dashboardWidgets[idx] as any).settings.colors = {};
      }
      if (colorUsage) {
        colorUsage.addEventListener("change", (e: any) => {
          ensureColors();
          (state.dashboardWidgets[idx] as any).settings.colors.usage =
            e.target.value;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }
      if (colorClicks) {
        colorClicks.addEventListener("change", (e: any) => {
          ensureColors();
          (state.dashboardWidgets[idx] as any).settings.colors.clicks =
            e.target.value;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }
      if (colorFavorites) {
        colorFavorites.addEventListener("change", (e: any) => {
          ensureColors();
          (state.dashboardWidgets[idx] as any).settings.colors.favorites =
            e.target.value;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }
      if (colorPairs) {
        colorPairs.addEventListener("change", (e: any) => {
          ensureColors();
          (state.dashboardWidgets[idx] as any).settings.colors.pairs =
            e.target.value;
          import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
            saveSettings({ dashboard_widgets: state.dashboardWidgets }),
          );
          initTagAnalyticsWidgets();
        });
      }

      // Export helpers
      function downloadFile(name: string, mime: string, text: string) {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      function toCSV(rows: any[], columns: string[]) {
        const header = columns.join(",");
        const body = rows
          .map((r) =>
            columns
              .map((c) => {
                const v = r[c] != null ? String(r[c]) : "";
                const escaped = v.replace(/"/g, '""');
                return `"${escaped}"`;
              })
              .join(","),
          )
          .join("\n");
        return `${header}\n${body}`;
      }

      const btnJson = root.querySelector(".tag-analytics-export-json");
      const btnTagsCsv = root.querySelector(".tag-analytics-export-tags-csv");
      const btnPairsCsv = root.querySelector(".tag-analytics-export-pairs-csv");
      if (btnJson) {
        btnJson.addEventListener("click", () => {
          const payload = JSON.stringify({ tags, cooccurrence }, null, 2);
          downloadFile("tag-analytics.json", "application/json", payload);
        });
      }
      if (btnTagsCsv) {
        btnTagsCsv.addEventListener("click", () => {
          const csv = toCSV(tags, ["name", "count"]);
          downloadFile("tag-analytics-tags.csv", "text/csv", csv);
        });
      }
      if (btnPairsCsv) {
        btnPairsCsv.addEventListener("click", () => {
          const csv = toCSV(cooccurrence, [
            "tag_name_a",
            "tag_name_b",
            "count",
          ]);
          downloadFile("tag-analytics-pairs.csv", "text/csv", csv);
        });
      }
    });
  } catch (err) {
    console.error("Failed to load tag analytics", err);
  }
}

// Render freeform widgets
function renderFreeformWidgets(): string {
  let html = "";

  state.dashboardWidgets.forEach((widget: any, index) => {
    const widgetData = getWidgetData(widget);
    if (!widgetData) return;

    const { name, color, bookmarks: widgetBookmarks, count } = widgetData;
    const sortedBookmarks = sortBookmarks(widgetBookmarks, widget.sort);
    const widgetColor = widget.color || color;

    html += `
        <div class="dashboard-widget-freeform" 
             data-widget-index="${index}"
             data-widget-id="${widget.id}"
             data-widget-type="${widget.type}"
             draggable="true"
             style="left: ${widget.x || 0}px; top: ${widget.y || 0}px; width: ${widget.w || 320}px; height: ${widget.h || 400}px;">
            <div class="widget-header" data-color="${widgetColor}">
                <div class="widget-drag-handle" title="Drag to move">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                </div>
                ${
                  widget.type === "folder"
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>`
                }
                <div class="widget-title">${escapeHtml(name)}</div>
                <div class="widget-count">${count}</div>
                <div class="widget-actions">
                    <div class="widget-options-container">
                        <button class="btn-icon widget-options-btn" data-action="toggle-widget-options" data-index="${index}" title="Options">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                            </svg>
                        </button>
                        <div class="widget-options-menu hidden" data-widget-index="${index}">
                            ${
                              widget.type !== "tag-analytics"
                                ? `
                            <button class="widget-option" data-action="widget-sort-az" data-widget-index="${index}" data-widget-type="${widget.type}" data-widget-id="${widget.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
                                Sort A-Z
                            </button>
                            <button class="widget-option" data-action="widget-sort-za" data-widget-index="${index}" data-widget-type="${widget.type}" data-widget-id="${widget.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h6M3 12h12M3 18h18"/></svg>
                                Sort Z-A
                            </button>
                            <div class="widget-option-divider"></div>
                            <button class="widget-option" data-action="widget-add-bookmark" data-widget-type="${widget.type}" data-widget-id="${widget.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Add Bookmark
                            </button>
                            <button class="widget-option" data-action="widget-open-all" data-widget-index="${index}" data-widget-type="${widget.type}" data-widget-id="${widget.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                Open All
                            </button>
                            <button class="widget-option" data-action="widget-show-in-view" data-widget-type="${widget.type}" data-widget-id="${widget.id}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Show in Bookmarks
                            </button>
                            <div class="widget-option-divider"></div>
                            `
                                : ""
                            }
                            <button class="widget-option" data-action="change-widget-color" data-index="${index}">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20"/></svg>
                                Change Color
                            </button>
                        </div>
                    </div>
                    <button class="btn-icon widget-remove" data-action="remove-widget" data-index="${index}" title="Remove widget">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="widget-body">
              ${
                widget.type === "tag-analytics"
                  ? `
                <div class="tag-analytics" data-analytics-widget="${index}">
                   <!-- Tag analytics content -->
                   <div class="tag-analytics-controls" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Metric</span>
                       <select class="tag-analytics-metric">
                         <option value="count">Usage</option>
                         <option value="click_count_sum">Clicks</option>
                         <option value="favorites_count">Favorites</option>
                       </select>
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Top N</span>
                       <select class="tag-analytics-limit">
                         <option value="10">10</option>
                         <option value="20" selected>20</option>
                         <option value="30">30</option>
                         <option value="50">50</option>
                       </select>
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Pairs Sort</span>
                       <select class="tag-analytics-pairsort">
                         <option value="count" selected>Count</option>
                         <option value="alpha">A→Z</option>
                       </select>
                     </label>
                     <div class="tag-analytics-exports" style="margin-left:auto;display:flex;gap:0.25rem;">
                       <button class="btn btn-sm tag-analytics-export-json" title="Export JSON">JSON</button>
                       <button class="btn btn-sm tag-analytics-export-tags-csv" title="Export Tags CSV">Tags CSV</button>
                       <button class="btn btn-sm tag-analytics-export-pairs-csv" title="Export Pairs CSV">Pairs CSV</button>
                     </div>
                   </div>
                   <!-- ... rest of analytics ... -->
                   <div class="tag-analytics-colors" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;">
                     <!-- Colors inputs placeholders, populated by initTagAnalyticsWidgets -->
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Usage</span>
                       <input type="color" class="tag-analytics-color-usage" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Clicks</span>
                       <input type="color" class="tag-analytics-color-clicks" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Favorites</span>
                       <input type="color" class="tag-analytics-color-favorites" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                     <label style="display:flex;align-items:center;gap:0.25rem;">
                       <span style="font-size:0.75rem;color:var(--text-tertiary)">Pairs</span>
                       <input type="color" class="tag-analytics-color-pairs" style="width:24px;height:20px;border:none;cursor:pointer;" />
                     </label>
                   </div>
                   <div class="tag-analytics-legend" style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.5rem;">
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-usage" style="display:inline-block;width:10px;height:10px;background:#6366f1;border-radius:2px"></span>Usage</span>
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-clicks" style="display:inline-block;width:10px;height:10px;background:#f97316;border-radius:2px"></span>Clicks</span>
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-favorites" style="display:inline-block;width:10px;height:10px;background:#eab308;border-radius:2px"></span>Favorites</span>
                     <span class="legend-item" style="display:flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--text-tertiary)"><span class="legend-color legend-pairs" style="display:inline-block;width:10px;height:10px;background:#6b7280;border-radius:2px"></span>Pairs</span>
                   </div>
                   <div class="tag-analytics-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                     <div class="tag-analytics-col">
                       <div class="tag-analytics-col-title" style="font-weight:600;margin-bottom:0.25rem;">Top Tags</div>
                       <div class="tag-analytics-list tag-analytics-top-tags" style="display:grid;grid-template-columns:1fr auto;gap:0.25rem"></div>
                     </div>
                     <div class="tag-analytics-col">
                       <div class="tag-analytics-col-title" style="font-weight:600;margin-bottom:0.25rem;">Top Co-occurrence</div>
                       <div class="tag-analytics-list tag-analytics-cooccurrence" style="display:grid;grid-template-columns:1fr auto;gap:0.25rem"></div>
                     </div>
                   </div>
                </div>
                `
                  : `
                <div class="compact-list">
                    ${sortedBookmarks
                      .slice(0, 20)
                      .map((b) => renderCompactBookmarkItem(b))
                      .join("")}
                    ${
                      sortedBookmarks.length > 20
                        ? `
                    <div class="widget-load-more" data-widget-index="${index}" style="padding:0.5rem;text-align:center;color:var(--text-tertiary);">
                        <div class="loading-spinner small"></div>
                    </div>`
                        : ""
                    }
                </div>
                `
              }
            </div>
            <div class="widget-resize-handle" title="Drag to resize"></div>
        </div>
        `;
  });

  return html;
}

// Get widget data
function getWidgetData(widget: any): any {
  if (widget.type === "folder") {
    const folder = state.folders.find((f) => f.id === widget.id);
    if (!folder) return null;

    let folderBookmarks;
    if (state.includeChildBookmarks) {
      const getAllIds = (fid: string): string[] => {
        const ids = [fid];
        state.folders
          .filter((f) => f.parent_id === fid)
          .forEach((c) => ids.push(...getAllIds(c.id)));
        return ids;
      };
      const allIds = getAllIds(folder.id);
      folderBookmarks = state.bookmarks.filter(
        (b) => b.folder_id && allIds.includes(b.folder_id),
      );
    } else {
      folderBookmarks = state.bookmarks.filter(
        (b) => b.folder_id === folder.id,
      );
    }

    return {
      name: folder.name,
      color: folder.color || "#6366f1",
      bookmarks: folderBookmarks,
      count: folderBookmarks.length,
    };
  } else if (widget.type === "tag") {
    const tagBookmarks = state.bookmarks.filter(
      (b) =>
        b.tags &&
        b.tags
          .split(",")
          .map((t) => t.trim())
          .includes(widget.id),
    );
    return {
      name: widget.id,
      color: "#10b981",
      bookmarks: tagBookmarks,
      count: tagBookmarks.length,
    };
  } else if (widget.type === "tag-analytics") {
    return {
      name: "Tag Analytics",
      color: "#6b7280",
      bookmarks: [],
      count: "",
    };
  }
  return null;
}

// Initialize dashboard drag and drop
export function initDashboardDragDrop(): void {
  const dropZone = document.getElementById("dashboard-drop-zone");
  if (!dropZone) return;

  // Handle drops from sidebar
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e: any) => {
    if (e.target === dropZone) {
      dropZone.classList.remove("drag-over");
    }
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");

    const rect = dropZone.getBoundingClientRect();
    const x = e.clientX - rect.left + dropZone.scrollLeft;
    const y = e.clientY - rect.top + dropZone.scrollTop;

    if (state.draggedSidebarItem) {
      const { type, id } = state.draggedSidebarItem;
      addDashboardWidget(type as any, id, x, y);
      state.setDraggedSidebarItem(null);
    }
  });

  // Setup widget drag and resize
  document
    .querySelectorAll(".dashboard-widget-freeform")
    .forEach((widget: any) => {
      const header = widget.querySelector(".widget-header");
      const resizeHandle = widget.querySelector(".widget-resize-handle");

      // Drag to move
      header?.addEventListener("mousedown", (e: any) => {
        if (
          e.target.closest(".widget-remove") ||
          e.target.closest(".widget-color-btn")
        )
          return;

        state.setIsDraggingWidget(true);
        state.setDraggedWidget(widget);
        state.setDragStartPos({ x: e.clientX, y: e.clientY });
        state.setWidgetStartPos({
          x: parseInt(widget.style.left) || 0,
          y: parseInt(widget.style.top) || 0,
        });
        widget.classList.add("dragging");
        e.preventDefault();
      });

      // Resize handle
      resizeHandle?.addEventListener("mousedown", (e: any) => {
        state.setIsResizing(true);
        state.setResizingWidget(widget);
        state.setDragStartPos({ x: e.clientX, y: e.clientY });
        state.setResizeStartSize({
          w: parseInt(widget.style.width) || 320,
          h: parseInt(widget.style.height) || 400,
        });
        widget.classList.add("resizing");
        e.preventDefault();
        e.stopPropagation();
      });
    });

  // Global mouse handlers
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // Setup remove widget buttons
  document
    .querySelectorAll('[data-action="remove-widget"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", (e: any) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        removeDashboardWidget(index);
      });
    });

  // Setup color change buttons
  document
    .querySelectorAll('[data-action="change-widget-color"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", (e: any) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);

        // Close options menu first
        document
          .querySelectorAll(".widget-options-menu")
          .forEach((m) => m.classList.add("hidden"));

        // Find the options button for positioning (use the button that opened the menu)
        const optionsBtn = document.querySelector(
          `.widget-options-container [data-action="toggle-widget-options"][data-index="${index}"]`,
        );
        showWidgetColorPicker(index, (optionsBtn as HTMLElement) || btn);
      });
    });

  // Setup widget options toggle
  document
    .querySelectorAll('[data-action="toggle-widget-options"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", (e: any) => {
        e.stopPropagation();
        const index = btn.dataset.index;
        const menu = document.querySelector(
          `.widget-options-menu[data-widget-index="${index}"]`,
        );

        // Close all other menus first
        document.querySelectorAll(".widget-options-menu").forEach((m) => {
          if (m !== menu) m.classList.add("hidden");
        });

        menu?.classList.toggle("hidden");
      });
    });

  // Close widget options menu when clicking outside
  // Use a named function so we can remove it first to avoid duplicates
  const closeWidgetMenus = (e: Event) => {
    const target = e.target as HTMLElement;
    // Don't close if clicking inside a menu, on the toggle button, or on any form element
    if (
      target.closest(".widget-options-menu") ||
      target.closest('[data-action="toggle-widget-options"]') ||
      target.closest("select") ||
      target.closest("input") ||
      target.closest(".tag-analytics")
    ) {
      return;
    }
    document.querySelectorAll(".widget-options-menu").forEach((m) => {
      m.classList.add("hidden");
    });
  };

  // Only add listener once (use data attribute to track)
  const container = document.getElementById("dashboard-widgets-freeform");
  if (container && !(container as any)._menuListenerAdded) {
    document.addEventListener("click", closeWidgetMenus);
    (container as any)._menuListenerAdded = true;
  }

  // Widget sort A-Z
  document
    .querySelectorAll('[data-action="widget-sort-az"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", (e: any) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.widgetIndex);
        if (state.dashboardWidgets[index]) {
          state.dashboardWidgets[index].sort = "a-z";
          saveDashboardWidgets();
          renderDashboard();
        }
      });
    });

  // Widget sort Z-A
  document
    .querySelectorAll('[data-action="widget-sort-za"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", (e: any) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.widgetIndex);
        if (state.dashboardWidgets[index]) {
          state.dashboardWidgets[index].sort = "z-a";
          saveDashboardWidgets();
          renderDashboard();
        }
      });
    });

  // Widget add bookmark
  document
    .querySelectorAll('[data-action="widget-add-bookmark"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", async (e: any) => {
        e.stopPropagation();
        const widgetType = btn.dataset.widgetType;
        const widgetId = btn.dataset.widgetId;

        // Close menu
        document
          .querySelectorAll(".widget-options-menu")
          .forEach((m) => m.classList.add("hidden"));

        // Open bookmark modal and pre-fill folder or tag
        const { openModal, resetForms } = await import("@utils/ui-helpers.ts");
        resetForms();

        if (widgetType === "folder") {
          const folderSelect = document.getElementById(
            "bookmark-folder",
          ) as HTMLSelectElement;
          if (folderSelect) folderSelect.value = widgetId;
        } else if (widgetType === "tag") {
          const tagsInput = document.getElementById(
            "bookmark-tags",
          ) as HTMLInputElement;
          if (tagsInput) tagsInput.value = widgetId;
          // Also try to load into the tag input UI
          try {
            const { loadTagsFromInput } =
              await import("@features/bookmarks/tag-input.ts");
            loadTagsFromInput(widgetId);
          } catch (err) {
            // Tag input module might not be available
          }
        }

        openModal("bookmark-modal");
      });
    });

  // Widget open all bookmarks
  document
    .querySelectorAll('[data-action="widget-open-all"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", async (e: any) => {
        e.stopPropagation();

        // Find widget by ID and Type for robustness
        const widgetType = btn.dataset.widgetType;
        const widgetId = btn.dataset.widgetId;
        const widget = state.dashboardWidgets.find(
          (w) => w.type === widgetType && w.id === widgetId,
        );

        if (!widget) {
          showToast("Widget not found", "error");
          console.error("Widget not found for open-all", {
            widgetType,
            widgetId,
          });
          return;
        }

        const widgetData = getWidgetData(widget);
        if (!widgetData) {
          showToast("Could not retrieve bookmarks", "error");
          return;
        }

        // Close menu immediately
        document
          .querySelectorAll(".widget-options-menu")
          .forEach((m) => m.classList.add("hidden"));

        const { bookmarks } = widgetData;

        if (!bookmarks || bookmarks.length === 0) {
          showToast("No bookmarks to open", "info");
          return;
        }

        // Confirm for large batches
        if (bookmarks.length > 5) {
          if (!confirm(`Open ${bookmarks.length} bookmarks in new tabs?`)) {
            return;
          }
        }

        // Open each bookmark
        let successCount = 0;
        const failedBookmarks: any[] = [];

        bookmarks.forEach((b: any) => {
          if (b && b.url) {
            const win = window.open(b.url, "_blank");
            if (win) {
              successCount++;
            } else {
              failedBookmarks.push(b);
            }
          }
        });

        if (successCount === bookmarks.length) {
          showToast(
            `Opened ${successCount} tab${successCount > 1 ? "s" : ""}`,
            "success",
          );
        } else {
          // Some failing - clear menu and show fallback UI
          showBlockedLinksUI(failedBookmarks, successCount);
        }
      });
    });

  // Helper to show UI for blocked links
  function showBlockedLinksUI(bookmarks: any[], successCount: number) {
    // Check if modal already exists
    let modal = document.getElementById("blocked-links-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "blocked-links-modal";
      modal.className = "modal-overlay";
      modal.style.zIndex = "9999";
      document.body.appendChild(modal);

      // Close on click outside
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal?.classList.add("hidden");
      });
    }

    if (!modal) return; // Should not happen

    const plural = bookmarks.length > 1;

    modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${successCount > 0 ? "Some Tabs Blocked" : "Popups Blocked"}</h3>
        <button class="btn-icon" onclick="document.getElementById('blocked-links-modal').classList.add('hidden')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 1rem; color: var(--text-secondary);">
          Your browser blocked ${bookmarks.length} link${plural ? "s" : ""} from opening automatically. 
          Use the links below to open them manually:
        </p>
        <div class="blocked-links-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          ${bookmarks
            .map(
              (b) => `
            <a href="${b.url}" target="_blank" class="blocked-link-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--border-color); text-decoration: none; color: var(--text-primary); transition: background 0.2s;">
              ${
                b.favicon
                  ? `<img src="${b.favicon}" style="width:16px;height:16px;border-radius:2px" onerror="this.style.display='none'">`
                  : `<span style="width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg-tertiary);border-radius:2px;font-size:10px">🔗</span>`
              }
              <div style="flex:1;min-width:0">
                <div style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.title || b.url}</div>
                <div style="font-size:0.75rem;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.url}</div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--primary-500)"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          `,
            )
            .join("")}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="document.getElementById('blocked-links-modal').classList.add('hidden')">Done</button>
      </div>
    </div>
  `;

    // Add hover effect style dynamically if not present
    if (!document.getElementById("blocked-links-style")) {
      const style = document.createElement("style");
      style.id = "blocked-links-style";
      style.textContent = `
      .blocked-link-item:hover { background: var(--bg-tertiary) !important; }
      .blocked-link-item:last-child { border-bottom: none !important; }
    `;
      document.head.appendChild(style);
    }

    modal.classList.remove("hidden");
  }

  // Widget show in bookmarks view
  document
    .querySelectorAll('[data-action="widget-show-in-view"]')
    .forEach((btn: any) => {
      btn.addEventListener("click", async (e: any) => {
        e.stopPropagation();
        const widgetType = btn.dataset.widgetType;
        const widgetId = btn.dataset.widgetId;

        // Close menu
        document
          .querySelectorAll(".widget-options-menu")
          .forEach((m) => m.classList.add("hidden"));

        if (widgetType === "folder") {
          // Navigate to folder view
          const { loadBookmarks } =
            await import("@features/bookmarks/bookmarks.ts");
          state.setCurrentView("folder");
          state.setCurrentFolder(widgetId);
          await loadBookmarks();
        } else if (widgetType === "tag") {
          // Navigate to bookmarks view with tag filter
          const { loadBookmarks, renderBookmarks } =
            await import("@features/bookmarks/bookmarks.ts");
          const { updateActiveNav } = await import("@utils/ui-helpers.ts");
          state.setCurrentView("all");
          state.filterConfig.tags = [widgetId];
          state.filterConfig.tagMode = "OR";
          await loadBookmarks();
          renderBookmarks();
          updateActiveNav();
        }
      });
    });
}

// Handle mouse move for drag/resize
function handleMouseMove(e: MouseEvent): void {
  if (state.isDraggingWidget && state.draggedWidget) {
    const deltaX = e.clientX - state.dragStartPos.x;
    const deltaY = e.clientY - state.dragStartPos.y;

    const newX = state.widgetStartPos.x + deltaX;
    const newY = state.widgetStartPos.y + deltaY;

    // Apply snap-to-grid
    (state.draggedWidget as HTMLElement).style.left = `${snapToGrid(newX)}px`;
    (state.draggedWidget as HTMLElement).style.top = `${snapToGrid(newY)}px`;
  } else if (state.isResizing && state.resizingWidget) {
    const deltaX = e.clientX - state.dragStartPos.x;
    const deltaY = e.clientY - state.dragStartPos.y;

    const newWidth = Math.max(150, state.resizeStartSize.w + deltaX);
    const newHeight = Math.max(100, state.resizeStartSize.h + deltaY);

    // Apply snap-to-grid
    (state.resizingWidget as HTMLElement).style.width =
      `${snapToGrid(newWidth)}px`;
    (state.resizingWidget as HTMLElement).style.height =
      `${snapToGrid(newHeight)}px`;
  }
}

// Handle mouse up for drag/resize
function handleMouseUp(_e: MouseEvent): void {
  if (state.isDraggingWidget && state.draggedWidget) {
    state.draggedWidget.classList.remove("dragging");

    const index = parseInt(
      (state.draggedWidget as HTMLElement).dataset.widgetIndex || "-1",
    );
    if (state.dashboardWidgets[index]) {
      state.dashboardWidgets[index].x =
        parseInt((state.draggedWidget as HTMLElement).style.left) || 0;
      state.dashboardWidgets[index].y =
        parseInt((state.draggedWidget as HTMLElement).style.top) || 0;
      saveDashboardWidgets();
    }

    state.setIsDraggingWidget(false);
    state.setDraggedWidget(null);
  } else if (state.isResizing && state.resizingWidget) {
    state.resizingWidget.classList.remove("resizing");

    const index = parseInt(
      (state.resizingWidget as HTMLElement).dataset.widgetIndex || "-1",
    );
    if (state.dashboardWidgets[index]) {
      state.dashboardWidgets[index].w =
        parseInt((state.resizingWidget as HTMLElement).style.width) || 320;
      state.dashboardWidgets[index].h =
        parseInt((state.resizingWidget as HTMLElement).style.height) || 400;
      saveDashboardWidgets();
    }

    state.setIsResizing(false);
    state.setResizingWidget(null);
  }
}

// Add dashboard widget
export function addDashboardWidget(
  type: "folder" | "tag" | "tag-analytics",
  id: string,
  x: number,
  y: number,
): void {
  const exists = state.dashboardWidgets.some(
    (w) => w.type === type && w.id === id,
  );
  if (exists) {
    showToast("Widget already exists on dashboard", "info");
    return;
  }

  const newWidget: any = {
    id: id,
    type: type,
    x: x,
    y: y,
    w: 320,
    h: 400,
  };

  if (type === "tag-analytics") {
    newWidget.settings = {
      metric: "count",
      limit: 20,
      pairSort: "count",
      colors: {
        usage: "#6366f1",
        clicks: "#f97316",
        favorites: "#eab308",
        pairs: "#6b7280",
      },
    };
  }

  state.dashboardWidgets.push(newWidget);
  saveDashboardWidgets();
  renderDashboard();
  updateCounts();
  showToast(
    `${type === "folder" ? "Folder" : "Tag"} added to dashboard`,
    "success",
  );
}

// Remove dashboard widget
export function removeDashboardWidget(index: number): void {
  state.dashboardWidgets.splice(index, 1);
  saveDashboardWidgets();
  renderDashboard();
  updateCounts();
  showToast("Widget removed", "success");
}

// Show widget color picker
function showWidgetColorPicker(index: number, button: HTMLElement): void {
  const existingPicker = document.querySelector(".widget-color-picker");
  if (existingPicker) existingPicker.remove();

  const widget = state.dashboardWidgets[index];
  if (!widget) return;

  const colors = [
    { name: "Blue", value: "#6366f1" },
    { name: "Purple", value: "#a855f7" },
    { name: "Pink", value: "#ec4899" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Yellow", value: "#eab308" },
    { name: "Green", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Indigo", value: "#4f46e5" },
    { name: "Gray", value: "#6b7280" },
    { name: "Slate", value: "#475569" },
  ];

  const picker = document.createElement("div");
  picker.className = "widget-color-picker";
  picker.innerHTML = `
        <div class="color-picker-grid">
            ${colors
              .map(
                (c) => `
                <button class="color-picker-option" 
                        data-color="${c.value}" 
                        title="${c.name}"
                        style="background: ${c.value}">
                    ${(widget as any).color === c.value ? '<span class="color-check">✓</span>' : ""}
                </button>
            `,
              )
              .join("")}
        </div>
    `;

  const rect = button.getBoundingClientRect();
  picker.style.position = "fixed";
  picker.style.top = `${rect.bottom + 8}px`;
  // Right-align the picker to the button
  picker.style.right = `${window.innerWidth - rect.right}px`;

  document.body.appendChild(picker);

  picker.querySelectorAll(".color-picker-option").forEach((opt: any) => {
    opt.addEventListener("click", (e: any) => {
      e.stopPropagation();
      const color = opt.dataset.color;
      updateWidgetColor(index, color);
      picker.remove();
    });
  });

  setTimeout(() => {
    document.addEventListener("click", function closePickerHandler(e) {
      if (!picker.contains(e.target as Node)) {
        picker.remove();
        document.removeEventListener("click", closePickerHandler);
      }
    });
  }, 100);
}

// Update widget color
function updateWidgetColor(index: number, color: string): void {
  if (state.dashboardWidgets[index]) {
    (state.dashboardWidgets[index] as any).color = color;
    saveDashboardWidgets();
    renderDashboard();
    showToast("Widget color updated", "success");
  }
}

// Save dashboard widgets
function saveDashboardWidgets(): void {
  import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
    saveSettings({ dashboard_widgets: state.dashboardWidgets }),
  );
}

// Filter dashboard bookmarks
export function filterDashboardBookmarks(term: string): void {
  const widgets = document.querySelectorAll(".dashboard-widget");
  const lowerTerm = term.toLowerCase();

  widgets.forEach((widget: any) => {
    const items = widget.querySelectorAll(".compact-item");
    let hasVisible = false;

    items.forEach((item: any) => {
      const text =
        item.querySelector(".compact-text")?.textContent.toLowerCase() || "";
      const matches = text.includes(lowerTerm);
      item.style.display = matches || !term ? "" : "none";
      if (matches || !term) hasVisible = true;
    });

    widget.style.opacity = hasVisible || !term ? "1" : "0.5";
  });
}

// Toggle layout settings dropdown
export function toggleLayoutSettings(): void {
  const existing = document.getElementById("layout-settings-dropdown");
  if (existing) {
    closeLayoutSettings();
  } else {
    showLayoutSettings();
  }
}

// Show layout settings dropdown
export function showLayoutSettings(): void {
  // Remove existing
  document.getElementById("layout-settings-dropdown")?.remove();

  const dropdown = document.createElement("div");
  dropdown.id = "layout-settings-dropdown";
  dropdown.className = "filter-dropdown"; // Reuse filter dropdown styles

  dropdown.innerHTML = `
    <div class="filter-dropdown-header">
      <span class="filter-dropdown-title">Dashboard Layout</span>
      <div class="filter-dropdown-actions">
        <button class="btn-icon" id="layout-close-btn" title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="filter-dropdown-body">
      <div class="filter-row">
        <div class="filter-column">
          <h4>Layout Actions</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="btn btn-outline btn-full" id="auto-position-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:0.5rem">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              Auto Position Widgets
            </button>
            <button class="btn btn-outline btn-full ${state.snapToGrid ? "active" : ""}" id="snap-to-grid-toggle-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:0.5rem">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                <line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2,2"/><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2,2"/>
              </svg>
              Snap to Grid ${state.snapToGrid ? "(ON)" : "(OFF)"}
            </button>
            <button class="btn btn-outline btn-full" id="clear-dashboard-btn" style="color: var(--danger-600); border-color: var(--danger-600);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:0.5rem">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear All Widgets
            </button>
          </div>
        </div>
        <div class="filter-column">
          <h4>Info</h4>
          <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6;">
            <strong>Auto Position:</strong> Automatically arranges all widgets in a grid layout.<br><br>
            <strong>Snap to Grid:</strong> When enabled, widgets snap to a 20px grid when dragging or resizing.<br><br>
            <strong>Clear All:</strong> Removes all widgets from the dashboard. This action cannot be undone.
          </p>
          <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.5rem;">Statistics</div>
            <div style="font-size: 0.875rem;"><strong>${state.dashboardWidgets.length}</strong> widget${state.dashboardWidgets.length !== 1 ? "s" : ""} on dashboard</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const dashboardHeader = document.getElementById("dashboard-header");

  if (dashboardHeader && dashboardHeader.style.display !== "none") {
    dashboardHeader.style.position = "relative";
    dashboardHeader.insertAdjacentElement("afterend", dropdown);
  } else {
    document.body.appendChild(dropdown);
  }

  attachLayoutSettingsListeners();

  setTimeout(() => {
    document.addEventListener("click", handleLayoutSettingsClickOutside);
  }, 0);
}

export function closeLayoutSettings(): void {
  const dropdown = document.getElementById("layout-settings-dropdown");
  if (dropdown) {
    dropdown.remove();
    document.removeEventListener("click", handleLayoutSettingsClickOutside);
  }
}

function handleLayoutSettingsClickOutside(e: MouseEvent): void {
  const dropdown = document.getElementById("layout-settings-dropdown");
  const btn = document.getElementById("dashboard-layout-btn");

  if (
    dropdown &&
    !dropdown.contains(e.target as Node) &&
    e.target !== btn &&
    !btn?.contains(e.target as Node)
  ) {
    closeLayoutSettings();
  }
}

function attachLayoutSettingsListeners(): void {
  const closeBtn = document.getElementById("layout-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLayoutSettings();
    });
  }

  const autoPositionBtn = document.getElementById("auto-position-btn");
  if (autoPositionBtn) {
    autoPositionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      autoPositionWidgets();
    });
  }

  const snapToggleBtn = document.getElementById("snap-to-grid-toggle-btn");
  if (snapToggleBtn) {
    snapToggleBtn.addEventListener("click", async (e: any) => {
      e.stopPropagation();
      state.setSnapToGrid(!state.snapToGrid);
      await import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
        saveSettings({ snap_to_grid: state.snapToGrid }),
      );
      showToast(
        `Snap to grid ${state.snapToGrid ? "enabled" : "disabled"}`,
        "success",
      );
      closeLayoutSettings();
      showLayoutSettings();
    });
  }

  const clearBtn = document.getElementById("clear-dashboard-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmClearDashboard();
    });
  }
}

export function autoPositionWidgets(): void {
  if (state.dashboardWidgets.length === 0) {
    showToast("No widgets to position", "info");
    return;
  }

  const WIDGET_WIDTH = 320;
  const WIDGET_HEIGHT = 400;
  const GAP = 20;
  const COLUMNS = 3;

  state.dashboardWidgets.forEach((widget: any, index) => {
    const row = Math.floor(index / COLUMNS);
    const col = index % COLUMNS;

    widget.x = col * (WIDGET_WIDTH + GAP);
    widget.y = row * (WIDGET_HEIGHT + GAP);
    widget.w = WIDGET_WIDTH;
    widget.h = WIDGET_HEIGHT;
  });

  saveDashboardWidgets();
  renderDashboard();
  showToast(
    `${state.dashboardWidgets.length} widget${state.dashboardWidgets.length !== 1 ? "s" : ""} positioned`,
    "success",
  );
  closeLayoutSettings();
}

function confirmClearDashboard(): void {
  const count = state.dashboardWidgets.length;

  if (count === 0) {
    showToast("Dashboard is already empty", "info");
    return;
  }

  if (
    confirm(
      `Are you sure you want to remove all ${count} widget${count !== 1 ? "s" : ""} from the dashboard? This cannot be undone.`,
    )
  ) {
    clearDashboard();
  }
}

export function clearDashboard(): void {
  const count = state.dashboardWidgets.length;

  state.setDashboardWidgets([]);

  saveDashboardWidgets();
  renderDashboard();
  updateCounts();

  showToast(
    `Cleared ${count} widget${count !== 1 ? "s" : ""} from dashboard`,
    "success",
  );
  closeLayoutSettings();
}

(window as any).saveCurrentView = saveCurrentView;
(window as any).deleteView = deleteView;
(window as any).restoreView = restoreView;

export default {
  renderDashboard,
  initDashboardDragDrop,
  addDashboardWidget,
  removeDashboardWidget,
  filterDashboardBookmarks,
  toggleLayoutSettings,
  autoPositionWidgets,
  clearDashboard,
};
