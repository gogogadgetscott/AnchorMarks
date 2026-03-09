import { useRef, useEffect, useCallback } from "react";
import { useModal } from "@contexts/ModalContext";
import { useFolders } from "@contexts/FoldersContext";
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";

const FOLDER_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
  "#64748b",
];

export default function FolderModal() {
  const { closeModal, folderFormData, setFolderFormData, openBookmarkModal } = useModal();
  const { folders, createFolder, updateFolder, deleteFolder } = useFolders();
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    // Check if we should return to bookmark modal
    const returnToBookmark = sessionStorage.getItem('returnToBookmarkModal');
    if (returnToBookmark) {
      try {
        const bookmarkData = JSON.parse(returnToBookmark);
        sessionStorage.removeItem('returnToBookmarkModal');
        // Reopen bookmark modal with original data (no folder selected since user cancelled)
        openBookmarkModal(bookmarkData);
      } catch (err) {
        console.error('Failed to parse bookmark modal data:', err);
        closeModal();
      }
    } else {
      closeModal();
    }
  }, [closeModal, openBookmarkModal]);

  useEffect(() => {
    if (modalRef.current) {
      try {
        createFocusTrap(modalRef.current, {
          initialFocus: true,
          onEscape: handleClose,
        });
      } catch (error) {
        console.warn("Failed to create focus trap for modal", error);
      }
    }

    return () => {
      if (modalRef.current?.id) {
        removeFocusTrap(modalRef.current.id);
      }
    };
  }, [handleClose]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = {
      name: folderFormData.name,
      parent_id: folderFormData.parentId || undefined,
      color: folderFormData.color,
    };

    if (folderFormData.id) {
      await updateFolder(folderFormData.id, data);
      closeModal();
    } else {
      const newFolder = await createFolder(data);
      if (newFolder) {
        // Check if we should return to bookmark modal
        const returnToBookmark = sessionStorage.getItem('returnToBookmarkModal');
        if (returnToBookmark) {
          try {
            const bookmarkData = JSON.parse(returnToBookmark);
            sessionStorage.removeItem('returnToBookmarkModal');
            // Reopen bookmark modal with the newly created folder selected
            openBookmarkModal({
              ...bookmarkData,
              folderId: newFolder.id,
            });
          } catch (err) {
            console.error('Failed to parse bookmark modal data:', err);
            closeModal();
          }
        } else {
          closeModal();
        }
      }
    }
  };

  const handleDelete = async () => {
    if (folderFormData.id) {
      await deleteFolder(folderFormData.id);
    }
  };

  const handleColorSelect = (color: string) => {
    setFolderFormData({ color });
  };

  const isEditing = Boolean(folderFormData.id);
  const title = isEditing ? "Edit Folder" : "New Folder";
  const submitLabel = isEditing ? "Update Folder" : "Create Folder";

  // Filter out current folder from parent options if editing
  const availableParents = folderFormData.id
    ? folders.filter((f: any) => f.id !== folderFormData.id)
    : folders;

  return (
    <div
      id="folder-modal"
      className="modal"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-modal-title"
      tabIndex={-1}
    >
      <div className="modal-backdrop" onClick={handleClose}></div>
      <div className="modal-content modal-sm">
        <div className="modal-header">
          <h2 id="folder-modal-title">{title}</h2>
          <button
            type="button"
            className="btn-icon modal-close"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form id="folder-form" onSubmit={handleSubmit}>
          {folderFormData.id && (
            <input type="hidden" id="folder-id" value={folderFormData.id} />
          )}

          <div className="form-group">
            <label htmlFor="folder-name">Folder Name *</label>
            <input
              type="text"
              id="folder-name"
              required
              placeholder="My Collection"
              value={folderFormData.name}
              onChange={(e) =>
                setFolderFormData({ ...folderFormData, name: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="folder-parent">Parent Folder</label>
            <select
              id="folder-parent"
              value={folderFormData.parentId || ""}
              onChange={(e) =>
                setFolderFormData({
                  ...folderFormData,
                  parentId: e.target.value || null,
                })
              }
            >
              <option value="">None (Top Level)</option>
              {availableParents.map((folder: any) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              {FOLDER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${
                    folderFormData.color === color ? "active" : ""
                  }`}
                  style={
                    {
                      "--color": color,
                    } as React.CSSProperties
                  }
                  onClick={() => handleColorSelect(color)}
                  data-color={color}
                />
              ))}
            </div>
          </div>

          <div className="modal-footer">
            {folderFormData.id && (
              <button
                type="button"
                className="btn btn-outline-danger"
                id="delete-folder-btn"
                style={{ marginRight: "auto" }}
                onClick={handleDelete}
              >
                Delete Folder
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary modal-cancel"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
