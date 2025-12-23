import { Icon } from "./Icon.ts";

export type ViewMode = "grid" | "list" | "compact";

interface ViewToggleOptions {
  activeMode?: ViewMode;
  modes?: ViewMode[];
}

/**
 * Component for rendering view mode toggle buttons.
 * @param {object} options - Optional parameters:
 *   @param {ViewMode} options.activeMode - The currently active view mode.
 *   @param {ViewMode[]} options.modes - The available view modes (default: grid, list, compact).
 * @returns {string} - HTML string of the view toggle.
 */
export function ViewToggle(options: ViewToggleOptions = {}): string {
  const { activeMode = "grid", modes = ["grid", "list", "compact"] } = options;

  const modeIcons: Record<ViewMode, { icon: string; title: string }> = {
    grid: { icon: "grid", title: "Grid View" },
    list: { icon: "list", title: "List View" },
    compact: { icon: "compact", title: "Compact List" },
  };

  const buttons = modes
    .map((mode) => {
      const { title } = modeIcons[mode];
      const isActive = mode === activeMode ? "active" : "";

      // We need to add the SVGs for these icons.
      // I'll check if Icon.ts has them, and if not, I'll add them or use custom SVG inline.
      // Based on previous view_file of Icon.ts, it doesn't have grid/list/compact yet.
      // I will add them to Icon.ts first.

      return `
        <button class="view-btn ${isActive}" data-view-mode="${mode}" title="${title}">
          ${Icon(mode, { size: 18 })}
        </button>
      `;
    })
    .join("");

  return `<div class="view-toggle">${buttons}</div>`;
}
