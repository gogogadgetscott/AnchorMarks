import React, { memo, useState, useCallback, useEffect } from "react";
import { Icon } from "../components/Icon";
import { Button } from "../components/Button";
import type { Bookmark } from "../types";

interface BookmarkModalProps {
  bookmark?: Bookmark | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bookmark: Partial<Bookmark>) => Promise<void>;
  onFetchMetadata?: (
    url: string,
  ) => Promise<{ title?: string; description?: string }>;
}

export const BookmarkModal = memo<BookmarkModalProps>(
  ({ bookmark, isOpen, onClose, onSave, onFetchMetadata }) => {
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState("");
    const [folderId, setFolderId] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetchingMetadata, setFetchingMetadata] = useState(false);

    useEffect(() => {
      if (bookmark) {
        setUrl(bookmark.url || "");
        setTitle(bookmark.title || "");
        setDescription(bookmark.description || "");
        setTags(bookmark.tags || "");
        setFolderId(bookmark.folder_id || "");
      } else {
        setUrl("");
        setTitle("");
        setDescription("");
        setTags("");
        setFolderId("");
      }
    }, [bookmark, isOpen]);

    const handleFetchMetadata = useCallback(async () => {
      if (!url || !onFetchMetadata) return;

      setFetchingMetadata(true);
      try {
        const metadata = await onFetchMetadata(url);
        if (metadata.title) setTitle(metadata.title);
        if (metadata.description) setDescription(metadata.description);
      } catch (err) {
        console.error("Failed to fetch metadata:", err);
      } finally {
        setFetchingMetadata(false);
      }
    }, [url, onFetchMetadata]);

    const handleSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
          await onSave({
            id: bookmark?.id,
            url,
            title,
            description,
            tags,
            folder_id: folderId || null,
          });
          onClose();
        } catch (err) {
          console.error("Failed to save bookmark:", err);
        } finally {
          setLoading(false);
        }
      },
      [bookmark, url, title, description, tags, folderId, onSave, onClose],
    );

    if (!isOpen) return null;

    return (
      <div id="bookmark-modal" className="modal">
        <div className="modal-backdrop" onClick={onClose} />
        <div className="modal-content">
          <div className="modal-header">
            <h2>{bookmark ? "Edit Bookmark" : "Add Bookmark"}</h2>
            <Button variant="icon" onClick={onClose} className="modal-close">
              <Icon name="close" />
            </Button>
          </div>

          <form id="bookmark-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="bookmark-url">URL *</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="url"
                  id="bookmark-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  placeholder="https://example.com"
                  style={{ flex: 1 }}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFetchMetadata}
                  loading={fetchingMetadata}
                  disabled={!url || fetchingMetadata}
                  title="Auto-fetch title and description"
                >
                  <Icon name="refresh" size={16} />
                </Button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="bookmark-title">Title *</label>
              <input
                type="text"
                id="bookmark-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Page title"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bookmark-description">Description</label>
              <textarea
                id="bookmark-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bookmark-tags">Tags</label>
              <input
                type="text"
                id="bookmark-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                disabled={loading}
              />
              <small className="form-help">Separate tags with commas</small>
            </div>

            <div className="form-group">
              <label htmlFor="bookmark-folder">Folder</label>
              <select
                id="bookmark-folder"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                disabled={loading}
              >
                <option value="">No folder</option>
                {/* Folders will be populated dynamically */}
              </select>
            </div>

            <div className="modal-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={loading || !url || !title}
              >
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  },
);

BookmarkModal.displayName = "BookmarkModal";
