import { Icon } from "./Icon.ts";
import { ViewToggle, ViewMode } from "./ViewToggle.ts";
import { UserProfile } from "./UserProfile.ts";
import { SelectionUI, BulkAction } from "./SelectionUI.ts";

interface HeaderOptions {
    id: string;
    title: string;
    countId?: string;
    countSuffix?: string;
    className?: string;
    rightContent?: string;
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
        countId = "",
        countSuffix = "bookmarks",
        className = "",
        rightContent = "",
        showViewToggle = true,
        viewModes = ["grid", "list", "compact"],
        showUserProfile = true,
        bulkActions = ["archive", "move", "tag", "delete"],
        selectionCountId = "header-selection-count",
        clearBtnId = "btn-clear-selection",
    } = options;

    const countHtml = countId ? `<span class="bookmark-count" id="${countId}">0 ${countSuffix}</span>` : "";
    const toggleHtml = showViewToggle ? ViewToggle({ modes: viewModes }) : "";
    const profileHtml = showUserProfile ? UserProfile() : "";

    return `
    <header class="content-header ${className}" id="${id}">
      <div class="header-normal-ui">
        <div class="header-left">
          <button class="btn-icon" id="toggle-sidebar-btn-${id.replace("-header", "")}" title="Toggle Sidebar">
            ${Icon("menu")}
          </button>
          <h1>${title}</h1>
          ${countHtml}
        </div>
        <div class="header-right">
          ${rightContent}
          ${toggleHtml}
          ${profileHtml}
        </div>
      </div>
      ${SelectionUI({ actions: bulkActions, selectionCountId, clearBtnId })}
    </header>
  `;
}
