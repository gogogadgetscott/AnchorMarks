import React, { memo, useMemo, useCallback } from "react";
import { Icon } from "../components/Icon.tsx";
import { Button } from "../components/Button.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { useAppState } from "../contexts/AppContext";
import type { Folder } from "../types";

interface FolderItemProps {
  folder: Folder;
  level: number;
  onSelect: (folderId: string) => void;
  onEdit: (folder: Folder) => void;
  onDelete: (folderId: string) => void;
}

const FolderItem = memo<FolderItemProps>(
  ({ folder, level, onSelect, onEdit, onDelete }) => {
    const handleSelect = useCallback(() => {
      onSelect(folder.id);
    }, [folder.id, onSelect]);

    const handleEdit = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(folder);
      },
      [folder, onEdit],
    );

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(folder.id);
      },
      [folder.id, onDelete],
    );

    return (
      <div
        className="folder-item"
        style={{
          paddingLeft: `${level * 20 + 16}px`,
          backgroundColor: folder.color ? `${folder.color}10` : undefined,
        }}
        onClick={handleSelect}
      >
        <div className="folder-icon">
          <Icon name="folder" size={20} color={folder.color} />
        </div>
        <div className="folder-info">
          <div className="folder-name">{folder.name}</div>
          {folder.bookmark_count !== undefined && (
            <div className="folder-count">
              {folder.bookmark_count} bookmarks
            </div>
          )}
        </div>
        <div className="folder-actions">
          <button
            className="icon-button"
            onClick={handleEdit}
            title="Edit folder"
          >
            <Icon name="edit" size={16} />
          </button>
          <button
            className="icon-button"
            onClick={handleDelete}
            title="Delete folder"
          >
            <Icon name="delete" size={16} />
          </button>
        </div>
      </div>
    );
  },
);

FolderItem.displayName = "FolderItem";

export const FoldersView = memo(() => {
  const { folders } = useAppState();

  const folderTree = useMemo(() => {
    const buildTree = (
      parentId: string | null = null,
      level: number = 0,
    ): Array<{ folder: Folder; level: number }> => {
      const children = folders.filter(
        (f) => (f.parent_id || null) === parentId,
      );
      const result: Array<{ folder: Folder; level: number }> = [];

      for (const folder of children) {
        result.push({ folder, level });
        result.push(...buildTree(folder.id, level + 1));
      }

      return result;
    };

    return buildTree();
  }, [folders]);

  const handleSelectFolder = useCallback((folderId: string) => {
    window.AnchorMarks?.selectFolder?.(folderId);
  }, []);

  const handleEditFolder = useCallback((folder: Folder) => {
    window.AnchorMarks?.showFolderModal?.(folder);
  }, []);

  const handleDeleteFolder = useCallback((folderId: string) => {
    if (confirm("Are you sure you want to delete this folder?")) {
      window.AnchorMarks?.deleteFolder?.(folderId);
    }
  }, []);

  const handleCreateFolder = useCallback(() => {
    window.AnchorMarks?.showFolderModal?.();
  }, []);

  if (folders.length === 0) {
    return (
      <div className="folders-content">
        <EmptyState
          icon="folder"
          title="No folders yet"
          description="Create folders to organize your bookmarks"
          actionLabel="Create Folder"
          onAction={handleCreateFolder}
        />
      </div>
    );
  }

  return (
    <div className="folders-view">
      <div className="folders-header">
        <h2>Folders</h2>
        <Button variant="primary" onClick={handleCreateFolder} icon="add">
          New Folder
        </Button>
      </div>
      <div className="folders-list">
        {folderTree.map(({ folder, level }) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={level}
            onSelect={handleSelectFolder}
            onEdit={handleEditFolder}
            onDelete={handleDeleteFolder}
          />
        ))}
      </div>
    </div>
  );
});

FoldersView.displayName = "FoldersView";
