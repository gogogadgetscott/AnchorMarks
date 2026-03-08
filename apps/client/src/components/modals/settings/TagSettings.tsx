import { useState, useEffect } from "react";
import {
  fetchTagStats,
  renameTagAcross,
  deleteTagById,
} from "@features/bookmarks/search.ts";
import { openTagModal } from "@utils/modal-controller.ts";
import { showToast } from "@utils/ui-helpers.ts";
import { confirmDialog } from "@features/ui/confirm-dialog.ts";

interface TagStatItem {
  id: string;
  name: string;
  count: number;
  color?: string;
  parent?: string;
}

export function TagSettings() {
  const [tags, setTags] = useState<TagStatItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTagStats();
      setTags(data as TagStatItem[]);
    } catch (err) {
      console.error("Failed to load tag stats", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRename = async () => {
    if (!renameFrom || !renameTo) {
      showToast("Enter both tags to rename", "error");
      return;
    }

    if (
      !(await confirmDialog(`Rename tag "${renameFrom}" to "${renameTo}"?`, {
        title: "Rename Tag",
      }))
    ) {
      return;
    }

    try {
      await renameTagAcross(renameFrom, renameTo);
      setRenameFrom("");
      setRenameTo("");
      loadStats();
    } catch (err: any) {
      showToast(err.message || "Rename failed", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !(await confirmDialog(`Delete tag "${name}"?`, {
        title: "Delete Tag",
        destructive: true,
      }))
    ) {
      return;
    }

    try {
      await deleteTagById(id, name);
      loadStats();
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error");
    }
  };

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="tag-settings">
      <div className="settings-section">
        <h4>Rename Tags</h4>
        <p
          className="text-tertiary"
          style={{ fontSize: "0.85rem", marginBottom: "1rem" }}
        >
          This will update all bookmarks using the old tag.
        </p>
        <div
          className="rename-form"
          style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
        >
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>From</label>
            <input
              type="text"
              className="form-input"
              placeholder="Old tag"
              value={renameFrom}
              onChange={(e) => setRenameFrom(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>→</div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label>To</label>
            <input
              type="text"
              className="form-input"
              placeholder="New tag"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleRename}>
            Rename
          </button>
        </div>
      </div>

      <div className="settings-section" style={{ marginTop: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h4 style={{ margin: 0 }}>All Tags</h4>
          <input
            type="text"
            className="form-input"
            placeholder="Search tags..."
            style={{ width: "200px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-tertiary">Loading tags...</div>
        ) : filteredTags.length === 0 ? (
          <div className="text-tertiary">No tags found</div>
        ) : (
          <div
            className="tag-stats-list-react"
            style={{ maxHeight: "400px", overflowY: "auto" }}
          >
            {filteredTags.map((tag) => (
              <div
                key={tag.id}
                className="tag-stat-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.5rem",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      className="tag-dot"
                      style={{
                        backgroundColor: tag.color || "var(--text-secondary)",
                      }}
                    ></span>
                    {tag.name}
                  </div>
                  {tag.parent && (
                    <div
                      className="tag-path"
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {tag.parent}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span className="badge">{tag.count}</span>
                  <button
                    className="btn-icon btn-sm"
                    onClick={() =>
                      openTagModal({
                        id: tag.id,
                        name: tag.name,
                        color: tag.color,
                      })
                    }
                    title="Edit tag"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    className="btn-icon btn-sm text-danger"
                    onClick={() => handleDelete(tag.id, tag.name)}
                    title="Delete tag"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                      <path d="M10 11v6"></path>
                      <path d="M14 11v6"></path>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
