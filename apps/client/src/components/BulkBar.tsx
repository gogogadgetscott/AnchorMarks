import React from "react";
import { useBookmarks } from "@contexts/BookmarksContext";
import { useFolders } from "@contexts/FoldersContext";
import {
  bulkDelete,
  bulkFavorite,
  bulkAddTags,
  bulkRemoveTags,
  bulkMove,
} from "@features/bookmarks/bulk-ops.ts";
import * as state from "@features/state.ts";

export function BulkBar() {
  const {
    selectedBookmarks,
    setSelectedBookmarks,
    renderedBookmarks,
    setBulkMode,
  } = useBookmarks();
  const { folders } = useFolders();

  if (selectedBookmarks.size === 0) return null;

  const handleSelectAll = () => {
    const allIds = new Set(renderedBookmarks.map((b) => b.id));
    setSelectedBookmarks(allIds);
    state.setSelectedBookmarks(allIds);
  };

  const handleUnselectAll = () => {
    const empty = new Set<string>();
    setSelectedBookmarks(empty);
    state.setSelectedBookmarks(empty);
  };

  const handleClear = () => {
    handleUnselectAll();
    setBulkMode(false);
    state.setBulkMode(false);
  };

  const handleMove = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const folderId = e.target.value;
    if (!folderId) return;

    // Use a temporary hidden select to satisfy the bulk-ops.ts requirement
    // TODO: Refactor bulk-ops.ts to accept folderId as argument
    const hiddenSelect = document.createElement("select");
    hiddenSelect.id = "bulk-move-select";
    hiddenSelect.value = folderId;
    document.body.appendChild(hiddenSelect);

    await bulkMove();

    document.body.removeChild(hiddenSelect);
    handleClear();
  };

  return (
    <div id="bulk-bar" className="bulk-bar">
      <div className="bulk-left">
        <span id="bulk-count">{selectedBookmarks.size} selected</span>
        <button
          className="btn-link"
          id="bulk-select-all-btn"
          style={{ marginLeft: "1rem", fontSize: "0.85rem" }}
          onClick={handleSelectAll}
        >
          Select All
        </button>
        <button
          className="btn-link"
          id="bulk-unselect-all-btn"
          style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}
          onClick={handleUnselectAll}
        >
          Unselect All
        </button>
      </div>
      <div className="bulk-actions">
        <button
          className="btn btn-ghost"
          id="bulk-favorite-btn"
          onClick={bulkFavorite}
        >
          Favorite
        </button>
        <button
          className="btn btn-secondary"
          id="bulk-tag-btn"
          onClick={bulkAddTags}
        >
          Tag
        </button>
        <button
          className="btn btn-ghost"
          id="bulk-untag-btn"
          onClick={bulkRemoveTags}
        >
          Remove Tags
        </button>
        <div className="bulk-move">
          <select
            id="bulk-move-select-dropdown"
            onChange={handleMove}
            defaultValue=""
          >
            <option value="" disabled>
              Move to...
            </option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" id="bulk-move-btn" disabled>
            Move
          </button>
        </div>
        <button
          className="btn btn-danger"
          id="bulk-delete-btn"
          onClick={bulkDelete}
        >
          Delete
        </button>
        <button
          className="btn btn-ghost"
          id="bulk-clear-btn"
          onClick={handleClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
