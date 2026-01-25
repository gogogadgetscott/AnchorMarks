import { Icon } from "./Icon.ts";
import { ViewToggle, ViewMode } from "./ViewToggle.ts";
import * as state from "@features/state.ts";
import { UserProfile } from "./UserProfile.ts";
import { SelectionUI, BulkAction } from "./SelectionUI.ts";

interface HeaderOptions {
  id: string;
  title: string;
  countId?: string;
  countSuffix?: string;
  className?: string;
  rightContent?: string;
  centerContent?: string; // content to render centered in header (e.g., Omnibar)
  showFilterButton?: boolean;
  showViewToggle?: boolean;
  viewModes?: ViewMode[];
  showUserProfile?: boolean;
  bulkActions?: BulkAction[];
  selectionCountId?: string;
  clearBtnId?: string;
}

/**
 * Component for rendering a unified content header.
 * @param {object} options - Header configuration options.
 * @returns {string} - HTML string of the header.
 */
export function Header(options: HeaderOptions): string {
  const {
    id,
    title,
    className = "",
    rightContent = "",
    showViewToggle = true,
    viewModes = ["grid", "list", "compact"],
    showUserProfile = true,
    bulkActions = ["archive", "move", "tag", "delete"],
    selectionCountId = "header-selection-count",
    clearBtnId = "btn-clear-selection",
    showFilterButton = false,
  } = options;

  const toggleHtml = showViewToggle
    ? ViewToggle({ modes: viewModes, activeMode: state.viewMode })
    : "";
  const profileHtml = showUserProfile ? UserProfile() : "";
  const filterBtnHtml = showFilterButton
    ? `<button id="filter-dropdown-btn" class="btn btn-secondary" title="Filters">
            ${Icon("filter", { size: 16 })}
            <span class="filter-btn-text">Filters</span>
          </button>`
    : "";

  return `
    <header class="content-header ${className}" id="${id}">
      <div class="header-normal-ui">
        <div class="header-left">
          <button class="btn-icon" id="toggle-sidebar-btn-${id.replace("-header", "")}" title="Toggle Sidebar">
            ${Icon("menu")}
          </button>
          <h1>${title}</h1>
        </div>

        <div class="header-center">
          ${options.centerContent || ""}
        </div>

        <div class="header-right">
          ${filterBtnHtml}
          ${rightContent}
          ${toggleHtml}
          ${profileHtml}
        </div>
      </div>
      ${SelectionUI({ actions: bulkActions, selectionCountId, clearBtnId })}
    </header>
  `;
}
