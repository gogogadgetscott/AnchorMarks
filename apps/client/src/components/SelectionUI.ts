import { Icon } from "./Icon.ts";

export type BulkAction = "archive" | "unarchive" | "move" | "tag" | "delete";

interface SelectionUIOptions {
  actions?: BulkAction[];
  selectionCountId?: string;
  clearBtnId?: string;
}

/**
 * Component for rendering the bulk action selection UI.
 * @param {object} options - Optional parameters:
 *   @param {BulkAction[]} options.actions - List of bulk actions to display.
 *   @param {string} options.selectionCountId - ID for the selection count span.
 *   @param {string} options.clearBtnId - ID for the clear selection button.
 * @returns {string} - HTML string of the selection UI.
 */
export function SelectionUI(options: SelectionUIOptions = {}): string {
  const {
    actions = ["archive", "move", "tag", "delete"],
    selectionCountId = "",
    clearBtnId = "",
  } = options;

  const actionIcons: Record<
    BulkAction,
    { icon: string; title: string; className?: string }
  > = {
    archive: { icon: "archive", title: "Archive Selected" },
    unarchive: { icon: "unarchive", title: "Unarchive Selected" },
    move: { icon: "folder", title: "Move to Folder" },
    tag: { icon: "tag", title: "Add Tags" },
    delete: { icon: "trash", title: "Delete", className: "text-danger" },
  };

  const actionButtons = actions
    .map((action) => {
      const { icon, title, className = "" } = actionIcons[action];
      return `
        <button class="btn-icon btn-bulk-${action} ${className}" title="${title}">
          ${Icon(icon, { size: 20 })}
        </button>
      `;
    })
    .join("");

  const clearIdAttr = clearBtnId ? `id="${clearBtnId}"` : "";
  const countIdAttr = selectionCountId ? `id="${selectionCountId}"` : "";

  return `
    <div class="header-selection-ui">
      <div class="header-left">
        <button class="btn-icon btn-clear-selection" ${clearIdAttr} title="Clear Selection">
          ${Icon("close", { size: 20 })}
        </button>
        <span class="selection-count header-selection-count" ${countIdAttr}>0 selected</span>
      </div>
      <div class="header-right">
        ${actionButtons}
      </div>
    </div>
  `;
}
