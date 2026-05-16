import { useState, useRef, useEffect, useCallback } from "react";
import { useFolders } from "@contexts/FoldersContext";
import { Icon } from "@components/Icon.tsx";
import { suggestParent } from "@utils/folder-suggestions";
import type { Folder } from "../../types/index";

interface Props {
  folderId: string;
  currentParentId: string | null | undefined;
  onChange: (newParentId: string | null) => void;
  disabled?: boolean;
  showSuggestions?: boolean;
}

// Collect ids of all descendants of folderId (inclusive) to prevent cycles.
function getDescendantIds(folderId: string, allFolders: Folder[]): Set<string> {
  const ids = new Set<string>([folderId]);
  const queue = [folderId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const f of allFolders) {
      if (f.parent_id === cur) {
        ids.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return ids;
}

// Build a flat, depth-annotated list by walking the tree from `parentId`.
function buildFlatTree(
  folders: Folder[],
  invalidIds: Set<string>,
  search: string,
  parentId: string | null,
  depth: number,
): Array<{ folder: Folder; depth: number; eligible: boolean }> {
  const term = search.toLowerCase();
  const children = folders.filter((f) => (f.parent_id ?? null) === parentId);
  const result: Array<{ folder: Folder; depth: number; eligible: boolean }> =
    [];
  for (const child of children) {
    const eligible = !invalidIds.has(child.id);
    const nameMatch = !term || child.name.toLowerCase().includes(term);
    // Include row when it matches search OR has eligible descendants that may match
    // (keep structure visible); if searching, only include matching rows.
    if (!term || nameMatch) {
      result.push({ folder: child, depth, eligible });
    }
    result.push(
      ...buildFlatTree(folders, invalidIds, search, child.id, depth + 1),
    );
  }
  return result;
}

export function FolderParentSelector({
  folderId,
  currentParentId,
  onChange,
  disabled = false,
  showSuggestions = true,
}: Props) {
  const { folders } = useFolders();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const targetFolder = folders.find((f) => f.id === folderId);
  const invalidIds = getDescendantIds(folderId, folders);
  const currentParent = folders.find((f) => f.id === currentParentId) ?? null;

  const suggestions =
    showSuggestions && targetFolder
      ? suggestParent(targetFolder, folders).filter(
          (s) => s.id !== currentParentId,
        )
      : [];

  // Flat tree for rendering — filtered by search when a term is present
  const rows = buildFlatTree(folders, invalidIds, search, null, 0);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setSearch("");
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [disabled]);

  const select = useCallback(
    (newParentId: string | null) => {
      onChange(newParentId);
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  return (
    <div className="fps-root" ref={dropdownRef}>
      <button
        type="button"
        className={`fps-trigger ${disabled ? "fps-trigger--disabled" : ""}`}
        onClick={openDropdown}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <Icon name="folder" size={14} />
        <span className="fps-trigger-label">
          {currentParent ? currentParent.name : "Top Level"}
        </span>
        <Icon name="chevron-down" size={14} className="fps-chevron" />
      </button>

      {showSuggestions && suggestions.length > 0 && !open && (
        <div className="fps-suggestions">
          <span className="fps-suggestions-label">Suggested:</span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="fps-suggestion-chip"
              onClick={() => select(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fps-dropdown" role="listbox">
          <div className="fps-search-wrap">
            <Icon name="search" size={14} className="fps-search-icon" />
            <input
              ref={searchRef}
              className="fps-search"
              type="text"
              placeholder="Search folders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="fps-list">
            {/* Top-level option */}
            <button
              type="button"
              role="option"
              aria-selected={!currentParentId}
              className={`fps-option fps-option--top ${!currentParentId ? "fps-option--active" : ""}`}
              onClick={() => select(null)}
            >
              <Icon name="layers" size={14} />
              <span>Top Level</span>
            </button>

            {rows.length === 0 && search && (
              <div className="fps-empty">No matching folders</div>
            )}

            {rows.map(({ folder, depth, eligible }) => (
              <button
                key={folder.id}
                type="button"
                role="option"
                aria-selected={currentParentId === folder.id}
                disabled={!eligible}
                className={[
                  "fps-option",
                  currentParentId === folder.id ? "fps-option--active" : "",
                  !eligible ? "fps-option--disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ paddingLeft: `${10 + depth * 16}px` }}
                onClick={() => eligible && select(folder.id)}
              >
                <span
                  className="fps-color-dot"
                  style={{ background: folder.color || "var(--primary-500)" }}
                />
                <span>{folder.name}</span>
                {currentParentId === folder.id && (
                  <Icon name="check" size={12} className="fps-check" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
