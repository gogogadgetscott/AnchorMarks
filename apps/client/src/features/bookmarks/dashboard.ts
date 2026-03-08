/**
 * AnchorMarks - Dashboard Module
 * Handles dashboard rendering and widget management with optimized performance
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import type {
  Bookmark,
  DashboardWidget,
  TagAnalyticsItem,
  CooccurrenceItem,
} from "@types";
import type { DashboardViewResponse } from "../../types/api";
import { showToast, openModal, resetForms } from "@utils/ui-helpers.ts";
import { confirmDialog, promptDialog } from "@features/ui/confirm-dialog.ts";
import { escapeHtml } from "@utils/index.ts";
import {
  renderReactDashboard,
  unmountReactDashboard,
} from "@features/bookmarks/react-dashboard.tsx";

// Constants
const GRID_SIZE = 20;
const VIEWS_DROPDOWN_WIDTH = 240;
const VIEWS_DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_OFFSET = 8;
const UNSAVED_INDICATOR_ID = "dashboard-unsaved-indicator";
const VIEW_NAME_BADGE_ID = "dashboard-view-name";
const VIEWS_BTN_ID = "views-btn";
const VIEWS_DROPDOWN_ID = "views-dropdown";

type DashboardWidgetLegacy = DashboardWidget & {
  width?: number;
  height?: number;
  linkedId?: string;
};

// Performance optimizations
let closeDashboardDropdownListener: ((e: MouseEvent) => void) | null = null;
let dashboardStateSnapshot: string = "";
const widgetsLoading = new Set<string>();

/**
 * Snap value to grid
 */
