import { escapeHtml } from "@utils/index.ts";

interface TagOptions {
  color?: string;
  className?: string;
  data?: Record<string, string | number | boolean>;
  clickable?: boolean;
}

/**
 * Component for rendering tags.
 * @param {string} name - Tag name.
 * @param {object} options - Optional parameters:
 * @param {string} options.color - Background color.
 * @param {string} options.className - Additional CSS classes.
 * @param {object} options.data - Data attributes.
 * @param {boolean} options.clickable - Whether the tag should look clickable.
 * @returns {string} - HTML string of the tag.
 */
export function Tag(name: string, options: TagOptions = {}): string {
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

interface TagChipOptions {
  id?: string;
  className?: string;
  active?: boolean;
}

/**
 * Component for rendering tag chips (like in the filter bar).
 * @param {string} name - Tag name.
 * @param {object} options - Optional parameters.
 * @returns {string} - HTML string of the tag chip.
 */
export function TagChip(name: string, options: TagChipOptions = {}): string {
  const { id = "", className = "", active = false } = options;
  const idAttr = id ? `id="${id}"` : "";

  return `
    <div ${idAttr} class="filter-chip tag-chip ${active ? "active" : ""} ${className}" data-tag="${escapeHtml(name)}">
      <span>${escapeHtml(name)}</span>
      <button type="button" class="remove-filter" aria-label="Remove tag filter">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  `;
}
