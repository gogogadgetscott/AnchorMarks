import { Icon } from "./Icon.tsx";

export type BulkAction =
  | "archive"
  | "unarchive"
  | "move"
  | "tag"
  | "auto-tag"
  | "delete";

interface SelectionUIProps {
  actions?: BulkAction[];
  selectionCount?: number;
  onClear?: () => void;
  onSelectAll?: () => void;
  onBulkAction?: (action: BulkAction) => void;
}

const actionConfig: Record<
  BulkAction,
  { icon: string; title: string; className?: string }
> = {
  archive: { icon: "archive", title: "Archive Selected" },
  unarchive: { icon: "unarchive", title: "Unarchive Selected" },
  move: { icon: "folder", title: "Move to Folder" },
  tag: { icon: "tag", title: "Add Tags" },
  "auto-tag": { icon: "sparkles", title: "Auto-Tag with AI" },
  delete: { icon: "trash", title: "Delete", className: "text-danger" },
};

export function SelectionUI({
  actions = ["archive", "move", "tag", "delete"],
  selectionCount = 0,
  onClear,
  onSelectAll,
  onBulkAction,
}: SelectionUIProps) {
  return (
    <div className="header-selection-ui">
      <div className="header-left">
        <button
          className="btn-icon btn-clear-selection"
          title="Clear Selection"
          onClick={onClear}
        >
          <Icon name="close" size={20} />
        </button>
        <span className="selection-count header-selection-count">
          {selectionCount} selected
        </span>
        <button
          className="btn-text btn-select-all"
          data-action="bulk-select-all"
          title="Select All"
          onClick={onSelectAll}
        >
          Select All
        </button>
      </div>
      <div className="header-right">
        {actions.map((action) => {
          const { icon, title, className = "" } = actionConfig[action];
          return (
            <button
              key={action}
              className={`btn-icon btn-bulk-${action} ${className}`}
              title={title}
              onClick={() => onBulkAction?.(action)}
            >
              <Icon name={icon} size={20} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
