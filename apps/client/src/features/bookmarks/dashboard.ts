/**
 * AnchorMarks - Dashboard Module
 * Handles dashboard rendering and widget management with optimized performance
 */

import { state } from "@features/state.ts";
import { api } from "@services/api.ts";
import type {
  Bookmark,
  DashboardWidget,
  DashboardViewResponse,
} from "@types.ts";
import {
  showToast,
  confirmDialog,
  promptDialog,
  escapeHtml,
} from "@utils/ui.ts";

// Constants
const GRID_SIZE = 20;
const VIEWS_DROPDOWN_WIDTH = 240;
const VIEWS_DROPDOWN_MAX_HEIGHT = 200;
const DROPDOWN_OFFSET = 8;
const UNSAVED_INDICATOR_ID = "dashboard-unsaved-indicator";
const VIEW_NAME_BADGE_ID = "dashboard-view-name";
const VIEWS_BTN_ID = "views-btn";
const VIEWS_DROPDOWN_ID = "views-dropdown";

// Performance optimizations
const widgetsLoading = new Set<string>();
let closeDashboardDropdownListener: ((e: MouseEvent) => void) | null = null;
let dashboardStateSnapshot: string = "";

/**
 * Snap value to grid
 */
function snapToGrid(value: number): number {
  if (!state.snapToGrid) return value;
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
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

  // Attach click handler
  btn.addEventListener("click", (e: Event) => {
    e.stopPropagation();
    showViewsMenu();
  });

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
  setTimeout(() => {
    document.addEventListener("click", closeDashboardDropdownListener);
  }, 0);
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
    const response = await api<DashboardViewResponse>(
      `/dashboard/views/${id}/restore`,
      {
        method: "POST",
      },
    );

    // Update state
    state.setCurrentDashboardViewId(id);
    state.setCurrentDashboardViewName(viewName);
    updateViewNameBadge(viewName);

    // Reload dashboard
    saveDashboardStateSnapshot();
    closeViewsDropdown();
    renderDashboard();

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
 * Render compact bookmark item
 */
function renderCompactBookmarkItem(b: Bookmark): string {
  return `
    <div class="bookmark-item compact" data-bookmark-id="${escapeHtml(b.id)}">
      <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">
        ${b.favicon ? `<img src="${escapeHtml(b.favicon)}" alt="" class="favicon" />` : ""}
        <span>${escapeHtml(b.title || b.url)}</span>
      </a>
    </div>
  `;
}

/**
 * Render dashboard with all widgets
 */
export function renderDashboard(): void {
  const container = document.getElementById("dashboard-container");
  if (!container) return;

  if (!state.dashboardWidgets || state.dashboardWidgets.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:2rem;color:var(--text-tertiary)">No widgets. Click "Add Widget" to get started.</div>';
    return;
  }

  const html = state.dashboardWidgets
    .map((widget: DashboardWidget, index: number) =>
      renderDashboardWidget(widget, index),
    )
    .join("");

  container.innerHTML = html;
  initDashboardDragDrop();
}

/**
 * Render a single dashboard widget
 */
function renderDashboardWidget(widget: DashboardWidget, index: number): string {
  return `
    <div class="dashboard-widget" data-widget-index="${index}" style="position:absolute;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px">
      <div class="widget-header">
        <h3>${escapeHtml(widget.title || "Widget")}</h3>
        <button class="btn-icon small remove-widget-btn" data-widget-index="${index}" aria-label="Remove widget">×</button>
      </div>
      <div class="widget-content">
        <!-- Widget content here -->
      </div>
    </div>
  `;
}

/**
 * Initialize tag analytics widgets
 */
export async function initTagAnalyticsWidgets(): Promise<void> {
  // Implementation here
}

/**
 * Initialize dashboard drag and drop
 */
export function initDashboardDragDrop(): void {
  // Implementation here
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
  const widget: DashboardWidget = {
    id: `${type}-${id}`,
    type,
    linkedId: id,
    x: snapToGrid(x),
    y: snapToGrid(y),
    width: 300,
    height: 400,
    title: `${type} Widget`,
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
export function filterDashboardBookmarks(term: string): void {
  // Implementation here
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
  // Implementation here
}

/**
 * Auto-position widgets on grid
 */
export function autoPositionWidgets(): void {
  let x = 0;
  let y = 0;
  const containerWidth =
    document.getElementById("dashboard-container")?.clientWidth || 1200;

  state.dashboardWidgets.forEach((widget: DashboardWidget) => {
    widget.x = snapToGrid(x);
    widget.y = snapToGrid(y);

    x += widget.width + 20;
    if (x + widget.width > containerWidth) {
      x = 0;
      y += widget.height + 20;
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

  state.dashboardWidgets = [];
  markDashboardModified();
  renderDashboard();
  showToast("Dashboard cleared", "success");
}

// Expose functions to window for external access
window.saveCurrentView = saveCurrentView;
window.deleteView = deleteView;
window.restoreView = restoreView;
window.toggleFullscreen = toggleFullscreen;

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
