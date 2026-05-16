import { useState, useEffect, useCallback } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { FolderParentSelector } from "./FolderParentSelector";
import type { Folder } from "../../types/index";

export function BulkReorganizePanel() {
  const { folders, bulkMoveParents, updateFolder } = useFolders();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetParent, setMoveTargetParent] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Flatten: top-level first, then children grouped under their parent
  const orderedFolders: Folder[] = [
    ...folders.filter((f) => !f.parent_id),
    ...folders.filter((f) => f.parent_id),
  ];

  // Shift+A — select / deselect all
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.shiftKey &&
        e.key.toLowerCase() === "a" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        setSelected((prev) =>
          prev.size === orderedFolders.length
            ? new Set()
            : new Set(orderedFolders.map((f) => f.id)),
        );
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [orderedFolders]);

  const toggleFolder = useCallback(
    (folderId: string, idx: number, e: React.MouseEvent) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastClickedIdx !== null) {
          // Range select
          const lo = Math.min(idx, lastClickedIdx);
          const hi = Math.max(idx, lastClickedIdx);
          for (let i = lo; i <= hi; i++) {
            next.add(orderedFolders[i].id);
          }
        } else {
          next.has(folderId) ? next.delete(folderId) : next.add(folderId);
        }
        return next;
      });
      setLastClickedIdx(idx);
    },
    [lastClickedIdx, orderedFolders],
  );

  const handleMoveConfirm = useCallback(async () => {
    if (selected.size === 0) return;
    setIsBusy(true);
    try {
      await bulkMoveParents([...selected], moveTargetParent);
      setSelected(new Set());
      setMoveOpen(false);
    } finally {
      setIsBusy(false);
    }
  }, [selected, moveTargetParent, bulkMoveParents]);

  const handleArchiveSelected = useCallback(async () => {
    if (selected.size === 0) return;
    setIsBusy(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          updateFolder(id, { metadata: { status: "Archived" } }),
        ),
      );
      setSelected(new Set());
    } finally {
      setIsBusy(false);
    }
  }, [selected, updateFolder]);

  const selectedCount = selected.size;
  const allSelected = selectedCount === orderedFolders.length;

  return (
    <div className="bulk-panel">
      {/* Toolbar */}
      <div className="bulk-toolbar">
        <label className="bulk-select-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(
                allSelected ? new Set() : new Set(orderedFolders.map((f) => f.id)),
              )
            }
          />
          <span>
            {allSelected ? "Deselect all" : "Select all"}
            <kbd className="bulk-kbd">Shift+A</kbd>
          </span>
        </label>

        <span className="bulk-count">
          {selectedCount > 0 ? `${selectedCount} selected` : ""}
        </span>
      </div>

      {/* Folder list */}
      <div className="bulk-list">
        {orderedFolders.map((folder, idx) => {
          const isChild = Boolean(folder.parent_id);
          const parentFolder = isChild
            ? folders.find((f) => f.id === folder.parent_id)
            : null;
          return (
            <label
              key={folder.id}
              className={`bulk-item ${isChild ? "bulk-item--child" : ""} ${selected.has(folder.id) ? "bulk-item--selected" : ""}`}
              onClick={(e) => toggleFolder(folder.id, idx, e)}
            >
              <input
                type="checkbox"
                checked={selected.has(folder.id)}
                onChange={() => {}} // Controlled by label click
                onClick={(e) => e.stopPropagation()}
              />
              <span
                className="bulk-item-dot"
                style={{ background: folder.color || "var(--primary-500)" }}
              />
              <span className="bulk-item-name">{folder.name}</span>
              {parentFolder && (
                <span className="bulk-item-parent">
                  <Icon name="folder" size={11} />
                  {parentFolder.name}
                </span>
              )}
              {folder.metadata?.status === "Archived" && (
                <span className="bulk-item-badge bulk-item-badge--archived">
                  Archived
                </span>
              )}
              {folder.metadata?.type && (
                <span className="bulk-item-badge">{folder.metadata.type}</span>
              )}
            </label>
          );
        })}
      </div>

      {/* Floating action bar */}
      {selectedCount > 0 && (
        <div className="bulk-action-bar">
          <span className="bulk-action-bar__count">{selectedCount} selected</span>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setMoveOpen(true)}
            disabled={isBusy}
          >
            <Icon name="folder" size={15} />
            Move
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleArchiveSelected}
            disabled={isBusy}
          >
            <Icon name="archive" size={15} />
            Archive
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelected(new Set())}
          >
            <Icon name="x" size={15} />
            Clear
          </button>
        </div>
      )}

      {/* Move-to modal */}
      {moveOpen && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label="Move folders"
        >
          <div className="modal-backdrop" onClick={() => setMoveOpen(false)} />
          <div className="modal-content modal-sm">
            <div className="modal-header">
              <h2>Move {selectedCount} folder{selectedCount !== 1 ? "s" : ""}</h2>
              <button
                type="button"
                className="btn-icon modal-close"
                onClick={() => setMoveOpen(false)}
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="bulk-move-hint">
                Select the destination folder. Cycles (moving a folder into one
                of its own subfolders) are rejected by the server.
              </p>
              {/* Use first selected folder as the "anchor" for the parent selector */}
              <FolderParentSelector
                folderId={[...selected][0]}
                currentParentId={moveTargetParent}
                onChange={setMoveTargetParent}
                showSuggestions={false}
              />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary modal-cancel"
                onClick={() => setMoveOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMoveConfirm}
                disabled={isBusy}
              >
                {isBusy ? "Moving…" : "Confirm Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
