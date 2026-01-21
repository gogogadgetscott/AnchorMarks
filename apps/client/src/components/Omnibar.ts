import { Icon } from "./Icon.ts";

interface OmnibarOptions {
  id?: string;
  placeholder?: string;
  shortcut?: string;
  showDropdown?: boolean;
}

/**
 * Component for rendering the omnibar search component.
 * @param {object} options - Optional parameters:
 *   @param {string} options.id - Input ID.
 *   @param {string} options.placeholder - Input placeholder text.
 *   @param {string} options.shortcut - Keyboard shortcut text to display.
 *   @param {boolean} options.showDropdown - Whether to include the dropdown panel.
 * @returns {string} - HTML string of the omnibar.
 */
export function Omnibar(options: OmnibarOptions = {}): string {
  const {
    id = "search-input",
    placeholder = "Search or type > for commands...",
    shortcut = "Ctrl+K",
    showDropdown = true,
  } = options;

  const dropdownHtml = showDropdown
    ? `
    <div id="omnibar-panel" class="omnibar-panel hidden">
      <!-- Recent Searches Section -->
      <div class="omnibar-section" id="omnibar-recent">
        <div class="omnibar-section-header">
          <span>Recent Searches</span>
          <button class="omnibar-clear-btn" id="omnibar-clear-recent">Clear</button>
        </div>
        <div class="omnibar-section-content" id="omnibar-recent-list"></div>
      </div>

      <!-- Suggested Tags Section -->
      <div class="omnibar-section" id="omnibar-tags">
        <div class="omnibar-section-header">
          <span>Suggested Tags</span>
        </div>
        <div class="omnibar-section-content" id="omnibar-tags-list"></div>
      </div>

      <!-- Quick Actions Section -->
      <div class="omnibar-section" id="omnibar-actions">
        <div class="omnibar-section-header">
          <span>Quick Actions</span>
        </div>
        <div class="omnibar-section-content" id="omnibar-actions-list"></div>
      </div>

      <!-- Search Results / Command Results -->
      <div class="omnibar-section hidden" id="omnibar-results">
        <div class="omnibar-section-content" id="omnibar-results-list"></div>
      </div>

      <!-- Tips Footer -->
      <div class="omnibar-tips">
        <span class="tip"><kbd>></kbd> commands</span>
        <span class="tip"><kbd>@</kbd> folders</span>
        <span class="tip"><kbd>#</kbd> tags</span>
        <span class="tip"><kbd>↑↓</kbd> navigate</span>
        <span class="tip"><kbd>Enter</kbd> select</span>
      </div>
    </div>
  `
    : "";

  return `
    <div class="omnibar-container">
      <div class="header-search-bar omnibar-input">
        ${Icon("search", { size: 18 })}
        <input
          type="text"
          id="${id}"
          placeholder="${placeholder}"
          autocomplete="off"
        />
        <kbd>${shortcut}</kbd>
      </div>
      ${dropdownHtml}
    </div>
  `;
}