function snapToGrid(value: number): number {
  if (!state.snapToGrid) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function getWidgetWidth(widget: DashboardWidget): number {
  const legacyWidget = widget as DashboardWidgetLegacy;
  return widget.w ?? legacyWidget.width ?? 320;
}

function getWidgetHeight(widget: DashboardWidget): number {
  const legacyWidget = widget as DashboardWidgetLegacy;
  return widget.h ?? legacyWidget.height ?? 400;
}

function getWidgetLinkedId(widget: DashboardWidget): string | undefined {
  const legacyWidget = widget as DashboardWidgetLegacy;
  const explicitLinkedId =
    (widget.config?.linkedId as string | undefined) ?? legacyWidget.linkedId;

  if (explicitLinkedId) return explicitLinkedId;

  if (widget.type === "folder" || widget.type === "tag") {
    return widget.id;
  }

  return undefined;
}

function getWidgetCacheKey(widget: DashboardWidget): string {
  const linkedId = getWidgetLinkedId(widget) || widget.id;
  return `${widget.type}:${linkedId}`;
}

function getWidgetBookmarks(widget: DashboardWidget): Bookmark[] {
  const cacheKey = getWidgetCacheKey(widget);
  const cached = state.widgetDataCache[cacheKey];
  if (Array.isArray(cached)) return cached;
  return [];
}

/**
 * Get current dashboard state as JSON string for comparison
 */
function getDashboardStateSnapshot(): string {
  return JSON.stringify({
    widgets: state.dashboardWidgets,
    mode: state.dashboardConfig.mode,
    tags: state.dashboardConfig.tags,
    sort: state.dashboardConfig.bookmarkSort,
  });
}

/**
 * Save current dashboard state for comparison
 */
export function saveDashboardStateSnapshot(): void {
  dashboardStateSnapshot = getDashboardStateSnapshot();
  state.setSavedDashboardState(dashboardStateSnapshot);
  state.setDashboardHasUnsavedChanges(false);
  updateUnsavedIndicator();
}

/**
 * Check if dashboard has unsaved changes
 */
export function checkDashboardChanges(): boolean {
  if (!dashboardStateSnapshot) {
    dashboardStateSnapshot = getDashboardStateSnapshot();
    return false;
  }

  const hasChanges = getDashboardStateSnapshot() !== dashboardStateSnapshot;
  state.setDashboardHasUnsavedChanges(hasChanges);
  updateUnsavedIndicator();
  return hasChanges;
}

/**
 * Mark dashboard as modified
 */
export function markDashboardModified(): void {
  state.setDashboardHasUnsavedChanges(true);
  updateUnsavedIndicator();
}

/**
 * Update the unsaved changes indicator in the header
 */
function updateUnsavedIndicator(): void {
  const indicator = document.getElementById(UNSAVED_INDICATOR_ID);
  if (!indicator) return;

  if (state.dashboardHasUnsavedChanges) {
    indicator.classList.remove("hidden");
    indicator.setAttribute("aria-label", "Dashboard has unsaved changes");
  } else {
    indicator.classList.add("hidden");
    indicator.removeAttribute("aria-label");
  }
}

/**
 * Update the view name badge in the header
 */
export function updateViewNameBadge(viewName: string | null): void {
  const badge = document.getElementById(VIEW_NAME_BADGE_ID);
  if (!badge) return;

  if (viewName) {
    badge.textContent = escapeHtml(viewName);
    badge.classList.remove("hidden");
  } else {
    badge.textContent = "";
    badge.classList.add("hidden");
  }
}

/**
 * Confirm before switching views if there are unsaved changes
 */
export async function confirmViewSwitch(): Promise<boolean> {
  if (!state.dashboardHasUnsavedChanges) return true;

  const confirmed = await confirmDialog(
    "You have unsaved changes. Switch views anyway?",
    {
      title: "Unsaved Changes",
      destructive: false,
    },
  );
  return confirmed;
}

/**
 * Initialize dashboard views UI
 */
export async function initDashboardViews(): Promise<void> {
  const headerActions = document.querySelector(".header-right");
  if (!headerActions) return;

  let btn = document.getElementById(VIEWS_BTN_ID) as HTMLButtonElement | null;

  // Create Views button if it doesn't exist
  if (!btn) {
    btn = document.createElement("button");
    btn.id = VIEWS_BTN_ID;
    btn.className = "btn btn-secondary";
    btn.setAttribute("aria-label", "Dashboard Views");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
      Views
    `;

    // Insert after Add Widget button
    const addWidgetBtn = document.getElementById("dashboard-add-widget-btn");
    if (addWidgetBtn?.nextSibling) {
      addWidgetBtn.parentNode?.insertBefore(btn, addWidgetBtn.nextSibling);
    } else {
      headerActions.appendChild(btn);
    }
  }

  // Attach click handler (idempotent across header re-renders)
  btn.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    showViewsMenu();
  };

  // Initial load
  await loadViews();
}

/**
 * Show views dropdown menu
 */
async function showViewsMenu(): Promise<void> {
  // Clean up existing dropdown
  closeViewsDropdown(new MouseEvent("click"));

  const views = await loadViews();
  const viewsBtn = document.getElementById(VIEWS_BTN_ID);
  if (!viewsBtn) return;

  const dropdown = document.createElement("div");
  dropdown.id = VIEWS_DROPDOWN_ID;
  dropdown.className = "dropdown-menu";
  dropdown.setAttribute("role", "menu");

  // Position dropdown
  const rect = viewsBtn.getBoundingClientRect();
  const dropdownWidth = VIEWS_DROPDOWN_WIDTH;
  const left = Math.max(10, rect.left + rect.width / 2 - dropdownWidth / 2);

  dropdown.style.cssText = `
    position: fixed;
    top: ${rect.bottom + DROPDOWN_OFFSET}px;
    left: ${left}px;
    z-index: 1000;
    min-width: ${dropdownWidth}px;
  `;

  // Build header
  const headerHtml = `
    <div style="font-weight:600;padding:0.5rem;border-bottom:1px solid var(--border-color);margin-bottom:0.5rem">
      Dashboard Views
    </div>
  `;

  // Build views list
  let viewsHtml = `
    <div class="views-list" style="max-height:${VIEWS_DROPDOWN_MAX_HEIGHT}px;overflow-y:auto">
  `;

  if (views.length === 0) {
    viewsHtml += `
      <div style="padding:0.5rem;color:var(--text-tertiary);text-align:center">
        No saved views
      </div>
    `;
  } else {
    viewsHtml += views
      .map((view: DashboardViewResponse) => renderViewItem(view))
      .join("");
  }

  viewsHtml += "</div>";

  // Build footer
  const footerHtml = `
    <div style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:0.5rem">
      <button class="btn btn-primary btn-sm btn-full" id="save-view-btn" aria-label="Save current view">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save Current View
      </button>
    </div>
  `;

  dropdown.innerHTML = headerHtml + viewsHtml + footerHtml;
  document.body.appendChild(dropdown);

  // Attach event listeners
  attachViewItemListeners(dropdown);
  attachSaveButtonListener(dropdown);

  // Attach global close listener
  closeDashboardDropdownListener = closeViewsDropdown.bind(null);
  if (closeDashboardDropdownListener) {
    document.addEventListener("click", closeDashboardDropdownListener);
  }
}

/**
 * Render a single view item
 */
function renderViewItem(view: DashboardViewResponse): string {
  return `
    <div class="dropdown-item view-item" data-view-id="${escapeHtml(view.id)}" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;cursor:pointer;border-radius:4px" role="menuitem">
      <span class="view-name" style="flex:1">${escapeHtml(view.name)}</span>
      <button class="btn-icon small text-danger delete-view-btn" data-view-id="${escapeHtml(view.id)}" title="Delete view" aria-label="Delete ${escapeHtml(view.name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
}

/**
 * Attach listeners to view items
 */
function attachViewItemListeners(dropdown: HTMLElement): void {
  dropdown.querySelectorAll(".view-item").forEach((item: Element) => {
    const viewElement = item as HTMLElement;
    const viewId = viewElement.dataset.viewId;
    if (!viewId) return;

    const nameSpan = item.querySelector(".view-name");
    const deleteBtn = item.querySelector(".delete-view-btn");

    // Restore view on name click
    if (nameSpan) {
      nameSpan.addEventListener(
        "click",
        handleRestoreViewClick(viewId, nameSpan.textContent),
      );
    }

    // Delete view on button click
    if (deleteBtn) {
      deleteBtn.addEventListener("click", handleDeleteViewClick(viewId));
    }
  });
}

/**
 * Handle restore view click
 */
function handleRestoreViewClick(
  viewId: string,
  viewName: string | null,
): (e: Event) => Promise<void> {
  return async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    await restoreView(viewId, viewName);
  };
}

/**
 * Handle delete view click
 */
function handleDeleteViewClick(viewId: string): (e: Event) => Promise<void> {
  return async (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteView(viewId);
  };
}

/**
 * Attach listener to save button
 */
function attachSaveButtonListener(dropdown: HTMLElement): void {
  const saveBtn = dropdown.querySelector("#save-view-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      await saveCurrentView();
    });
  }
}

