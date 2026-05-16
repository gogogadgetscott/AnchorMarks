import { useState, useMemo, useCallback, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { showToast } from "@contexts/ToastContext";
import type { Folder } from "../../types/index";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FolderTreePanelProps {
  selected: Set<string>;
  onSelect: (id: string, exclusive: boolean) => void;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  treeSearch: string;
}

// ── Tree item ────────────────────────────────────────────────────────────────

interface TreeItemProps {
  folder: Folder;
  depth: number;
  isSelected: boolean;
  isDropTarget: boolean;
  isBeingDragged: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  recursiveCount: number;
  onClickRow: () => void;
  onClickCheckbox: (e: React.MouseEvent) => void;
  onToggleCollapse: (e: React.MouseEvent) => void;
}

function TreeItem({
  folder,
  depth,
  isSelected,
  isDropTarget,
  isBeingDragged,
  hasChildren,
  isCollapsed,
  recursiveCount,
  onClickRow,
  onClickCheckbox,
  onToggleCollapse,
}: TreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
  } = useDraggable({
    id: folder.id,
    data: { folder },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop:${folder.id}`,
    data: { folder },
  });

  const combinedRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  const directCount = folder.bookmark_count ?? 0;
  const isEmpty = directCount === 0 && !hasChildren;
  const isLarge = recursiveCount >= 500;

  return (
    <div
      ref={combinedRef}
      className={[
        "ftp-item",
        depth > 0 ? "ftp-item--child" : "",
        isSelected ? "ftp-item--selected" : "",
        isDropTarget || isOver ? "ftp-item--drop-target" : "",
        isBeingDragged ? "ftp-item--dragging" : "",
        isEmpty ? "ftp-item--empty" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClickRow}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? !isCollapsed : undefined}
      aria-level={depth + 1}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClickRow()}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        className={`ftp-collapse ${hasChildren ? "" : "ftp-collapse--leaf"}`}
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? "Expand" : "Collapse"}
        tabIndex={-1}
      >
        {hasChildren && (
          <Icon
            name={isCollapsed ? "chevron-right" : "chevron-down"}
            size={12}
          />
        )}
      </button>

      {/* Checkbox */}
      <span
        className="ftp-checkbox"
        onClick={onClickCheckbox}
        role="checkbox"
        aria-checked={isSelected}
        tabIndex={-1}
      >
        {isSelected && <Icon name="check" size={10} />}
      </span>

      {/* Drag handle */}
      <span
        className="ftp-drag-handle"
        {...attributes}
        {...listeners}
        title="Drag to move or nest"
        aria-label="Drag handle"
      >
        <Icon name="grip-vertical" size={14} />
      </span>

      <span
        className="ftp-dot"
        style={{ background: folder.color || "var(--primary-500)" }}
      />

      <span className="ftp-name">{folder.name}</span>

      <span
        className={[
          "ftp-count",
          isEmpty ? "ftp-count--empty" : "",
          isLarge ? "ftp-count--large" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        title={
          isEmpty
            ? "No bookmarks. Use Archive or Delete to clean up."
            : recursiveCount !== directCount
              ? `${directCount.toLocaleString()} directly · ${recursiveCount.toLocaleString()} including subfolders`
              : `${directCount.toLocaleString()} bookmarks`
        }
      >
        {isEmpty ? (
          <span className="ftp-count-empty">empty</span>
        ) : (
          <>
            <span className={directCount === 0 ? "ftp-count-zero" : ""}>
              {directCount.toLocaleString()}
            </span>
            {recursiveCount !== directCount && (
              <span className="ftp-count-sub">
                {" "}
                ({recursiveCount.toLocaleString()})
              </span>
            )}
          </>
        )}
      </span>

      {folder.metadata?.status === "Archived" && (
        <span className="ftp-badge ftp-badge--archived">Archived</span>
      )}
    </div>
  );
}

// ── Top-level drop zone ───────────────────────────────────────────────────────

function TopLevelDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: "drop:__top_level__" });
  return (
    <div
      ref={setNodeRef}
      className={`ftp-top-drop ${isOver ? "ftp-top-drop--active" : ""}`}
      title="Drag a folder here to make it top-level"
    >
      <Icon name="layers" size={13} />
      Drop here → Top Level
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FolderTreePanel({
  selected,
  onSelect,
  collapsed,
  onToggleCollapse,
  treeSearch,
}: FolderTreePanelProps) {
  const { folders, updateFolder, getRecursiveBookmarkCount } = useFolders();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Determine which folder ids are visible given the current search/filter
  const visibleIds = useMemo(() => {
    if (!treeSearch) return null; // null = show everything

    if (treeSearch === "__empty__") {
      return new Set(
        folders
          .filter(
            (f) =>
              !f.bookmark_count && !folders.some((c) => c.parent_id === f.id),
          )
          .map((f) => f.id),
      );
    }

    if (treeSearch === "__archived__") {
      return new Set(
        folders
          .filter((f) => f.metadata?.status === "Archived")
          .map((f) => f.id),
      );
    }

    // Text search: include matching folders + all their ancestors
    const term = treeSearch.toLowerCase();
    const matching = new Set(
      folders
        .filter((f) => f.name.toLowerCase().includes(term))
        .map((f) => f.id),
    );
    for (const id of [...matching]) {
      let f = folders.find((x) => x.id === id);
      while (f?.parent_id) {
        matching.add(f.parent_id);
        f = folders.find((x) => x.id === f!.parent_id);
      }
    }
    return matching;
  }, [treeSearch, folders]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    async (e: DragEndEvent) => {
      setActiveId(null);
      setOverId(null);

      const dragged = e.active.data.current?.folder as Folder | undefined;
      if (!dragged || !e.over) return;

      const dropId = String(e.over.id);

      if (dropId === "drop:__top_level__") {
        if (dragged.parent_id == null) return;
        try {
          await updateFolder(dragged.id, { parent_id: null });
        } catch {
          showToast("Could not move folder", "error");
        }
        return;
      }

      const targetFolderId = dropId.replace(/^drop:/, "");
      if (!targetFolderId || targetFolderId === dragged.id) return;

      const target = folders.find((f) => f.id === targetFolderId);
      if (!target) return;
      if (target.id === (dragged.parent_id ?? null)) return;

      try {
        await updateFolder(dragged.id, { parent_id: target.id });
      } catch {
        showToast("Could not move folder", "error");
      }
    },
    [folders, updateFolder],
  );

  const activeFolder = activeId ? folders.find((f) => f.id === activeId) : null;
  const isTopDropActive = overId === "drop:__top_level__" && activeId !== null;

  // Recursive render — nesting provides indentation; .ftp-children adds tree lines
  function renderBranch(parentId: string | null, depth: number): ReactNode {
    const children = folders.filter((f) => (f.parent_id ?? null) === parentId);
    if (children.length === 0) return null;

    return children.map((folder) => {
      if (visibleIds && !visibleIds.has(folder.id)) return null;

      const hasChildren = folders.some((f) => f.parent_id === folder.id);
      const isCollapsed = collapsed.has(folder.id);
      const recursiveCount = getRecursiveBookmarkCount(folder.id);
      const subBranch =
        hasChildren && !isCollapsed ? renderBranch(folder.id, depth + 1) : null;

      return (
        <div key={folder.id} className="ftp-node">
          <TreeItem
            folder={folder}
            depth={depth}
            isSelected={selected.has(folder.id)}
            isDropTarget={
              overId === `drop:${folder.id}` && activeId !== folder.id
            }
            isBeingDragged={activeId === folder.id}
            hasChildren={hasChildren}
            isCollapsed={isCollapsed}
            recursiveCount={recursiveCount}
            onClickRow={() => onSelect(folder.id, true)}
            onClickCheckbox={(e) => {
              e.stopPropagation();
              onSelect(folder.id, false);
            }}
            onToggleCollapse={(e) => {
              e.stopPropagation();
              onToggleCollapse(folder.id);
            }}
          />
          {subBranch && <div className="ftp-children">{subBranch}</div>}
        </div>
      );
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="ftp-tree"
        role="tree"
        aria-label="Folder tree"
        aria-multiselectable="true"
        onKeyDown={(e) => {
          const items = (
            e.currentTarget as HTMLElement
          ).querySelectorAll<HTMLElement>('[role="treeitem"]');
          const idx = [...items].indexOf(document.activeElement as HTMLElement);
          if (e.key === "ArrowDown" && idx < items.length - 1) {
            e.preventDefault();
            items[idx + 1].focus();
          } else if (e.key === "ArrowUp" && idx > 0) {
            e.preventDefault();
            items[idx - 1].focus();
          }
        }}
      >
        <TopLevelDropZone isOver={isTopDropActive} />

        {treeSearch && visibleIds?.size === 0 && (
          <div className="ftp-empty">
            <Icon name="search" size={28} />
            <p>No folders match "{treeSearch}"</p>
          </div>
        )}

        {renderBranch(null, 0)}

        {folders.length === 0 && (
          <div className="ftp-empty">
            <Icon name="folder" size={32} />
            <p>No folders yet</p>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeFolder ? (
          <div className="ftp-item ftp-item--ghost">
            <span
              className="ftp-dot"
              style={{ background: activeFolder.color || "var(--primary-500)" }}
            />
            <span className="ftp-name">{activeFolder.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
