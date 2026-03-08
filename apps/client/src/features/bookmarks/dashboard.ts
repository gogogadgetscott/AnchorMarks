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
import { Button } from "@components/index.ts";
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

/**
 * Calculate contrasting text color (white or black) based on background color luminance
 */
function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? "#000000" : "#ffffff";
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
  void initTagAnalyticsWidgets();
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
  const widgetCount = widget.type === "tag-analytics" ? "" : widgetData.count;

  // Calculate appropriate text color for custom widget colors
  const headerStyle = widget.color
    ? `background-color:${widget.color};border-color:${widget.color};color:${getContrastTextColor(widget.color)}`
    : "";

  return `
    <div class="dashboard-widget-freeform" 
         data-widget-index="${index}" 
         data-widget-id="${escapeHtml(widget.id)}"
         data-widget-type="${escapeHtml(widget.type)}"
         style="position:absolute;left:${widget.x || 0}px;top:${widget.y || 0}px;width:${width}px;height:${height}px">
      <div class="widget-header" ${headerStyle ? `style="${headerStyle}"` : ""}>
        <div class="widget-drag-handle" title="Drag to move">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>
        <h3>${escapeHtml(widgetData.title)}</h3>
        <span class="widget-count">${widgetCount}</span>
        <div class="widget-actions">
          <div class="widget-options-container">
            <button class="btn-icon small widget-options-btn" data-action="toggle-widget-options" data-index="${index}" title="Options">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
            <div class="widget-options-menu hidden" data-widget-index="${index}">
              ${
                widget.type !== "tag-analytics"
                  ? `
              <button class="widget-option" data-action="widget-sort-az" data-widget-index="${index}" data-widget-type="${widget.type}" data-widget-id="${getWidgetLinkedId(widget) || widget.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h18M3 12h12M3 18h6"/></svg>
                Sort A-Z
              </button>
              <button class="widget-option" data-action="widget-sort-za" data-widget-index="${index}" data-widget-type="${widget.type}" data-widget-id="${getWidgetLinkedId(widget) || widget.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M3 6h6M3 12h12M3 18h18"/></svg>
                Sort Z-A
              </button>
              <div class="widget-option-divider"></div>
              <button class="widget-option" data-action="widget-add-bookmark" data-widget-type="${widget.type}" data-widget-id="${getWidgetLinkedId(widget) || widget.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Bookmark
              </button>
              <button class="widget-option" data-action="widget-open-all" data-widget-index="${index}" data-widget-type="${widget.type}" data-widget-id="${getWidgetLinkedId(widget) || widget.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                Open All
              </button>
              <button class="widget-option" data-action="widget-show-in-view" data-widget-type="${widget.type}" data-widget-id="${getWidgetLinkedId(widget) || widget.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Show in Bookmarks
              </button>
              <div class="widget-option-divider"></div>
              `
                  : ""
              }
              <button class="widget-option" data-action="change-widget-color" data-widget-index="${index}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20"/></svg>
                Change Color
              </button>
            </div>
          </div>
          <button class="btn-icon small remove-widget-btn" data-widget-index="${index}" aria-label="Remove widget">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="widget-body">
        ${renderWidgetContent(widget, widgetData, index)}
      </div>
      <div class="widget-resize-handle" title="Drag to resize"></div>
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
  } else if (widget.type === "tag-analytics") {
    return {
      title: "Tag Analytics",
      count: 0,
      bookmarks: [],
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
  index?: number,
): string {
  if (widget.type === "tag-analytics") {
    return getTagAnalyticsMarkup(index ?? 0);
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
        .map((b) => {
          const hasColorClass = b.color ? "has-custom-color" : "";
          const colorStyle = b.color
            ? `--bookmark-color: ${b.color}; background-color: color-mix(in srgb, ${b.color} 20%, var(--bg-primary)); border-left: 6px solid ${b.color};`
            : "";
          return `
        <div class="compact-item ${hasColorClass}" data-bookmark-id="${escapeHtml(b.id)}" style="${colorStyle}">
          <a class="compact-item-link" href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(b.title || b.url)}">
            <span class="compact-favicon">
              ${b.favicon ? `<img src="${escapeHtml(b.favicon)}" alt="" />` : '<span class="favicon-placeholder">🔗</span>'}
            </span>
            <span class="compact-text">
              ${escapeHtml(b.title || b.url)}
            </span>
          </a>
          <div class="compact-actions">
            ${Button("", {
              variant: "ghost",
              className: "compact-action-btn",
              icon: "edit",
              data: { action: "edit-bookmark", id: b.id },
              title: "Edit bookmark",
            })}
            ${Button("", {
              variant: b.is_favorite ? "warning" : "ghost",
              className: "compact-action-btn",
              icon: b.is_favorite ? "star-filled" : "star",
              data: { action: "toggle-favorite", id: b.id },
              title: b.is_favorite
                ? "Remove from favorites"
                : "Add to favorites",
            })}
            ${
              b.is_archived
                ? Button("", {
                    variant: "ghost",
                    className: "compact-action-btn",
                    icon: "unarchive",
                    data: { action: "unarchive-bookmark", id: b.id },
                    title: "Unarchive bookmark",
                  })
                : Button("", {
                    variant: "ghost",
                    className: "compact-action-btn",
                    icon: "archive",
                    data: { action: "archive-bookmark", id: b.id },
                    title: "Archive bookmark",
                  })
            }
            ${Button("", {
              variant: "ghost",
              className: "compact-action-btn compact-action-danger",
              icon: "trash",
              data: { action: "delete-bookmark", id: b.id },
              title: "Delete bookmark",
            })}
          </div>
        </div>
      `;
        })
        .join("")}
    </div>
  `;
}

