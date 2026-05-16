import { useState, useCallback } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { FolderParentSelector } from "./FolderParentSelector";
import { FolderMetadataEditor } from "./FolderMetadataEditor";
import type { Folder, FolderMetadata } from "../../types/index";

interface Props {
  folder: Folder;
}

export function FolderDetailPanel({ folder }: Props) {
  const { updateFolder, deleteFolder, getRecursiveBookmarkCount } = useFolders();

  // key={folder.id} on the parent ensures fresh state on every selection change
  const [name, setName] = useState(folder.name);
  const [color, setColor] = useState(folder.color ?? "#6366f1");
  const [meta, setMeta] = useState<FolderMetadata>(folder.metadata ?? {});
  const [saving, setSaving] = useState(false);

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
    } finally {
      setSaving(false);
    }
  }, [folder.id, folder.name, name, color, meta, updateFolder]);

  return (
    <div className="fdp-root">
      <div className="fdp-header">
        <span className="fdp-dot" style={{ background: color }} />
        <span className="fdp-title">{folder.name}</span>
      </div>

      <div className="fdp-stats">
        <span>{directCount.toLocaleString()} bookmark{directCount !== 1 ? "s" : ""}</span>
        {recursiveCount !== directCount && (
          <span className="fdp-stats-extra">
            &nbsp;· {recursiveCount.toLocaleString()} total incl. subfolders
          </span>
        )}
      </div>

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
        <label htmlFor="fdp-desc">Description</label>
        <textarea
          id="fdp-desc"
          className="fdp-desc"
          placeholder="Add a description…"
          value={meta.description ?? ""}
          rows={3}
          onChange={(e) =>
            setMeta({ ...meta, description: e.target.value || undefined })
          }
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

      <div className="fdp-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => deleteFolder(folder.id)}
          disabled={saving}
        >
          <Icon name="trash" size={14} />
          Delete
        </button>
      </div>
    </div>
  );
}
