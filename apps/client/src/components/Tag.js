import { escapeHtml } from "@utils/index.js";

/**
 * Component for rendering tags.
 * @param {string} name - Tag name.
 * @param {object} options - Optional parameters:
 *   @param {string} options.color - Background color.
 *   @param {string} options.className - Additional CSS classes.
 *   @param {object} options.data - Data attributes.
 *   @param {boolean} options.clickable - Whether the tag should look clickable.
 * @returns {string} - HTML string of the tag.
 */
export function Tag(name, options = {}) {
    const {
        color = "#f59e0b",
        className = "",
        data = {},
        clickable = true,
    } = options;

    const dataAttrs = Object.entries(data)
        .map(([key, value]) => `data-${key}="${value}"`)
        .join(" ");

    const cursorStyle = clickable ? "cursor: pointer;" : "cursor: default;";

    return `
    <span class="tag ${className}" ${dataAttrs} style="--tag-color: ${color}; ${cursorStyle}">
      ${escapeHtml(name)}
    </span>
  `;
}

/**
 * Component for rendering tag chips (like in the filter bar).
 * @param {string} name - Tag name.
 * @param {object} options - Optional parameters.
 * @returns {string} - HTML string of the tag chip.
 */
export function TagChip(name, options = {}) {
    const { id = "", className = "", active = false } = options;

    return `
    <div class="filter-chip tag-chip ${active ? 'active' : ''} ${className}" data-tag="${escapeHtml(name)}">
      <span>${escapeHtml(name)}</span>
      <button type="button" class="remove-filter" aria-label="Remove tag filter">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `;
}