/**
 * Close views dropdown menu
 */
function closeViewsDropdown(e?: MouseEvent): void {
  const dropdown = document.getElementById(VIEWS_DROPDOWN_ID);
  if (!dropdown) return;

  // Allow closing programmatically (e is undefined)
  if (e) {
    const isClickInside =
      dropdown.contains(e.target as Node) ||
      (e.target as HTMLElement).id === VIEWS_BTN_ID;
    if (isClickInside) return;
  }

  dropdown.remove();

  if (closeDashboardDropdownListener) {
    document.removeEventListener("click", closeDashboardDropdownListener);
    closeDashboardDropdownListener = null;
  }
}

/**
 * Save current dashboard view
 */
export async function saveCurrentView(): Promise<void> {
  const name = await promptDialog("Enter a name for this view:", {
    title: "Save View",
    confirmText: "Save",
    placeholder: "e.g., Work Dashboard",
  });

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

    await api("/dashboard/views", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });

    showToast(`View "${escapeHtml(name)}" saved!`, "success");
    closeViewsDropdown();
    await loadViews();
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

/**
 * Load all dashboard views for current user
 */
async function loadViews(): Promise<DashboardViewResponse[]> {
  try {
    const response = await api<DashboardViewResponse[]>("/dashboard/views");
    return Array.isArray(response) ? response : [];
  } catch (err: unknown) {
    console.error("Failed to load views:", err);
    return [];
  }
}

/**
 * Delete a dashboard view
 */
