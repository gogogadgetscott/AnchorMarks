import { useState, useMemo, useCallback } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { FolderTreePanel } from "./FolderTreePanel";
import { FolderDetailPanel } from "./FolderDetailPanel";
import { FolderBulkPanel } from "./FolderBulkPanel";
import { FolderSmartSuggestions } from "./FolderSmartSuggestions";

// ── Quick-filter values that bypass the text search ───────────────────────────
type QuickFilter = "" | "__empty__" | "__archived__";

export function FolderOrganizerView() {
  const { folders, isLoading, createFolder } = useFolders();

  // Shared selection — drives both tree checkboxes and the right panel
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-node collapse state
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Text search / quick filter fed into the tree
  const [treeSearch, setTreeSearch] = useState<QuickFilter | string>("");
  // Whether the suggestions banner is visible
  const [showSuggestions, setShowSuggestions] = useState(true);

  // ── Selection handlers ──────────────────────────────────────────────────────
  // exclusive=true → click on row body → select only this folder
  // exclusive=false → checkbox / ctrl-click → toggle in set
  const handleSelect = useCallback((id: string, exclusive: boolean) => {
    setSelected((prev) => {
      if (exclusive) {
        if (prev.size === 1 && prev.has(id)) return new Set();
        return new Set([id]);
      }
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleToggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const emptyCount = useMemo(
    () =>
      folders.filter(
        (f) => !f.bookmark_count && !folders.some((c) => c.parent_id === f.id),
      ).length,
    [folders],
  );

  // Group folders by normalised name to surface near-duplicates
  const duplicateGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const f of folders) {
      const key = f.name
        .trim()
        .toLowerCase()
        .replace(/\s*\(\d+\)$/, "")
        .replace(/[-_\s]+/g, " ");
      (groups[key] ??= []).push(f.id);
    }
    return Object.values(groups).filter((g) => g.length > 1);
  }, [folders]);

  // The single selected folder (for the detail panel)
  const singleFolder =
    selected.size === 1
      ? (folders.find((f) => f.id === [...selected][0]) ?? null)
      : null;

  if (isLoading) {
    return (
      <div className="fo-loading">
        <Icon name="folder" size={32} />
        <p>Loading folders…</p>
      </div>
    );
  }

  return (
    <div className="fo-root">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="fo-header">
        <div className="fo-header-left">
          <Icon name="folder" size={18} />
          <h1 className="fo-title">Folder Organizer</h1>
          <span className="badge">{folders.length}</span>
        </div>
        <div className="fo-header-right">
          <div className="fo-search-wrap">
            <Icon name="search" size={14} className="fo-search-icon" />
            <input
              className="fo-search"
              type="text"
              placeholder="Search folders…"
              value={treeSearch.startsWith("__") ? "" : treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              aria-label="Search folders"
            />
            {treeSearch && (
              <button
                type="button"
                className="fo-search-clear"
                onClick={() => setTreeSearch("")}
                aria-label="Clear search"
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => createFolder({ name: "New Folder" })}
          >
            <Icon name="plus" size={14} />
            New Folder
          </button>
        </div>
      </div>

      {/* ── Smart suggestions banner ─────────────────────────────────── */}
      {showSuggestions && (emptyCount > 0 || duplicateGroups.length > 0) && (
        <FolderSmartSuggestions
          emptyCount={emptyCount}
          duplicateGroups={duplicateGroups}
          folders={folders}
          setSelected={setSelected}
          onDismiss={() => setShowSuggestions(false)}
        />
      )}

      {/* ── Three-column layout ──────────────────────────────────────── */}
      <div className="fo-layout">
        {/* Left: stats + quick filters */}
        <aside className="fo-sidebar">
          <div className="fo-stats">
            <div className="fo-stat" title={`${folders.length} folders total`}>
              <span className="fo-stat-value">{folders.length}</span>
              <span className="fo-stat-label">total</span>
            </div>
            <div
              className="fo-stat"
              title={`${folders.filter((f) => !f.parent_id).length} folders at the root level`}
            >
              <span className="fo-stat-value">
                {folders.filter((f) => !f.parent_id).length}
              </span>
              <span className="fo-stat-label">top-level</span>
            </div>
            <div
              className={`fo-stat ${emptyCount > 0 ? "fo-stat--warn" : ""}`}
              title={
                emptyCount > 0
                  ? `${emptyCount} folders with no bookmarks and no subfolders`
                  : "No empty folders"
              }
            >
              <span className="fo-stat-value">{emptyCount}</span>
              <span className="fo-stat-label">empty</span>
            </div>
          </div>

          <div className="fo-sidebar-section">
            <span className="fo-sidebar-label">Quick filters</span>
            <button
              type="button"
              title="Show only folders with no bookmarks and no subfolders. Click again to clear."
              className={`fo-filter-chip ${treeSearch === "__empty__" ? "fo-filter-chip--active" : ""}`}
              onClick={() =>
                setTreeSearch((p) => (p === "__empty__" ? "" : "__empty__"))
              }
            >
              Empty
              {emptyCount > 0 && (
                <span className="fo-filter-chip-count">{emptyCount}</span>
              )}
            </button>
            <button
              type="button"
              title="Show only folders marked as Archived. Click again to clear."
              className={`fo-filter-chip ${treeSearch === "__archived__" ? "fo-filter-chip--active" : ""}`}
              onClick={() =>
                setTreeSearch((p) =>
                  p === "__archived__" ? "" : "__archived__",
                )
              }
            >
              Archived
            </button>
            {duplicateGroups.length > 0 && (
              <button
                type="button"
                title="Select all folders with similar names so you can review and merge them."
                className="fo-filter-chip fo-filter-chip--warn"
                onClick={() => {
                  const ids = new Set(duplicateGroups.flatMap((g) => g));
                  setSelected(ids);
                  setTreeSearch("");
                }}
              >
                Similar names
                <span className="fo-filter-chip-count">
                  {duplicateGroups.length}
                </span>
              </button>
            )}
          </div>

          {/* Active filter indicator */}
          {treeSearch.startsWith("__") && (
            <div className="fo-filter-active">
              <span>Filter active</span>
              <button
                type="button"
                className="fo-filter-active-clear"
                onClick={() => setTreeSearch("")}
              >
                <Icon name="x" size={10} />
                Clear
              </button>
            </div>
          )}

          {selected.size > 0 && (
            <button
              type="button"
              className="fo-filter-chip fo-filter-chip--clear"
              onClick={() => setSelected(new Set())}
            >
              <Icon name="x" size={12} />
              Clear selection ({selected.size})
            </button>
          )}
        </aside>

        {/* Center: folder tree + optional bulk mode badge */}
        <div className="fo-tree-col">
          {selected.size >= 2 && (
            <div className="fo-mode-badge">
              <Icon name="check-square" size={12} />
              Bulk select — {selected.size} folders
            </div>
          )}
          <FolderTreePanel
            selected={selected}
            onSelect={handleSelect}
            collapsed={collapsed}
            onToggleCollapse={handleToggleCollapse}
            treeSearch={treeSearch}
          />
        </div>

        {/* Right: detail (1 selected) | bulk (2+) | empty state */}
        <div className="fo-right-col">
          {selected.size === 0 && (
            <div className="fo-right-empty">
              <Icon name="folder" size={36} />
              <p>Select a folder to edit it</p>
              <p className="fo-right-empty-hint">
                Check multiple folders to bulk-organize them.
              </p>
            </div>
          )}

          {selected.size === 1 && singleFolder && (
            <FolderDetailPanel key={singleFolder.id} folder={singleFolder} />
          )}

          {selected.size >= 2 && (
            <FolderBulkPanel
              selected={selected}
              onClear={() => setSelected(new Set())}
            />
          )}
        </div>
      </div>
    </div>
  );
}
