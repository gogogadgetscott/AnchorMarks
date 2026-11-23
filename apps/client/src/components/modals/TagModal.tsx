import { useRef, useEffect } from "react";
import { useModal } from "@contexts/ModalContext";
import { useBookmarks } from "@contexts/BookmarksContext";
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";

const TAG_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#6366f1",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#64748b",
];

export default function TagModal() {
  const { closeModal, tagFormData, setTagFormData } = useModal();
  const { createTag, renameTag, updateTag, deleteTag, tagMetadata } =
    useBookmarks();
  const modalRef = useRef<HTMLDivElement>(null);

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
    if (!tagFormData.name.trim()) return;
    if (tagFormData.id) {
      let persistedTagId = tagFormData.id;
      if (
        tagFormData.originalName &&
        tagFormData.originalName !== tagFormData.name
      ) {
        await renameTag(tagFormData.originalName, tagFormData.name);
        const destination = Object.entries(tagMetadata).find(
          ([name]) =>
            name.toLowerCase() === tagFormData.name.toLowerCase() &&
            name !== tagFormData.originalName,
        )?.[1];
        if (destination?.id) persistedTagId = destination.id;
      }
      await updateTag(persistedTagId, tagFormData.name, tagFormData.color);
    } else {
      const created = await createTag(tagFormData.name, tagFormData.color);
      if (!created) return;
    }
    closeModal();
  };

  const handleDelete = async () => {
    if (tagFormData.id && tagFormData.name) {
      if (await deleteTag(tagFormData.id, tagFormData.name)) closeModal();
    }
  };

  const handleColorSelect = (color: string) => {
    setTagFormData({ color });
  };

  return (
    <div
      id="tag-modal"
      className="modal"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-modal-title"
      tabIndex={-1}
    >
      <div className="modal-backdrop" onClick={closeModal}></div>
      <div className="modal-content modal-sm">
        <div className="modal-header">
          <h2 id="tag-modal-title">
            {tagFormData.id ? "Edit Tag" : "New Tag"}
          </h2>
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

        <form id="tag-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="tag-name">Tag Name *</label>
            <input
              type="text"
              id="tag-name"
              required
              placeholder="design"
              value={tagFormData.name}
              onChange={(e) =>
                setTagFormData({ ...tagFormData, name: e.target.value })
              }
            />
          </div>

          <div className="form-group">
            <label>Color</label>
            <div className="color-picker-tag">
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option-tag ${
                    tagFormData.color === color ? "active" : ""
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
            {tagFormData.id && (
              <button
                type="button"
                className="btn btn-outline-danger"
                id="delete-tag-btn"
                style={{ marginRight: "auto" }}
                onClick={handleDelete}
                disabled={!tagFormData.name}
              >
                Delete Tag
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
              {tagFormData.id ? "Save Tag" : "Create Tag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