export async function deleteView(id: string): Promise<void> {
  const confirmed = await confirmDialog("Delete this view?", {
    title: "Delete View",
    destructive: true,
  });

  if (!confirmed) return;

  try {
    await api(`/dashboard/views/${id}`, { method: "DELETE" });
    showToast("View deleted", "success");
    closeViewsDropdown();
    await loadViews();
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

/**
 * Restore a previously saved dashboard view
 */
export async function restoreView(
  id: string,
  viewName: string | null = null,
): Promise<void> {
  if (!(await confirmViewSwitch())) return;

  try {
    await api<DashboardViewResponse>(`/dashboard/views/${id}/restore`, {
      method: "POST",
    });

    const { loadSettings, saveSettings } =
      await import("@features/bookmarks/settings.ts");
    await loadSettings();

    if (state.currentView !== "dashboard") {
      await state.setCurrentView("dashboard");
    }

    await saveSettings({
      current_view: "dashboard",
      current_dashboard_view_id: id,
      current_dashboard_view_name: viewName,
    });

    // Update state
    state.setCurrentDashboardViewId(id);
    state.setCurrentDashboardViewName(viewName);
    updateViewNameBadge(viewName);

    // Reload dashboard using restored settings
    closeViewsDropdown();
    renderDashboard();
    saveDashboardStateSnapshot();

    showToast(`View "${escapeHtml(viewName || "")}" restored`, "success");
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

/**
 * Toggle fullscreen mode
 */
export function toggleFullscreen(): void {
  const isFullscreen = document.body.classList.toggle("fullscreen-mode");
  state.setIsFullscreen(isFullscreen);

  const enterIcon = document.querySelector(
    "#dashboard-fullscreen-btn .fullscreen-enter-icon",
  );
  const exitIcon = document.querySelector(
    "#dashboard-fullscreen-btn .fullscreen-exit-icon",
  );

  if (enterIcon && exitIcon) {
    enterIcon.classList.toggle("hidden", isFullscreen);
    exitIcon.classList.toggle("hidden", !isFullscreen);
  }

  document.body.setAttribute("aria-fullscreen", isFullscreen.toString());
}

/**
 * Render dashboard with all widgets
 */
export async function renderDashboard(): Promise<void> {
  if (state.currentView !== "dashboard") {
    unmountReactDashboard();
    return;
  }

  const outlet = document.getElementById("main-view-outlet");
  if (!outlet) return;
  outlet.className = "dashboard-freeform";

  const widgets = state.dashboardWidgets || [];

  const previewBookmarksByWidgetId: Record<string, Bookmark[]> = {};
  const metricsByWidgetId: Record<string, Record<string, number>> = {};
  const linkedWidgetIdByWidgetId: Record<string, string> = {};

  widgets.forEach((widget) => {
    const bookmarks = getWidgetBookmarks(widget);
    previewBookmarksByWidgetId[widget.id] = bookmarks;
    linkedWidgetIdByWidgetId[widget.id] =
      getWidgetLinkedId(widget) || widget.id;

    if (widget.type !== "tag-analytics") {
      metricsByWidgetId[widget.id] = {
        Bookmarks: bookmarks.length,
      };
    }
  });

  // Fetch tag analytics data if any tag-analytics widgets exist
  let tagAnalyticsData:
    | { tags: TagAnalyticsItem[]; cooccurrence: CooccurrenceItem[] }
    | undefined;
  if (widgets.some((w) => w.type === "tag-analytics")) {
    try {
      const res = await api<{
        success?: boolean;
        tags?: TagAnalyticsItem[];
        cooccurrence?: CooccurrenceItem[];
      }>("/tags/analytics");
      tagAnalyticsData = {
        tags: Array.isArray(res?.tags) ? res.tags : [],
        cooccurrence: Array.isArray(res?.cooccurrence) ? res.cooccurrence : [],
      };
    } catch (err) {
      console.error("Failed to load tag analytics", err);
      tagAnalyticsData = { tags: [], cooccurrence: [] };
    }
  }

  const handleTagAnalyticsSettingsChange = (
    widgetIndex: number,
    settings: {
      metric?: string;
      limit?: number;
      pairSort?: string;
      colors?: {
        usage?: string;
        clicks?: string;
        favorites?: string;
        pairs?: string;
      };
    },
  ) => {
    if (state.dashboardWidgets[widgetIndex]) {
      state.dashboardWidgets[widgetIndex].settings = settings;
      import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
        saveSettings({ dashboard_widgets: state.dashboardWidgets }),
      );
      markDashboardModified();
    }
  };

  try {
    const handleReactRemoveWidget = (widgetId: string) => {
      const index = state.dashboardWidgets.findIndex((w) => w.id === widgetId);
      if (index >= 0) {
        removeDashboardWidget(index);
      }
    };

    renderReactDashboard({
      outlet,
      widgets,
      previewBookmarksByWidgetId,
      metricsByWidgetId,
      linkedWidgetIdByWidgetId,
      tagAnalyticsData,
      onRemoveWidget: handleReactRemoveWidget,
      onMoveWidget: (widgetId, x, y) => updateWidgetPosition(widgetId, x, y),
      onResizeWidget: (widgetId, width, height) =>
        updateWidgetSize(widgetId, width, height),
      onSortWidget: (widgetIndex, sort) => updateWidgetSort(widgetIndex, sort),
      onAddBookmarkToWidget: (widgetType, widgetId) => {
        void handleWidgetAddBookmark(widgetType, widgetId);
      },
      onOpenAllWidgetBookmarks: (widgetIndex) =>
        openAllWidgetBookmarks(widgetIndex),
      onShowWidgetInBookmarksView: (widgetType, widgetId) => {
        void showWidgetInBookmarksView(widgetType, widgetId);
      },
      onChangeWidgetColor: (widgetIndex, color) => {
        updateWidgetColor(widgetIndex, color);
      },
      onTagAnalyticsSettingsChange: handleTagAnalyticsSettingsChange,
    });

    initDashboardDragDrop();
    void initTagAnalyticsWidgets();
    void ensureWidgetsData();
  } catch (err) {
    console.error("React dashboard render failed", err);
    unmountReactDashboard();
  }
}

/**
 * Initialize tag analytics widgets
 */
export async function initTagAnalyticsWidgets(): Promise<void> {
  try {
    const widgets = document.querySelectorAll(
      '.dashboard-widget-freeform[data-widget-type="tag-analytics"] .tag-analytics',
    );
    if (!widgets || widgets.length === 0) return;

    const res = await api<{
      success?: boolean;
      tags?: TagAnalyticsItem[];
      cooccurrence?: CooccurrenceItem[];
    }>("/tags/analytics");

    const tags = Array.isArray(res?.tags) ? res.tags : [];
    const cooccurrence = Array.isArray(res?.cooccurrence)
      ? res.cooccurrence
      : [];

    widgets.forEach((root) => {
      const idx = parseInt(
        root.getAttribute("data-analytics-widget") || "-1",
        10,
      );
      if (
        Number.isNaN(idx) ||
        idx < 0 ||
        idx >= state.dashboardWidgets.length
      ) {
        return;
      }

      const widget = state.dashboardWidgets[idx];
      const settings = widget.settings || {
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
      ) as HTMLSelectElement | null;
      const limitSel = root.querySelector(
        ".tag-analytics-limit",
      ) as HTMLSelectElement | null;
      const pairSortSel = root.querySelector(
        ".tag-analytics-pairsort",
      ) as HTMLSelectElement | null;
      const colorUsage = root.querySelector(
        ".tag-analytics-color-usage",
      ) as HTMLInputElement | null;
      const colorClicks = root.querySelector(
        ".tag-analytics-color-clicks",
      ) as HTMLInputElement | null;
      const colorFavorites = root.querySelector(
        ".tag-analytics-color-favorites",
      ) as HTMLInputElement | null;
      const colorPairs = root.querySelector(
        ".tag-analytics-color-pairs",
      ) as HTMLInputElement | null;
      const legendUsage = root.querySelector(
        ".legend-usage",
      ) as HTMLElement | null;
      const legendClicks = root.querySelector(
        ".legend-clicks",
      ) as HTMLElement | null;
      const legendFavorites = root.querySelector(
        ".legend-favorites",
      ) as HTMLElement | null;
      const legendPairs = root.querySelector(
        ".legend-pairs",
      ) as HTMLElement | null;

      if (metricSel) metricSel.value = metric;
      if (limitSel) limitSel.value = String(limit);
      if (pairSortSel) pairSortSel.value = pairSort;
      if (colorUsage) colorUsage.value = colors.usage || "#6366f1";
      if (colorClicks) colorClicks.value = colors.clicks || "#f97316";
      if (colorFavorites) colorFavorites.value = colors.favorites || "#eab308";
      if (colorPairs) colorPairs.value = colors.pairs || "#6b7280";
      if (legendUsage)
        legendUsage.style.backgroundColor = colors.usage || "#6366f1";
      if (legendClicks)
        legendClicks.style.backgroundColor = colors.clicks || "#f97316";
      if (legendFavorites) {
        legendFavorites.style.backgroundColor = colors.favorites || "#eab308";
      }
      if (legendPairs)
        legendPairs.style.backgroundColor = colors.pairs || "#6b7280";

      const topTagsEl = root.querySelector(".tag-analytics-top-tags");
      const coocEl = root.querySelector(".tag-analytics-cooccurrence");
      if (topTagsEl) {
        const sortedTags = [...tags].sort((a, b) => {
          const left = Number(a[metric as keyof TagAnalyticsItem] || 0);
          const right = Number(b[metric as keyof TagAnalyticsItem] || 0);
          return right - left;
        });
        const topTags = sortedTags.slice(0, limit);
        const metricColor =
          metric === "count"
            ? colors.usage || "#6366f1"
            : metric === "click_count_sum"
              ? colors.clicks || "#f97316"
              : colors.favorites || "#eab308";

        topTagsEl.innerHTML = topTags
          .map(
            (t) => `
              <div class="tag-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
              <div class="tag-count" style="text-align:right;color:${metricColor}">${Number(t[metric as keyof TagAnalyticsItem] || 0)}</div>
            `,
          )
          .join("");
      }

      if (coocEl) {
        const sortedPairs = [...cooccurrence].sort((a, b) => {
          if (pairSort === "alpha") {
            const left = `${a.tag_name_a} + ${a.tag_name_b}`.toLowerCase();
            const right = `${b.tag_name_a} + ${b.tag_name_b}`.toLowerCase();
            return left.localeCompare(right);
          }
          return (b.count || 0) - (a.count || 0);
        });
        const pairs = sortedPairs.slice(0, limit);

        coocEl.innerHTML = pairs
          .map(
            (p) => `
              <div class="pair-name" title="${escapeHtml(p.tag_name_a)} + ${escapeHtml(p.tag_name_b)}">${escapeHtml(p.tag_name_a)} + ${escapeHtml(p.tag_name_b)}</div>
              <div class="pair-count" style="text-align:right;color:${colors.pairs || "#6b7280"}">${p.count}</div>
            `,
          )
          .join("");
      }

      const saveWidgetSettings = () => {
        import("@features/bookmarks/settings.ts").then(({ saveSettings }) =>
          saveSettings({ dashboard_widgets: state.dashboardWidgets }),
        );
      };

      if (metricSel) {
        metricSel.onchange = (e) => {
          const val = (e.target as HTMLSelectElement).value;
          if (!state.dashboardWidgets[idx].settings) {
            state.dashboardWidgets[idx].settings = {};
          }
          state.dashboardWidgets[idx].settings!.metric = val;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      if (limitSel) {
        limitSel.onchange = (e) => {
          const val = parseInt((e.target as HTMLSelectElement).value, 10);
          if (!state.dashboardWidgets[idx].settings) {
            state.dashboardWidgets[idx].settings = {};
          }
          state.dashboardWidgets[idx].settings!.limit = val;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      if (pairSortSel) {
        pairSortSel.onchange = (e) => {
          const val = (e.target as HTMLSelectElement).value;
          if (!state.dashboardWidgets[idx].settings) {
            state.dashboardWidgets[idx].settings = {};
          }
          state.dashboardWidgets[idx].settings!.pairSort = val;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      function ensureColors(): void {
        if (!state.dashboardWidgets[idx].settings) {
          state.dashboardWidgets[idx].settings = {};
        }
        if (!state.dashboardWidgets[idx].settings!.colors) {
          state.dashboardWidgets[idx].settings!.colors = {};
        }
      }

      if (colorUsage) {
        colorUsage.onchange = (e) => {
          ensureColors();
          state.dashboardWidgets[idx].settings!.colors!.usage = (
            e.target as HTMLInputElement
          ).value;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      if (colorClicks) {
        colorClicks.onchange = (e) => {
          ensureColors();
          state.dashboardWidgets[idx].settings!.colors!.clicks = (
            e.target as HTMLInputElement
          ).value;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      if (colorFavorites) {
        colorFavorites.onchange = (e) => {
          ensureColors();
          state.dashboardWidgets[idx].settings!.colors!.favorites = (
            e.target as HTMLInputElement
          ).value;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      if (colorPairs) {
        colorPairs.onchange = (e) => {
          ensureColors();
          state.dashboardWidgets[idx].settings!.colors!.pairs = (
            e.target as HTMLInputElement
          ).value;
          saveWidgetSettings();
          void initTagAnalyticsWidgets();
        };
      }

      const downloadFile = (name: string, mime: string, text: string) => {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      };

      const toCSV = <T extends object>(rows: T[], columns: string[]) => {
        const header = columns.join(",");
        const body = rows
          .map((r) =>
            columns
              .map((c) => {
                const value = (r as Record<string, unknown>)[c];
                const v = value != null ? String(value) : "";
                const escaped = v.replace(/"/g, '""');
                return `"${escaped}"`;
              })
              .join(","),
          )
          .join("\n");
        return `${header}\n${body}`;
      };

      const btnJson = root.querySelector(".tag-analytics-export-json");
      const btnTagsCsv = root.querySelector(".tag-analytics-export-tags-csv");
      const btnPairsCsv = root.querySelector(".tag-analytics-export-pairs-csv");

      if (btnJson) {
        (btnJson as HTMLButtonElement).onclick = () => {
          const payload = JSON.stringify({ tags, cooccurrence }, null, 2);
          downloadFile("tag-analytics.json", "application/json", payload);
        };
      }

      if (btnTagsCsv) {
        (btnTagsCsv as HTMLButtonElement).onclick = () => {
          const columns = ["name", "count"];
          if (tags.length > 0) {
            if (typeof tags[0].click_count_sum !== "undefined") {
              columns.push("click_count_sum");
            }
            if (typeof tags[0].favorite_count_sum !== "undefined") {
              columns.push("favorite_count_sum");
            }
          }
          const csv = toCSV(tags, columns);
          downloadFile("tag-analytics-tags.csv", "text/csv", csv);
        };
      }

      if (btnPairsCsv) {
        (btnPairsCsv as HTMLButtonElement).onclick = () => {
          const csv = toCSV(cooccurrence, [
            "tag_name_a",
            "tag_name_b",
            "count",
          ]);
          downloadFile("tag-analytics-pairs.csv", "text/csv", csv);
        };
      }
    });
  } catch (err) {
    console.error("Failed to load tag analytics", err);
  }
}

async function ensureWidgetsData(): Promise<void> {
  const widgetsToLoad = state.dashboardWidgets.filter((widget) => {
    if (widget.type !== "folder" && widget.type !== "tag") return false;
    const cacheKey = getWidgetCacheKey(widget);
    return !state.widgetDataCache[cacheKey] && !widgetsLoading.has(cacheKey);
  });

  if (widgetsToLoad.length === 0) return;

  widgetsToLoad.forEach((widget) => {
    widgetsLoading.add(getWidgetCacheKey(widget));
  });

  await Promise.all(
    widgetsToLoad.map(async (widget) => {
      const linkedId = getWidgetLinkedId(widget);
      const cacheKey = getWidgetCacheKey(widget);

      if (!linkedId) {
        widgetsLoading.delete(cacheKey);
        return;
      }

      let endpoint = "";
      if (widget.type === "folder") {
        endpoint = `/bookmarks?folder_id=${encodeURIComponent(linkedId)}&limit=500`;
        if (state.includeChildBookmarks) endpoint += "&include_children=true";
      } else if (widget.type === "tag") {
        endpoint = `/bookmarks?tags=${encodeURIComponent(linkedId)}&limit=500`;
      }

      try {
        const response = await api<Bookmark[] | { bookmarks?: Bookmark[] }>(
          endpoint,
        );
        const bookmarks = Array.isArray(response)
          ? response
          : Array.isArray(response?.bookmarks)
            ? response.bookmarks
            : [];
        state.setWidgetDataCache(cacheKey, bookmarks);
      } catch (err) {
        console.error("Failed to load dashboard widget data", err);
      } finally {
        widgetsLoading.delete(cacheKey);
      }
    }),
  );

  if (state.currentView === "dashboard") {
    renderDashboard();
  }
}

/**
 * Initialize dashboard drag and drop
 */
export function initDashboardDragDrop(): void {
  const outlet = document.getElementById("main-view-outlet");
  if (!outlet) return;

  const dropZone = outlet.querySelector(
    "#dashboard-drop-zone",
  ) as HTMLElement | null;
  if (dropZone) {
    if (dropZone.dataset.dragDropBound !== "true") {
      dropZone.addEventListener("dragover", (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        dropZone.classList.add("drag-over");
      });

      dropZone.addEventListener("dragleave", (e: DragEvent) => {
        if (e.target === dropZone) {
          dropZone.classList.remove("drag-over");
        }
      });

      dropZone.addEventListener("drop", (e: DragEvent) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");

        const dragged = state.draggedSidebarItem;
        if (!dragged) return;

        const rect = dropZone.getBoundingClientRect();
        const x = e.clientX - rect.left + dropZone.scrollLeft;
        const y = e.clientY - rect.top + dropZone.scrollTop;

        if (
          (dragged.type === "folder" || dragged.type === "tag") &&
          dragged.id
        ) {
          addDashboardWidget(dragged.type, dragged.id, x, y);
        }

        state.setDraggedSidebarItem(null);
      });

      dropZone.dataset.dragDropBound = "true";
    }
  }
}

/**
 * Update widget sort order
 */
function updateWidgetSort(
  index: number,
  sort: "a-z" | "z-a" | "recent" | "most_visited",
): void {
  if (index >= 0 && index < state.dashboardWidgets.length) {
    state.dashboardWidgets[index].sort = sort;
    markDashboardModified();
    renderDashboard();
    showToast(`Widget sorted ${sort.toUpperCase()}`, "success");
  }
}

/**
 * Handle adding a bookmark to a widget's folder or tag
 */
async function handleWidgetAddBookmark(
  widgetType: string,
  widgetId: string,
): Promise<void> {
  try {
    await resetForms();

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
    }

    openModal("bookmark-modal");
  } catch (err) {
    console.error("Failed to show bookmark form:", err);
    showToast("Failed to open bookmark form", "error");
  }
}

/**
 * Open all bookmarks in a widget
 */
function openAllWidgetBookmarks(index: number): void {
  if (index < 0 || index >= state.dashboardWidgets.length) return;

  const widget = state.dashboardWidgets[index];
  const bookmarks = getWidgetBookmarks(widget);

  if (bookmarks.length === 0) {
    showToast("No bookmarks to open", "info");
    return;
  }

  if (bookmarks.length > 10) {
    confirmDialog(`Open ${bookmarks.length} bookmarks in new tabs?`, {
      title: "Open All Bookmarks",
      destructive: false,
    })
      .then((confirmed) => {
        if (confirmed) {
          bookmarks.forEach((bookmark) => {
            window.open(bookmark.url, "_blank", "noopener,noreferrer");
          });
        }
      })
      .catch((err) => {
        console.error("Error in confirmDialog:", err);
      });
  } else {
    bookmarks.forEach((bookmark) => {
      window.open(bookmark.url, "_blank", "noopener,noreferrer");
    });
  }
}

/**
 * Show widget content in the bookmarks view
 */
async function showWidgetInBookmarksView(
  widgetType: string,
  widgetId: string,
): Promise<void> {
  try {
    if (widgetType === "folder") {
      state.setFilterConfig({ ...state.filterConfig, folder: widgetId });
      await state.setCurrentView("bookmarks");
    } else if (widgetType === "tag") {
      state.setFilterConfig({ ...state.filterConfig, tags: [widgetId] });
      await state.setCurrentView("bookmarks");
    }

    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
    await loadBookmarks();

    showToast("Switched to bookmarks view", "success");
  } catch (err) {
    console.error("Failed to show widget in bookmarks view:", err);
    showToast("Failed to switch view", "error");
  }
}

/**
 * Update widget color
 */
function updateWidgetColor(index: number, color: string): void {
  if (state.dashboardWidgets[index]) {
    state.dashboardWidgets[index].color = color;
    markDashboardModified();
    renderDashboard();
    showToast("Widget color updated", "success");
  }
}

/**
 * Update widget position
 */
function updateWidgetPosition(widgetId: string, x: number, y: number): void {
  const index = state.dashboardWidgets.findIndex((w) => w.id === widgetId);
  if (index >= 0 && state.dashboardWidgets[index]) {
    state.dashboardWidgets[index].x = snapToGrid(x);
    state.dashboardWidgets[index].y = snapToGrid(y);
    markDashboardModified();
    // No need to re-render since the position is already updated by React
  }
}

/**
 * Update widget size
 */
function updateWidgetSize(
  widgetId: string,
  width: number,
  height: number,
): void {
  const index = state.dashboardWidgets.findIndex((w) => w.id === widgetId);
  if (index >= 0 && state.dashboardWidgets[index]) {
    const minWidth = 200;
    const minHeight = 150;
    state.dashboardWidgets[index].w = snapToGrid(Math.max(minWidth, width));
    state.dashboardWidgets[index].h = snapToGrid(Math.max(minHeight, height));
    markDashboardModified();
    updateLayoutStats();
  }
}

/**
 * Add a new dashboard widget
 */
export function addDashboardWidget(
  type: "folder" | "tag" | "tag-analytics",
  id: string,
  x: number,
  y: number,
): void {
  // Get display name for the widget
  let title = `${type} Widget`;
  if (type === "folder") {
    const folder = state.folders.find((f) => f.id === id);
    if (folder) title = folder.name;
  } else if (type === "tag") {
    title = id;
  } else if (type === "tag-analytics") {
    title = "Tag Analytics";
  }

  const widget: DashboardWidget = {
    id: `${type}-${id}-${Date.now()}`,
    type,
    config: { linkedId: id },
    x: snapToGrid(x),
    y: snapToGrid(y),
    w: 320,
    h: 400,
    title,
  };

  state.dashboardWidgets.push(widget);
  markDashboardModified();
  renderDashboard();
}

/**
 * Remove dashboard widget
 */
export function removeDashboardWidget(index: number): void {
  if (index >= 0 && index < state.dashboardWidgets.length) {
    state.dashboardWidgets.splice(index, 1);
    markDashboardModified();
    renderDashboard();
  }
}

/**
 * Filter dashboard bookmarks by search term
 */
export function filterDashboardBookmarks(term: string): Promise<void> {
  // Currently dashboard widgets render based on state.dashboardWidgets,
  // but some widgets may probe state.bookmarks or trigger network calls
  // when filters change.  Update the global search term and invoke the
  // standard bookmark loader.  Returning the promise allows callers/tests
  // to wait for the import to finish.
  state.setFilterConfig({ ...state.filterConfig, search: term });
  return import("@features/bookmarks/bookmarks.ts").then(
    ({ loadBookmarks }) => {
      return loadBookmarks();
    },
  );
}

/**
 * Toggle layout settings panel
 */
export function toggleLayoutSettings(): void {
  const dropdown = document.getElementById("layout-settings-dropdown");
  if (dropdown) {
    closeLayoutSettings();
    return;
  }

  showLayoutSettings();
}

/**
 * Show layout settings dropdown
 */
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
            <div id="layout-stats-content" style="font-size: 0.875rem;"><strong>${state.dashboardWidgets.length}</strong> widget${state.dashboardWidgets.length !== 1 ? "s" : ""} on dashboard</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const headersContainer = document.getElementById("headers-container");
  const mainHeader = document.getElementById("main-header");

  if (headersContainer) {
    // Insert into headers container as a sibling
    if (mainHeader && mainHeader.parentElement === headersContainer) {
      mainHeader.insertAdjacentElement("afterend", dropdown);
    } else {
      headersContainer.appendChild(dropdown);
    }
  } else if (mainHeader && mainHeader.style.display !== "none") {
    // Fallback: insert after main header
    mainHeader.style.position = "relative";
    mainHeader.insertAdjacentElement("afterend", dropdown);
  } else {
    document.body.appendChild(dropdown);
  }

  attachLayoutSettingsListeners();

  setTimeout(() => {
    document.addEventListener("click", handleLayoutSettingsClickOutside);
  }, 0);
}

/**
 * Close layout settings panel
 */
export function closeLayoutSettings(): void {
  const dropdown = document.getElementById("layout-settings-dropdown");
  if (dropdown) {
    dropdown.remove();
  }
  document.removeEventListener("click", handleLayoutSettingsClickOutside);
}

function attachLayoutSettingsListeners(): void {
  document
    .getElementById("layout-close-btn")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeLayoutSettings();
    });

  document
    .getElementById("auto-position-btn")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      autoPositionWidgets();
      updateLayoutStats();
    });

  document
    .getElementById("clear-dashboard-btn")
    ?.addEventListener("click", async (e) => {
      e.stopPropagation();
      await clearDashboard();
      updateLayoutStats();
    });

  document
    .getElementById("snap-to-grid-toggle-btn")
    ?.addEventListener("click", (e) => {
      e.stopPropagation();
      state.setSnapToGrid(!state.snapToGrid);
      showLayoutSettings();
    });
}

function handleLayoutSettingsClickOutside(e: Event): void {
  const target = e.target as HTMLElement;
  if (
    !target.closest("#layout-settings-dropdown") &&
    !target.closest("#dashboard-layout-btn")
  ) {
    closeLayoutSettings();
  }
}

/**
 * Update layout statistics display
 */
export function updateLayoutStats(): void {
  const statsEl = document.getElementById("layout-stats");
  const statsContentEl = document.getElementById("layout-stats-content");

  const widgets = state.dashboardWidgets;
  const count = widgets.length;

  if (statsContentEl) {
    statsContentEl.innerHTML = `<strong>${count}</strong> widget${count === 1 ? "" : "s"} on dashboard`;
  }

  if (!statsEl) return;

  const totalArea = widgets.reduce(
    (sum, widget) => sum + getWidgetWidth(widget) * getWidgetHeight(widget),
    0,
  );

  statsEl.textContent = `${count} widget${count === 1 ? "" : "s"}`;
  if (totalArea > 0) {
    statsEl.textContent += `, total area ${totalArea}px²`;
  }
}

/**
 * Auto-position widgets on grid
 */
export function autoPositionWidgets(): void {
  let x = 0;
  let y = 0;
  const containerWidth =
    document.getElementById("main-view-outlet")?.clientWidth || 1200;

  state.dashboardWidgets.forEach((widget: DashboardWidget) => {
    widget.x = snapToGrid(x);
    widget.y = snapToGrid(y);

    x += getWidgetWidth(widget) + 20;
    if (x + getWidgetWidth(widget) > containerWidth) {
      x = 0;
      y += getWidgetHeight(widget) + 20;
    }
  });

  markDashboardModified();
  renderDashboard();
}

/**
 * Clear all dashboard widgets
 */
export async function clearDashboard(): Promise<void> {
  const confirmed = await confirmDialog(
    "Clear all dashboard widgets? This cannot be undone.",
    {
      title: "Clear Dashboard",
      destructive: true,
    },
  );

  if (!confirmed) return;

  state.setDashboardWidgets([]);
  markDashboardModified();
  renderDashboard();
  showToast("Dashboard cleared", "success");
}

// Default export
export default {
  renderDashboard,
  initDashboardDragDrop,
  addDashboardWidget,
  removeDashboardWidget,
  filterDashboardBookmarks,
  toggleLayoutSettings,
  showLayoutSettings,
  closeLayoutSettings,
  autoPositionWidgets,
  clearDashboard,
  toggleFullscreen,
  saveDashboardStateSnapshot,
  checkDashboardChanges,
  markDashboardModified,
  updateViewNameBadge,
  confirmViewSwitch,
  updateLayoutStats,
  initDashboardViews,
};
