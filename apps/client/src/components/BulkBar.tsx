import React from "react";
import { useBookmarks } from "@contexts/BookmarksContext";
import { useFolders } from "@contexts/FoldersContext";
import { useBulkOps } from "@contexts/useBulkOps";

export function BulkBar() {
  const { selectedBookmarks, setSelectedBookmarks, renderedBookmarks } =
    useBookmarks();
  const { folders } = useFolders();
  const {
    bulkDelete,
    bulkFavorite,
    bulkMove,
    bulkAddTags,
    bulkRemoveTags,
    clearSelections,
  } = useBulkOps();

  if (selectedBookmarks.size === 0) return null;

  const handleSelectAll = () => {
    setSelectedBookmarks(new Set(renderedBookmarks.map((b) => b.id)));
  };

  const handleMove = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const folderId = e.target.value;
    if (!folderId) return;
    await bulkMove(folderId);
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
          onClick={() => setSelectedBookmarks(new Set())}
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
          <select id="bulk-move-select" onChange={handleMove} defaultValue="">
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
          onClick={clearSelections}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
