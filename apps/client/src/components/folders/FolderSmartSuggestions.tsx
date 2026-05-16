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

  const dupNames = duplicateGroups
    .slice(0, 3)
    .map((group) => folders.find((f) => f.id === group[0])?.name ?? "")
    .filter(Boolean);
  const dupOverflow = duplicateGroups.length - 3;

  const selectEmpty = () => {
    const ids = new Set(
      folders
        .filter(
          (f) =>
            !f.bookmark_count && !folders.some((c) => c.parent_id === f.id),
        )
        .map((f) => f.id),
    );
    setSelected(ids);
  };

  const selectDuplicates = () => {
    setSelected(new Set(duplicateGroups.flatMap((g) => g)));
  };

  return (
    <div
      className="fo-suggestions"
      role="status"
      aria-label="Cleanup suggestions"
    >
      <Icon name="sparkles" size={14} className="fo-suggestions-icon" />
      <div className="fo-suggestions-body">
        {duplicateGroups.length > 0 && (
          <span className="fo-suggestion-item">
            <strong>Similar names</strong> — {dupNames.join(", ")}
            {dupOverflow > 0 ? ` +${dupOverflow} more` : ""}.{" "}
            <button
              type="button"
              className="fo-suggestion-link"
              onClick={selectDuplicates}
            >
              Select all to review
            </button>
          </span>
        )}
        {emptyCount > 0 && (
          <span className="fo-suggestion-item">
            <strong>
              {emptyCount === 1
                ? "1 empty folder"
                : `${emptyCount} empty folders`}
            </strong>{" "}
            with no bookmarks.{" "}
            <button
              type="button"
              className="fo-suggestion-link"
              onClick={selectEmpty}
            >
              Select all to clean up
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
