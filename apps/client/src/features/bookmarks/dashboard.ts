/**
 * AnchorMarks - Dashboard Module
 * Handles dashboard rendering and widget management with optimized performance
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import type { Bookmark, DashboardWidget } from "@types";
import type { DashboardViewResponse } from "../../types/api";
import { showToast } from "@utils/ui-helpers.ts";
import { confirmDialog, promptDialog } from "@features/ui/confirm-dialog.ts";
import { escapeHtml } from "@utils/index.ts";

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
export function renderDashboard(): void {
  if (state.currentView !== "dashboard") return;

  const outlet = document.getElementById("main-view-outlet");
  if (!outlet) return;

  /*
   * New layout markup: the CSS introduced during the recent refactor
   * relies on a couple of wrappers in order to apply the free‑form
   * positioning rules (position:relative on the container) and to
   * show the helpful empty‑state text.  Previously we were simply
   * swapping the `className` on the outlet and shoving absolute
   * widgets directly into it, which meant none of the new styles
   * took effect and widgets floated outside of the visible area.  The
   * result was what the user described as a "broken" dashboard.
   */

  // switch the outer container class to the new freeform view
  outlet.className = "dashboard-freeform";

  const widgets = state.dashboardWidgets || [];

  if (widgets.length === 0) {
    outlet.innerHTML = `
      <div class="dashboard-freeform-container" id="dashboard-drop-zone">
        <div class="dashboard-help-text">
          No widgets. Click &quot;Add Widget&quot; to get started.
        </div>
      </div>
    `;
    initDashboardDragDrop();
    return;
  }

  const widgetsHtml = widgets
    .map((widget: DashboardWidget, index: number) =>
      renderDashboardWidget(widget, index),
    )
    .join("");

  outlet.innerHTML = `
    <div class="dashboard-freeform-container" id="dashboard-drop-zone">
      <div class="dashboard-widgets-container">
        ${widgetsHtml}
      </div>
    </div>
  `;

  initDashboardDragDrop();
  attachWidgetEventListeners();
  void ensureWidgetsData();
}

/**
 * Render a single dashboard widget
 */
function renderDashboardWidget(widget: DashboardWidget, index: number): string {
  // freeform widgets use a different base class so the CSS selectors for
  // dragging/resizing/etc. apply correctly.  We kept the old
  // `dashboard-widget` name around for grid-oriented layouts (still
  // present in the stylesheet) but in this branch the only layout we
  // actually render is freeform.
  const widgetData = getWidgetDisplayData(widget);

  const width = getWidgetWidth(widget);
  const height = getWidgetHeight(widget);

  return `
    <div class="dashboard-widget-freeform" 
         data-widget-index="${index}" 
         data-widget-id="${escapeHtml(widget.id)}"
         data-widget-type="${escapeHtml(widget.type)}"
         style="position:absolute;left:${widget.x || 0}px;top:${widget.y || 0}px;width:${width}px;height:${height}px">
      <div class="widget-header">
        <div class="widget-drag-handle" title="Drag to move">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>
        <h3>${escapeHtml(widgetData.title)}</h3>
        <span class="widget-count">${widgetData.count}</span>
        <button class="btn-icon small remove-widget-btn" data-widget-index="${index}" aria-label="Remove widget">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="widget-body">
        ${renderWidgetContent(widget, widgetData)}
      </div>
    </div>
  `;
}

/**
 * Get display data for a widget
 */
function getWidgetDisplayData(widget: DashboardWidget): {
  title: string;
  count: number;
  bookmarks: Bookmark[];
} {
  const linkedId = getWidgetLinkedId(widget);
  const cachedBookmarks = getWidgetBookmarks(widget);

  if (widget.type === "folder" && linkedId) {
    const folder = state.folders.find((f) => f.id === linkedId);
    if (folder) {
      return {
        title: folder.name,
        count: folder.bookmark_count || cachedBookmarks.length,
        bookmarks: cachedBookmarks,
      };
    }
  } else if (widget.type === "tag" && linkedId) {
    return {
      title: linkedId,
      count: cachedBookmarks.length,
      bookmarks: cachedBookmarks,
    };
  }

  // Fallback for unknown or misconfigured widgets
  return {
    title: widget.title || "Widget",
    count: 0,
    bookmarks: [],
  };
}

/**
 * Render widget content based on type
 */
