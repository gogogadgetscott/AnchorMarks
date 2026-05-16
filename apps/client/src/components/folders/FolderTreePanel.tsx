import { useState, useCallback, type ReactNode } from "react";
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
import { FolderParentSelector } from "./FolderParentSelector";
import { FolderMetadataEditor } from "./FolderMetadataEditor";
import type { Folder, FolderMetadata } from "../../types/index";

// ── Draggable tree item ──────────────────────────────────────────────────────

interface TreeItemProps {
  folder: Folder;
  depth: number; // 0 = top-level, 1 = child
  isSelected: boolean;
  isDropTarget: boolean;
  isBeingDragged: boolean;
  onClick: () => void;
}

function TreeItem({
  folder,
  depth,
  isSelected,
  isDropTarget,
  isBeingDragged,
  onClick,
}: TreeItemProps) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
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

  return (
    <div
      ref={combinedRef}
      className={[
        "ftp-item",
        depth > 0 ? "ftp-item--child" : "",
        isSelected ? "ftp-item--selected" : "",
        isDropTarget || isOver ? "ftp-item--drop-target" : "",
        isBeingDragged ? "ftp-item--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={depth > 1 ? { paddingLeft: `${10 + depth * 16}px` } : undefined}
      onClick={onClick}
      role="treeitem"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Drag handle */}
      <span
        className="ftp-drag-handle"
        {...attributes}
        {...listeners}
        title="Drag to change parent"
        aria-label="Drag handle"
      >
        <Icon name="grip-vertical" size={14} />
      </span>


      <span
        className="ftp-dot"
        style={{ background: folder.color || "var(--primary-500)" }}
      />

      <span className="ftp-name">{folder.name}</span>

      {folder.bookmark_count != null && (
        <span className="ftp-count">{folder.bookmark_count}</span>
      )}

      {folder.metadata?.status === "Archived" && (
        <span className="ftp-badge ftp-badge--archived">Archived</span>
      )}
    </div>
  );
}

// Drop zone at the top — "move to top level"
function TopLevelDropZone({ isOver }: { isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: "drop:__top_level__" });
  return (
    <div
      ref={setNodeRef}
      className={`ftp-top-drop ${isOver ? "ftp-top-drop--active" : ""}`}
    >
      <Icon name="layers" size={13} />
      Drop here to make top-level
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  folder: Folder;
}

function DetailPanel({ folder }: DetailPanelProps) {
  const { updateFolder } = useFolders();
  // key={folder.id} on <DetailPanel> in the parent ensures this component is
  // fully remounted whenever the selection changes, so useState initial values
  // are always fresh — no extra effect needed.
  const [name, setName] = useState(folder.name);
  const [meta, setMeta] = useState<FolderMetadata>(folder.metadata ?? {});
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateFolder(folder.id, {
        name: name.trim() || folder.name,
        metadata: meta,
      });
    } finally {
      setSaving(false);
    }
  }, [folder.id, folder.name, name, meta, updateFolder]);

  return (
    <div className="ftp-detail">
      <div className="ftp-detail-header">
        <span
          className="ftp-detail-dot"
          style={{ background: folder.color || "var(--primary-500)" }}
        />
        <span className="ftp-detail-title">Folder Settings</span>
      </div>

      <div className="form-group">
        <label htmlFor="ftp-name">Name</label>
        <input
          id="ftp-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </div>

      <div className="form-group">
        <label>Parent Folder</label>
        <FolderParentSelector
          folderId={folder.id}
          currentParentId={folder.parent_id ?? null}
          onChange={async (newParentId) => {
            setSaving(true);
            try {
              await updateFolder(folder.id, { parent_id: newParentId });
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>

      <div className="form-group">
        <label>Metadata</label>
        <FolderMetadataEditor
          metadata={meta}
          onChange={setMeta}
          disabled={saving}
        />
      </div>

      <div className="ftp-detail-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function FolderTreePanel() {
  const { folders, updateFolder } = useFolders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const selectedFolder = selectedId ? folders.find((f) => f.id === selectedId) ?? null : null;

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

      // Dropped on the top-level zone → clear parent
      if (dropId === "drop:__top_level__") {
        if (dragged.parent_id == null) return;
        try {
          await updateFolder(dragged.id, { parent_id: null });
        } catch {
          showToast("Could not move folder", "error");
        }
        return;
      }

      // Dropped onto another folder → make dragged a child of that folder
      const targetFolderId = dropId.replace(/^drop:/, "");
      if (!targetFolderId || targetFolderId === dragged.id) return;

      const target = folders.find((f) => f.id === targetFolderId);
      if (!target) return;

      // Don't drop onto own current parent (no-op)
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
  const isTopDropActive =
    overId === "drop:__top_level__" && activeId !== null;

  // Recursively render folders at any depth
  function renderBranch(parentId: string | null, depth: number): ReactNode {
    const children = folders.filter(
      (f) => (f.parent_id ?? null) === parentId,
    );
    if (children.length === 0) return null;
    return children.map((folder) => (
      <div key={folder.id} className="ftp-group">
        <TreeItem
          folder={folder}
          depth={depth}
          isSelected={selectedId === folder.id}
          isDropTarget={overId === `drop:${folder.id}` && activeId !== folder.id}
          isBeingDragged={activeId === folder.id}
          onClick={() =>
            setSelectedId(selectedId === folder.id ? null : folder.id)
          }
        />
        {renderBranch(folder.id, depth + 1)}
      </div>
    ));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="ftp-root">
        {/* Tree column */}
        <div className="ftp-tree" role="tree" aria-label="Folder tree">
          <TopLevelDropZone isOver={isTopDropActive} />

          {renderBranch(null, 0)}

          {folders.length === 0 && (
            <div className="ftp-empty">
              <Icon name="folder" size={32} />
              <p>No folders yet</p>
            </div>
          )}
        </div>

        {/* Detail column */}
        <div className="ftp-detail-col">
          {selectedFolder ? (
            <DetailPanel key={selectedFolder.id} folder={selectedFolder} />
          ) : (
            <div className="ftp-detail ftp-detail--empty">
              <Icon name="folder" size={40} />
              <p>Select a folder to edit its settings</p>
            </div>
          )}
        </div>
      </div>

      {/* Ghost while dragging */}
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
