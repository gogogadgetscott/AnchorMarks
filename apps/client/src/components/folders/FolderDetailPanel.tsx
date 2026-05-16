import { useState, useCallback } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { Icon } from "@components/Icon.tsx";
import { FolderParentSelector } from "./FolderParentSelector";
import { FolderMetadataEditor } from "./FolderMetadataEditor";
import type { Folder, FolderMetadata } from "../../types/index";

interface Props {
  folder: Folder;
}

export function FolderDetailPanel({ folder }: Props) {
  const { updateFolder, deleteFolder, getRecursiveBookmarkCount } =
    useFolders();
  const { confirm } = useConfirm();

  // key={folder.id} on the parent ensures fresh state on every selection change
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color ?? "#6366f1");
  const [meta, setMeta] = useState<FolderMetadata>(folder.metadata ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const directCount = folder.bookmark_count ?? 0;
  const recursiveCount = getRecursiveBookmarkCount(folder.id);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateFolder(folder.id, {
        name: name.trim() || folder.name,
        color,
        metadata: meta,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [folder.id, folder.name, name, color, meta, updateFolder]);

  const handleDelete = useCallback(async () => {
    const bookmarkWarning =
      recursiveCount > 0
        ? ` ${recursiveCount.toLocaleString()} bookmark${recursiveCount !== 1 ? "s" : ""} will move to Uncategorized.`
        : "";
    const ok = await confirm(
      `Delete "${folder.name}"?${bookmarkWarning} This cannot be undone.`,
      { confirmText: "Delete Folder", destructive: true },
    );
    if (ok) deleteFolder(folder.id);
  }, [folder.id, folder.name, recursiveCount, confirm, deleteFolder]);

  return (
    <div className="fdp-root">
      {/* Header */}
      <div className="fdp-header">
        <span className="fdp-dot" style={{ background: color }} />
        <div className="fdp-header-text">
          <span className="fdp-title">{folder.name}</span>
          <div className="fdp-stats">
            {directCount.toLocaleString()} bookmark
            {directCount !== 1 ? "s" : ""}
            {recursiveCount !== directCount && (
              <span className="fdp-stats-extra">
                {" "}
                · {recursiveCount.toLocaleString()} total incl. subfolders
              </span>
            )}
          </div>
        </div>
      </div>

      <hr className="fdp-divider" />

      {/* Basics */}
      <section className="fdp-section">
        <h3 className="fdp-section-title">Basics</h3>

        <div className="form-group">
          <label htmlFor="fdp-name">Name</label>
          <input
            id="fdp-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>

        <div className="form-group">
          <label htmlFor="fdp-color">Color</label>
          <div className="fdp-color-row">
            <input
              id="fdp-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="fdp-color-input"
            />
            <span className="fdp-color-hex">{color}</span>
          </div>
        </div>

        <div className="form-group">
          <label>Parent Folder</label>
          <p className="fdp-field-hint">Changes apply immediately.</p>
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
      </section>

      <hr className="fdp-divider" />

      {/* Classification */}
      <section className="fdp-section">
        <h3 className="fdp-section-title">Classification</h3>
        <FolderMetadataEditor
          metadata={meta}
          onChange={setMeta}
          disabled={saving}
        />
      </section>

      <hr className="fdp-divider" />

      {/* Notes */}
      <section className="fdp-section">
        <h3 className="fdp-section-title">Notes</h3>
        <textarea
          id="fdp-desc"
          className="fdp-desc"
          placeholder="Add a note about this folder…"
          value={meta.description ?? ""}
          rows={3}
          onChange={(e) =>
            setMeta({ ...meta, description: e.target.value || undefined })
          }
        />
      </section>

      <div className="fdp-actions">
        <button
          type="button"
          className={`btn ${saved ? "btn-success" : "btn-primary"}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={saving}
        >
          <Icon name="trash" size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