function renderWidgetContent(
  widget: DashboardWidget,
  widgetData: { title: string; count: number; bookmarks: Bookmark[] },
): string {
  if (widget.type === "tag-analytics") {
    return '<div style="padding:1rem;text-align:center;color:var(--text-secondary)">Tag analytics coming soon</div>';
  }

  if (widgetData.bookmarks.length === 0) {
    return '<div style="padding:1rem;text-align:center;color:var(--text-secondary)">No bookmarks</div>';
  }

  const sortedBookmarks = sortWidgetBookmarks(
    widgetData.bookmarks,
    widget.sort,
  );

  return `
    <div class="compact-list">
      ${sortedBookmarks
        .map(
          (b) => `
        <div class="compact-item" data-bookmark-id="${escapeHtml(b.id)}">
          <a class="compact-item-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(b.title || b.url)}">
            <span class="compact-favicon">
              ${b.favicon ? `<img src="${escapeHtml(b.favicon)}" alt="" />` : '<span class="favicon-placeholder">🔗</span>'}
            </span>
            <span class="compact-text">
              ${escapeHtml(b.title || b.url)}
            </span>
          </a>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

/**
 * Sort bookmarks for widget display
 */
function sortWidgetBookmarks(
  bookmarks: Bookmark[],
  sort?: "a-z" | "z-a" | "recent" | "most_visited",
): Bookmark[] {
  const sorted = [...bookmarks];

  switch (sort) {
    case "a-z":
      sorted.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url));
      break;
    case "z-a":
      sorted.sort((a, b) => (b.title || b.url).localeCompare(a.title || a.url));
      break;
    case "most_visited":
      sorted.sort((a, b) => (b.click_count || 0) - (a.click_count || 0));
      break;
    case "recent":
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
      break;
  }

  return sorted;
}

/**
 * Initialize tag analytics widgets
 */
export async function initTagAnalyticsWidgets(): Promise<void> {
  // tag analytics widgets may require async data loading in the future.
  // for now this is a no-op stub so callers can safely await it.
  return;
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

  // remove any existing listeners by cloning the node (simpler than
  // tracking them individually). this avoids duplicate handlers when
  // renderDashboard is called repeatedly.
  const newOutlet = outlet.cloneNode(true) as HTMLElement;
  outlet.parentNode?.replaceChild(newOutlet, outlet);

  const dropZone = newOutlet.querySelector(
    "#dashboard-drop-zone",
  ) as HTMLElement | null;
  if (dropZone) {
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

      if (dragged.type === "folder" || dragged.type === "tag") {
        addDashboardWidget(dragged.type, dragged.id, x, y);
      }

      state.setDraggedSidebarItem(null);
    });
  }

  newOutlet
    .querySelectorAll<HTMLElement>(".dashboard-widget-freeform .widget-header")
    .forEach((header) => {
      header.addEventListener("mousedown", (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest(".remove-widget-btn")) return;

        const widgetEl = (e.currentTarget as HTMLElement).closest(
          ".dashboard-widget-freeform",
        ) as HTMLElement;
        if (!widgetEl) return;

        const index = Number(widgetEl.dataset.widgetIndex);
        if (isNaN(index)) return;

        state.setDraggedWidget(widgetEl);
        const startX = e.clientX;
        const startY = e.clientY;
        const origLeft = parseInt(widgetEl.style.left || "0", 10);
        const origTop = parseInt(widgetEl.style.top || "0", 10);

        function onMouseMove(moveEv: MouseEvent) {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;
          const newX = snapToGrid(origLeft + dx);
          const newY = snapToGrid(origTop + dy);
          widgetEl.style.left = newX + "px";
          widgetEl.style.top = newY + "px";
          const widgetState = state.dashboardWidgets[index];
          if (widgetState) {
            widgetState.x = newX;
            widgetState.y = newY;
          }
        }

        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          state.setDraggedWidget(null);
          markDashboardModified();
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
      });
    });
}

/**
 * Attach event listeners to widget buttons
 */
function attachWidgetEventListeners(): void {
  // Remove widget buttons
  document
    .querySelectorAll<HTMLElement>(".remove-widget-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.widgetIndex || "", 10);
        if (!isNaN(index)) {
          removeDashboardWidget(index);
        }
      });
    });
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
  const panel = document.getElementById("layout-settings-panel");
  if (panel) {
    panel.classList.toggle("hidden");
  }
}

/**
 * Show layout settings panel
 */
export function showLayoutSettings(): void {
  const panel = document.getElementById("layout-settings-panel");
  if (panel) {
    panel.classList.remove("hidden");
  }
}

/**
 * Close layout settings panel
 */
export function closeLayoutSettings(): void {
  const panel = document.getElementById("layout-settings-panel");
  if (panel) {
    panel.classList.add("hidden");
  }
}

/**
 * Update layout statistics display
 */
export function updateLayoutStats(): void {
  const statsEl = document.getElementById("layout-stats");
  if (!statsEl) return;

  const widgets = state.dashboardWidgets;
  const count = widgets.length;
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
