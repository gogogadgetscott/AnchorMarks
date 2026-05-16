import { Icon } from "@components/Icon.tsx";
import type { Folder } from "../../types/index";

interface Props {
  emptyCount: number;
  duplicateGroups: string[][];
  folders: Folder[];
  setSelected: (s: Set<string>) => void;
  onDismiss: () => void;
}

export function FolderSmartSuggestions({
  emptyCount,
  duplicateGroups,
  folders,
  setSelected,
  onDismiss,
}: Props) {
  if (emptyCount === 0 && duplicateGroups.length === 0) return null;

  const dupLabels = duplicateGroups
    .slice(0, 3)
    .map((group) => folders.find((f) => f.id === group[0])?.name ?? "")
    .filter(Boolean);

  return (
    <div className="fo-suggestions" role="status">
      <Icon name="sparkles" size={14} className="fo-suggestions-icon" />
      <div className="fo-suggestions-body">
        {duplicateGroups.length > 0 && (
          <span className="fo-suggestion-item">
            <strong>Similar names:</strong>{" "}
            {dupLabels.join(", ")}
            {duplicateGroups.length > 3
              ? ` +${duplicateGroups.length - 3} more`
              : ""}
            .{" "}
            <button
              type="button"
              className="fo-suggestion-link"
              onClick={() =>
                setSelected(new Set(duplicateGroups.flatMap((g) => g)))
              }
            >
              Select all
            </button>
          </span>
        )}
        {emptyCount > 0 && (
          <span className="fo-suggestion-item">
            <strong>{emptyCount} empty folder{emptyCount !== 1 ? "s" : ""}.</strong>{" "}
            <button
              type="button"
              className="fo-suggestion-link"
              onClick={() => {
                const emptyIds = new Set(
                  folders
                    .filter(
                      (f) =>
                        !f.bookmark_count &&
                        !folders.some((c) => c.parent_id === f.id),
                    )
                    .map((f) => f.id),
                );
                setSelected(emptyIds);
              }}
            >
              Select all
            </button>
          </span>
        )}
      </div>
      <button
        type="button"
        className="btn-icon fo-suggestions-close"
        onClick={onDismiss}
        aria-label="Dismiss suggestions"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
