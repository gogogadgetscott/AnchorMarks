import { useRef, useEffect, useState, useCallback } from "react";
import { useModal } from "@contexts/ModalContext";
import { useFolders } from "@contexts/FoldersContext";
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";
import { fetchMetadata } from "@features/bookmarks/bookmarks.ts";
import { useBookmarkActions } from "@/contexts/useBookmarkActions";
import { SmartTagSuggestions } from "@components/SmartTagSuggestions";

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
  const { closeModal, bookmarkFormData, setBookmarkFormData, openFolderModal } =
    useModal();
  const { folders, currentFolder } = useFolders();
  const { createBookmark, updateBookmark } = useBookmarkActions();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [hasAIResults, setHasAIResults] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  const defaultFolderApplied = useRef(false);

  // Default to the currently active folder when creating a new bookmark
  useEffect(() => {
    if (
      !defaultFolderApplied.current &&
      !bookmarkFormData.id &&
      bookmarkFormData.folderId === null &&
      currentFolder
    ) {
      defaultFolderApplied.current = true;
      setBookmarkFormData({ folderId: currentFolder });
    }
  }, [bookmarkFormData.id, bookmarkFormData.folderId, currentFolder, setBookmarkFormData]);

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

  // Close folder dropdown on outside click
  useEffect(() => {
    if (!folderDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        folderDropdownRef.current &&
        !folderDropdownRef.current.contains(e.target as Node)
      ) {
        setFolderDropdownOpen(false);
        setFolderSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [folderDropdownOpen]);

  const selectedFolderName =
    folders.find((f: any) => f.id === bookmarkFormData.folderId)?.name ?? null;

  const filteredFolders = folders.filter((f: any) =>
    f.name.toLowerCase().includes(folderSearch.toLowerCase()),
  );

  const handleFolderSelect = useCallback(
    (id: string | null) => {
      setBookmarkFormData({ ...bookmarkFormData, folderId: id });
      setFolderDropdownOpen(false);
      setFolderSearch("");
    },
    [bookmarkFormData, setBookmarkFormData],
  );

  const handleFolderInputFocus = useCallback(() => {
    setFolderDropdownOpen(true);
    setFolderSearch("");
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = {
      url: bookmarkFormData.url,
      title: bookmarkFormData.title,
      description: bookmarkFormData.description,
      folder_id: bookmarkFormData.folderId || undefined,
      color: bookmarkFormData.color,
      tags: bookmarkFormData.tags,
    };

    if (bookmarkFormData.id) {
      await updateBookmark(bookmarkFormData.id, data);
    } else {
      await createBookmark(data);
    }
    // createBookmark/updateBookmark handle state update, closeModal, and toast
  };

  const handleNewFolderClick = () => {
    // Save current bookmark data, open folder modal,
    // and set a flag to return to bookmark modal after folder creation
    const currentBookmarkData = { ...bookmarkFormData };
    openFolderModal();

    // Store context so we can reopen bookmark modal after folder creation
    sessionStorage.setItem(
      "returnToBookmarkModal",
      JSON.stringify(currentBookmarkData),
    );
  };

  const handleFetchMetadata = async () => {
    if (!bookmarkFormData.url) return;

    setIsFetching(true);
    try {
      const metadata = await fetchMetadata(bookmarkFormData.url);
      setBookmarkFormData({
        title: metadata.title || bookmarkFormData.title,
        description: metadata.description || bookmarkFormData.description,
      });

      setHasAIResults(false);
      setIsAILoading(false);
      setShowSuggestions(true);
    } catch (error) {
      // Error handling is done in fetchMetadata (logger)
      // and createBookmark/updateBookmark (toast)
    } finally {
      setIsFetching(false);
    }
  };

  const handleColorSelect = (color: string) => {
    setBookmarkFormData({ color });
  };

  const handleTagClick = (tag: string) => {
    // Add tag to existing tags, avoid duplicates
    const currentTags = bookmarkFormData.tags
      ? bookmarkFormData.tags.split(",").map((t) => t.trim())
      : [];

    if (!currentTags.includes(tag)) {
      const newTags = [...currentTags, tag].join(", ");
      setBookmarkFormData({ tags: newTags });
    }
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
                title="Auto-fetch title and description, and AI tag suggestions"
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
                {isFetching
                  ? "Loading..."
                  : isAILoading
                    ? "Fetch Info · AI…"
                    : hasAIResults
                      ? "Fetch Info · AI"
                      : "Fetch Info"}
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
            <label htmlFor="bookmark-folder-input">Folder</label>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}
            >
              <div
                ref={folderDropdownRef}
                style={{ flex: 1, minWidth: 0, position: "relative" }}
              >
                <input
                  ref={folderInputRef}
                  id="bookmark-folder-input"
                  type="text"
                  autoComplete="off"
                  placeholder="Search folders…"
                  value={
                    folderDropdownOpen
                      ? folderSearch
                      : (selectedFolderName ?? "")
                  }
                  onFocus={handleFolderInputFocus}
                  onChange={(e) => setFolderSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setFolderDropdownOpen(false);
                      setFolderSearch("");
                    }
                  }}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                {folderDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      zIndex: 100,
                      maxHeight: "180px",
                      overflowY: "auto",
                    }}
                  >
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleFolderSelect(null)}
                      style={{
                        padding: "0.5rem 1rem",
                        cursor: "pointer",
                        color: bookmarkFormData.folderId === null ? "var(--primary-500)" : "var(--text-tertiary)",
                        fontStyle: "italic",
                      }}
                      className="folder-dropdown-option"
                    >
                      None
                    </div>
                    {filteredFolders.length === 0 && (
                      <div style={{ padding: "0.5rem 1rem", color: "var(--text-tertiary)", fontStyle: "italic" }}>
                        No folders found
                      </div>
                    )}
                    {filteredFolders.map((folder: any) => (
                      <div
                        key={folder.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleFolderSelect(folder.id)}
                        style={{
                          padding: "0.5rem 1rem",
                          cursor: "pointer",
                          fontWeight: bookmarkFormData.folderId === folder.id ? 600 : undefined,
                          color: bookmarkFormData.folderId === folder.id ? "var(--primary-500)" : "var(--text-primary)",
                        }}
                        className="folder-dropdown-option"
                      >
                        {folder.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                id="bookmark-new-folder-btn"
                onClick={handleNewFolderClick}
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
            {showSuggestions && bookmarkFormData.url && (
              <SmartTagSuggestions
                url={bookmarkFormData.url}
                onTagClick={handleTagClick}
                enabled={true}
                onAIStatusChange={(loading, hasResults) => {
                  setIsAILoading(loading);
                  if (hasResults) setHasAIResults(true);
                }}
              />
            )}
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
                    bookmarkFormData.color === option.color ? "active" : ""
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