function getTagAnalyticsMarkup(index: number): string {
  return `
    <div class="tag-analytics" data-analytics-widget="${index}">
      <div class="tag-analytics-controls" style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
        <label style="display:flex;align-items:center;gap:0.25rem;">
          <span style="font-size:0.75rem;color:var(--text-tertiary)">Metric</span>
          <select class="tag-analytics-metric">
            <option value="count">Usage</option>
            <option value="click_count_sum">Clicks</option>
            <option value="favorite_count_sum">Favorites</option>
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
            <option value="alpha">A-Z</option>
          </select>
        </label>
        <div class="tag-analytics-exports" style="margin-left:auto;display:flex;gap:0.25rem;">
          <button class="btn btn-sm tag-analytics-export-json" title="Export JSON">JSON</button>
          <button class="btn btn-sm tag-analytics-export-tags-csv" title="Export Tags CSV">Tags CSV</button>
          <button class="btn btn-sm tag-analytics-export-pairs-csv" title="Export Pairs CSV">Pairs CSV</button>
        </div>
      </div>

      <div class="tag-analytics-colors" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;flex-wrap:wrap;">
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

  // Handle widget resizing
  newOutlet
    .querySelectorAll<HTMLElement>(
      ".dashboard-widget-freeform .widget-resize-handle",
    )
    .forEach((handle) => {
      handle.addEventListener("mousedown", (e: MouseEvent) => {
        const widgetEl = (e.currentTarget as HTMLElement).closest(
          ".dashboard-widget-freeform",
        ) as HTMLElement;
        if (!widgetEl) return;

        const index = Number(widgetEl.dataset.widgetIndex);
        if (isNaN(index)) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const origWidth = widgetEl.offsetWidth;
        const origHeight = widgetEl.offsetHeight;

        function onMouseMove(moveEv: MouseEvent) {
          const dx = moveEv.clientX - startX;
          const dy = moveEv.clientY - startY;
          const newWidth = snapToGrid(Math.max(200, origWidth + dx));
          const newHeight = snapToGrid(Math.max(150, origHeight + dy));
          widgetEl.style.width = newWidth + "px";
          widgetEl.style.height = newHeight + "px";
          const widgetState = state.dashboardWidgets[index];
          if (widgetState) {
            widgetState.w = newWidth;
            widgetState.h = newHeight;
          }
        }

        function onMouseUp() {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          markDashboardModified();
        }

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        e.preventDefault();
        e.stopPropagation();
      });
    });
}

/**
 * Toggle widget options menu
 */
function toggleWidgetOptions(index: number): void {
  const menu = document.querySelector(
    `.widget-options-menu[data-widget-index="${index}"]`,
  ) as HTMLElement | null;
  if (menu) {
    menu.classList.toggle("hidden");
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
 * Show widget color picker dropdown
 */
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
                    ${widget.color === c.value ? '<span class="color-check">✓</span>' : ""}
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

  picker.querySelectorAll(".color-picker-option").forEach((opt: Element) => {
    opt.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      const color = (opt as HTMLElement).dataset.color;
      if (color) {
        updateWidgetColor(index, color);
      }
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

  // Widget options toggle buttons
  document
    .querySelectorAll<HTMLElement>(".widget-options-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index || "", 10);
        if (!isNaN(index)) {
          toggleWidgetOptions(index);
        }
      });
    });

  // Widget option buttons
  document.querySelectorAll<HTMLElement>(".widget-option").forEach((btn) => {
    btn.addEventListener("click", async (e: Event) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const index = parseInt(btn.dataset.widgetIndex || "", 10);
      const widgetType = btn.dataset.widgetType;
      const widgetId = btn.dataset.widgetId;

      switch (action) {
        case "widget-sort-az":
          if (!isNaN(index)) {
            updateWidgetSort(index, "a-z");
          }
          break;
        case "widget-sort-za":
          if (!isNaN(index)) {
            updateWidgetSort(index, "z-a");
          }
          break;
        case "widget-add-bookmark":
          if (widgetType && widgetId) {
            await handleWidgetAddBookmark(widgetType, widgetId);
          }
          break;
        case "widget-open-all":
          if (!isNaN(index)) {
            openAllWidgetBookmarks(index);
          }
          break;
        case "widget-show-in-view":
          if (widgetType && widgetId) {
            showWidgetInBookmarksView(widgetType, widgetId);
          }
          break;
        case "change-widget-color":
          if (!isNaN(index)) {
            showWidgetColorPicker(index, btn);
            // Don't close the options menu yet - color picker is open
            return;
          }
          break;
      }

      // Close the options menu after action (except for color picker)
      if (!isNaN(index)) {
        toggleWidgetOptions(index);
      }
    });
  });

  // Close options menus when clicking outside
  document.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".widget-options-container")) {
      document
        .querySelectorAll<HTMLElement>(".widget-options-menu")
        .forEach((menu) => {
          menu.classList.add("hidden");
        });
    }
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
