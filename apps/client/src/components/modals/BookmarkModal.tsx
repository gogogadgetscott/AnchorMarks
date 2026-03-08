import { useRef, useEffect, useState } from "react";
import { useModal } from "@contexts/ModalContext";
import { useFolders } from "@contexts/FoldersContext";
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";

const COLOR_OPTIONS = [
  { color: "", label: "No color" },
  { color: "#6366f1", label: "Indigo" },
  { color: "#8b5cf6", label: "Violet" },
  { color: "#ec4899", label: "Pink" },
  { color: "#ef4444", label: "Red" },
  { color: "#f97316", label: "Orange" },
  { color: "#eab308", label: "Yellow" },
  { color: "#22c55e", label: "Green" },
  { color: "#14b8a6", label: "Teal" },
  { color: "#0ea5e9", label: "Blue" },
  { color: "#64748b", label: "Slate" },
];

export default function BookmarkModal() {
  const { closeModal, bookmarkFormData, setBookmarkFormData } = useModal();
  const { folders } = useFolders();
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedColor, setSelectedColor] = useState<string>(
    bookmarkFormData.color || "",
  );
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (modalRef.current) {
      try {
        createFocusTrap(modalRef.current, {
          initialFocus: true,
          onEscape: closeModal,
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
  }, [closeModal]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Form submission will be handled by feature files
    // For now, just close the modal
    closeModal();
  };

  const handleFetchMetadata = async () => {
    if (!bookmarkFormData.url) return;

    setIsFetching(true);
    try {
      // Call to API or feature module to fetch metadata
      // This will be integrated with the existing bookmarks feature
      console.log("Fetching metadata for:", bookmarkFormData.url);
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setBookmarkFormData({ ...bookmarkFormData, color });
  };

  const isEditing = Boolean(bookmarkFormData.id);
  const title = isEditing ? "Edit Bookmark" : "Add Bookmark";

  return (
    <div
      id="bookmark-modal"
      className="modal"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookmark-modal-title"
      tabIndex={-1}
    >
      <div className="modal-backdrop" onClick={closeModal}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="bookmark-modal-title">{title}</h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="submit"
              form="bookmark-form"
              className="btn btn-primary btn-sm"
            >
              Save
            </button>
            <button
              type="button"
              className="btn-icon modal-close"
              onClick={closeModal}
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
        </div>

        <form id="bookmark-form" onSubmit={handleSubmit}>
          {bookmarkFormData.id && (
            <input type="hidden" value={bookmarkFormData.id} />
          )}

          {/* URL field */}
          <div className="form-group">
            <label htmlFor="bookmark-url">URL *</label>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <input
                type="url"
                id="bookmark-url"
                required
                placeholder="https://example.com"
                value={bookmarkFormData.url}
                onChange={(e) =>
                  setBookmarkFormData({
                    ...bookmarkFormData,
                    url: e.target.value,
                  })
                }
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleFetchMetadata}
                disabled={isFetching || !bookmarkFormData.url}
                title="Auto-fetch title and description"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ width: "16px", height: "16px" }}
                >
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                {isFetching ? "Loading..." : "Fetch Info"}
              </button>
            </div>
          </div>

          {/* Title field */}
          <div className="form-group">
            <label htmlFor="bookmark-title">Title</label>
            <input
              type="text"
              id="bookmark-title"
              placeholder="My Awesome Website"
              value={bookmarkFormData.title}
              onChange={(e) =>
                setBookmarkFormData({
                  ...bookmarkFormData,
                  title: e.target.value,
                })
              }
            />
          </div>

          {/* Description field */}
          <div className="form-group">
            <label htmlFor="bookmark-description">Description</label>
            <textarea
              id="bookmark-description"
              rows={2}
              placeholder="A brief description..."
              value={bookmarkFormData.description}
              onChange={(e) =>
                setBookmarkFormData({
                  ...bookmarkFormData,
                  description: e.target.value,
                })
              }
            />
          </div>

          {/* Folder field */}
          <div className="form-group">
            <label htmlFor="bookmark-folder">Folder</label>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <select
                id="bookmark-folder"
                value={bookmarkFormData.folderId || ""}
                onChange={(e) =>
                  setBookmarkFormData({
                    ...bookmarkFormData,
                    folderId: e.target.value || null,
                  })
                }
                style={{ flex: 1, minWidth: 0 }}
              >
                <option value="">None</option>
                {folders.map((folder: any) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary"
                id="bookmark-new-folder-btn"
                style={{
                  height: "38px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                + New Folder
              </button>
            </div>
          </div>

          {/* Tags field */}
          <div className="form-group" style={{ position: "relative" }}>
            <label htmlFor="bookmark-tags-input">Tags</label>
            <div className="tags-input-container" id="tags-input-container">
              <div className="selected-tags" id="selected-tags"></div>
              <input
                type="text"
                id="bookmark-tags-input"
                placeholder="Add tags..."
                autoComplete="off"
                value={bookmarkFormData.tags}
                onChange={(e) =>
                  setBookmarkFormData({
                    ...bookmarkFormData,
                    tags: e.target.value,
                  })
                }
              />
              <input
                type="hidden"
                id="bookmark-tags"
                value={bookmarkFormData.tags}
              />
            </div>
            <div
              className="tag-autocomplete"
              id="tag-autocomplete"
              style={{ display: "none" }}
            ></div>
            <div className="tag-suggestions" id="tag-suggestions"></div>
          </div>

          {/* Color picker */}
          <div className="form-group">
            <label>
              Background Color
              <span
                style={{ color: "var(--text-tertiary)", fontWeight: "normal" }}
              >
                {" "}
                (optional)
              </span>
            </label>
            <div className="color-picker color-picker-bookmark">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.color || "none"}
                  type="button"
                  className={`color-option-bookmark ${
                    selectedColor === option.color ? "active" : ""
                  }`}
                  style={
                    {
                      "--color": option.color || "transparent",
                    } as React.CSSProperties
                  }
                  onClick={() => handleColorSelect(option.color)}
                  title={option.label}
                  data-color={option.color}
                />
              ))}
            </div>
          </div>

          {/* Smart suggestions */}
          <div
            className="form-group"
            id="smart-collections-suggestions"
            style={{ display: "none" }}
          ></div>

          {/* Modal footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary modal-cancel"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Bookmark
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
