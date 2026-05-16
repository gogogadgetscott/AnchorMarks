import { useState, useCallback, useMemo } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { FolderParentSelector } from "./FolderParentSelector";

interface Props {
  selected: Set<string>;
  onClear: () => void;
}

type PanelAction = "move" | "merge" | "delete" | null;

export function FolderBulkPanel({ selected, onClear }: Props) {
  const {
    folders,
    updateFolder,
    bulkMoveParents,
    mergeFolders,
    bulkDeleteFolders,
    getRecursiveBookmarkCount,
  } = useFolders();

  const [action, setAction] = useState<PanelAction>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const selectedFolders = useMemo(
    () => folders.filter((f) => selected.has(f.id)),
    [folders, selected],
  );

  const totalBookmarks = useMemo(
    () =>
      selectedFolders.reduce(
        (acc, f) => acc + getRecursiveBookmarkCount(f.id),
        0,
      ),
    [selectedFolders, getRecursiveBookmarkCount],
  );

  const allEmpty = selectedFolders.every((f) => (f.bookmark_count ?? 0) === 0);

  // First selected folder is used as anchor for FolderParentSelector.
  const anchorId = [...selected][0] ?? "";

  const wrap = useCallback(
    async (fn: () => Promise<void>) => {
      setIsBusy(true);
      try {
        await fn();
        onClear();
        setAction(null);
      } finally {
        setIsBusy(false);
      }
    },
    [onClear],
  );

  const handleMove = useCallback(
    () => wrap(() => bulkMoveParents([...selected], moveTarget)),
    [wrap, selected, moveTarget, bulkMoveParents],
  );

  const handleMerge = useCallback(() => {
    if (!mergeTarget) return;
    const sources = [...selected].filter((id) => id !== mergeTarget);
    return wrap(() => mergeFolders(sources, mergeTarget));
  }, [wrap, selected, mergeTarget, mergeFolders]);

  const handleArchive = useCallback(
    () =>
      wrap(async () => {
        await Promise.all(
          [...selected].map((id) => {
            const f = folders.find((x) => x.id === id);
            return updateFolder(id, {
              metadata: { ...(f?.metadata ?? {}), status: "Archived" },
            });
          }),
        );
      }),
    [wrap, selected, folders, updateFolder],
  );

  const handleDelete = useCallback(
    () => wrap(() => bulkDeleteFolders([...selected])),
    [wrap, selected, bulkDeleteFolders],
  );

  // Merge target folder name and source count for preview
  const mergeTargetFolder = selectedFolders.find((f) => f.id === mergeTarget);
  const mergeSourceCount = mergeTarget ? selected.size - 1 : 0;

  return (
    <div className="fbp-root">
      <div className="fbp-summary">
        <strong className="fbp-count">{selected.size} folders selected</strong>
        {totalBookmarks > 0 && (
          <span className="fbp-bookmark-count">
            &nbsp;· {totalBookmarks.toLocaleString()} bookmarks total
          </span>
        )}
      </div>

      {/* Empty-selection cleanup hint */}
      {allEmpty && action === null && (
        <div className="fbp-cleanup-hint">
          <Icon name="info" size={13} />
          All selected folders are empty — safe to archive or delete.
        </div>
      )}

      <div className="fbp-folder-list">
        {selectedFolders.map((f) => (
          <div key={f.id} className="fbp-folder-item">
            <span
              className="fbp-dot"
              style={{ background: f.color || "var(--primary-500)" }}
            />
            <span className="fbp-folder-name">{f.name}</span>
            <span className="fbp-folder-count">
              {f.bookmark_count ? f.bookmark_count.toLocaleString() : "empty"}
            </span>
          </div>
        ))}
      </div>

      {/* Main action buttons */}
      {action === null && (
        <div className="fbp-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setAction("move")}
          >
            <Icon name="folder" size={14} />
            Move to…
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setMergeTarget([...selected][0] ?? null);
              setAction("merge");
            }}
          >
            <Icon name="layers" size={14} />
            Merge into…
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleArchive}
            disabled={isBusy}
          >
            <Icon name="archive" size={14} />
            Archive
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setAction("delete")}
          >
            <Icon name="trash" size={14} />
            Delete
          </button>
        </div>
      )}

      {/* Move */}
      {action === "move" && (
        <div className="fbp-sub">
          <p className="fbp-sub-hint">
            Move {selected.size} folder{selected.size !== 1 ? "s" : ""} into:
          </p>
          <FolderParentSelector
            folderId={anchorId}
            currentParentId={moveTarget}
            onChange={setMoveTarget}
            showSuggestions={false}
          />
          <div className="fbp-sub-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleMove}
              disabled={isBusy}
            >
              {isBusy ? "Moving…" : "Confirm Move"}
            </button>
          </div>
        </div>
      )}

      {/* Merge */}
      {action === "merge" && (
        <div className="fbp-sub">
          <p className="fbp-sub-hint">
            Keep one folder and move all bookmarks into it. The rest will be
            deleted.
          </p>
          <div className="fbp-merge-list">
            {selectedFolders.map((f) => (
              <label
                key={f.id}
                className={`fbp-merge-option ${mergeTarget === f.id ? "fbp-merge-option--active" : ""}`}
              >
                <input
                  type="radio"
                  name="merge-target"
                  checked={mergeTarget === f.id}
                  onChange={() => setMergeTarget(f.id)}
                />
                <span
                  className="fbp-dot"
                  style={{ background: f.color || "var(--primary-500)" }}
                />
                <span className="fbp-folder-name">{f.name}</span>
                <span className="fbp-folder-count">
                  {(f.bookmark_count ?? 0).toLocaleString()}
                </span>
              </label>
            ))}
          </div>

          {/* Merge preview */}
          {mergeTarget && mergeTargetFolder && (
            <div className="fbp-merge-preview">
              <strong>{mergeTargetFolder.name}</strong> will keep all bookmarks.{" "}
              {mergeSourceCount} folder{mergeSourceCount !== 1 ? "s" : ""} will
              be deleted.{" "}
              {totalBookmarks > 0 && (
                <>{totalBookmarks.toLocaleString()} bookmarks preserved.</>
              )}
            </div>
          )}

          <div className="fbp-sub-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleMerge}
              disabled={isBusy || !mergeTarget}
            >
              {isBusy ? "Merging…" : "Merge and Delete Sources"}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {action === "delete" && (
        <div className="fbp-sub fbp-sub--danger">
          <p className="fbp-sub-hint">
            Delete{" "}
            <strong>
              {selected.size} folder{selected.size !== 1 ? "s" : ""}
            </strong>
            ?{" "}
            {totalBookmarks > 0 ? (
              <>
                {totalBookmarks.toLocaleString()} bookmarks will move to
                Uncategorized.{" "}
              </>
            ) : (
              <>All selected folders are empty. </>
            )}
            This cannot be undone.
          </p>
          <div className="fbp-sub-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {isBusy
                ? "Deleting…"
                : `Delete ${selected.size} Folder${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      <button type="button" className="fbp-clear" onClick={onClear}>
        <Icon name="x" size={12} />
        Clear selection
      </button>
    </div>
  );
}
