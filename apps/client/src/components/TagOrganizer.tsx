import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookmarks } from "@contexts/BookmarksContext";
import { showConfirm } from "@contexts/ConfirmContext";
import { showToast } from "@contexts/ToastContext";
import { openTagModal } from "@utils/modal-controller.ts";
import { api } from "@services/api.ts";
import { Icon } from "./Icon.tsx";

interface ManagedTag {
  id: string;
  name: string;
  count: number;
  color?: string;
}

interface ManagedAlias {
  id: string;
  alias: string;
  canonical_name: string;
}

interface NormalizationGroup {
  key: string;
  target: string;
  variants: Array<{ id: string; name: string; count: number }>;
}

type TagFilter = "all" | "unused" | "similar";

export function TagOrganizer() {
  const { fetchTagStats, refreshTagData, tagMetadata } = useBookmarks();
  const [tags, setTags] = useState<ManagedTag[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TagFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [aliases, setAliases] = useState<ManagedAlias[]>([]);
  const [normalizationGroups, setNormalizationGroups] = useState<
    NormalizationGroup[]
  >([]);
  const [aliasName, setAliasName] = useState("");
  const [canonicalName, setCanonicalName] = useState("");

  const loadTags = useCallback(async () => {
    const data = await fetchTagStats();
    setTags(
      data.map((tag) => ({
        id: tag.id,
        name: tag.name,
        count: tag.count,
        color: tag.color,
      })),
    );
  }, [fetchTagStats]);

  const loadAliases = useCallback(async () => {
    try {
      const [aliasData, previewData] = await Promise.all([
        api<ManagedAlias[]>("/tags/aliases"),
        api<{ groups: NormalizationGroup[] }>("/tags/normalize-preview"),
      ]);
      setAliases(aliasData);
      setNormalizationGroups(previewData.groups || []);
    } catch (error) {
      showToast(
        (error as Error).message || "Failed to load tag aliases",
        "error",
      );
    }
  }, []);

  useEffect(() => {
    void loadTags();
    void loadAliases();
  }, [loadAliases, loadTags, tagMetadata]);

  const duplicateIds = useMemo(() => {
    const groups = new Map<string, string[]>();
    tags.forEach((tag) => {
      const key = tag.name
        .trim()
        .toLowerCase()
        .replace(/[-_\s]+/g, " ");
      groups.set(key, [...(groups.get(key) ?? []), tag.id]);
    });
    return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
  }, [tags]);

  const visibleTags = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tags.filter((tag) => {
      if (term && !tag.name.toLowerCase().includes(term)) return false;
      if (filter === "unused" && tag.count !== 0) return false;
      if (filter === "similar" && !duplicateIds.has(tag.id)) return false;
      return true;
    });
  }, [duplicateIds, filter, search, tags]);

  const selectedTags = tags.filter((tag) => selected.has(tag.id));
  const target = tags.find((tag) => tag.id === mergeTarget);

  const toggleSelected = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMerge = async () => {
    if (!target || selected.size < 2) return;
    const sources = selectedTags.filter((tag) => tag.id !== target.id);
    const confirmed = await showConfirm(
      `Merge ${sources.length} tag${sources.length === 1 ? "" : "s"} into "${target.name}"? The source tags will be deleted and all bookmark usage will be preserved.`,
      { title: "Merge Tags", confirmText: "Merge Tags" },
    );
    if (!confirmed) return;

    setIsBusy(true);
    let changed = false;
    try {
      for (const source of sources) {
        await api("/tags/rename", {
          method: "POST",
          body: JSON.stringify({ from: source.name, to: target.name }),
        });
        changed = true;
      }
      setSelected(new Set());
      setMergeTarget("");
      showToast("Tags merged", "success");
    } catch (error) {
      showToast((error as Error).message || "Failed to merge tags", "error");
    } finally {
      try {
        if (changed) {
          await refreshTagData();
          await loadTags();
        }
      } catch (error) {
        showToast(
          (error as Error).message || "Failed to refresh tags",
          "error",
        );
      } finally {
        setIsBusy(false);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    const bookmarkTotal = selectedTags.reduce(
      (total, tag) => total + tag.count,
      0,
    );
    const confirmed = await showConfirm(
      `Delete ${selected.size} tag${selected.size === 1 ? "" : "s"}? They will be removed from ${bookmarkTotal} bookmark use${bookmarkTotal === 1 ? "" : "s"}.`,
      {
        title: "Delete Tags",
        confirmText: `Delete ${selected.size}`,
        destructive: true,
      },
    );
    if (!confirmed) return;

    setIsBusy(true);
    let changed = false;
    try {
      for (const tag of selectedTags) {
        await api(`/tags/${tag.id}`, { method: "DELETE" });
        changed = true;
      }
      setSelected(new Set());
      showToast("Tags deleted", "success");
    } catch (error) {
      showToast((error as Error).message || "Failed to delete tags", "error");
    } finally {
      try {
        if (changed) {
          await refreshTagData();
          await loadTags();
        }
      } catch (error) {
        showToast(
          (error as Error).message || "Failed to refresh tags",
          "error",
        );
      } finally {
        setIsBusy(false);
      }
    }
  };

  const handleCreateAlias = async () => {
    if (!aliasName.trim() || !canonicalName.trim()) return;
    setIsBusy(true);
    try {
      await api("/tags/aliases", {
        method: "POST",
        body: JSON.stringify({
          alias: aliasName.trim(),
          canonical: canonicalName.trim(),
        }),
      });
      setAliasName("");
      setCanonicalName("");
      await loadAliases();
      await refreshTagData();
      showToast("Tag alias created", "success");
    } catch (error) {
      showToast((error as Error).message || "Failed to create alias", "error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteAlias = async (alias: ManagedAlias) => {
    const confirmed = await showConfirm(
      `Delete alias "${alias.alias}"? It will no longer resolve to "${alias.canonical_name}".`,
      { title: "Delete Tag Alias", destructive: true },
    );
    if (!confirmed) return;
    try {
      await api(`/tags/aliases/${alias.id}`, { method: "DELETE" });
      await loadAliases();
      showToast("Tag alias deleted", "success");
    } catch (error) {
      showToast((error as Error).message || "Failed to delete alias", "error");
    }
  };

  const handleNormalize = async () => {
    if (normalizationGroups.length === 0) return;
    const confirmed = await showConfirm(
      `Normalize ${normalizationGroups.length} tag group${normalizationGroups.length === 1 ? "" : "s"}? Similar case, underscore, dash, and spacing variants will be merged transactionally.`,
      { title: "Normalize Tags", confirmText: "Normalize Tags" },
    );
    if (!confirmed) return;
    setIsBusy(true);
    try {
      await api("/tags/normalize", { method: "POST" });
      await loadTags();
      await loadAliases();
      await refreshTagData();
      showToast("Tags normalized", "success");
    } catch (error) {
      showToast(
        (error as Error).message || "Failed to normalize tags",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="tag-organizer">
      <div className="organization-header">
        <div className="organization-title">
          <Icon name="tag" size={20} />
          <div>
            <h1>Tags</h1>
            <p>
              {tags.length} tags ·{" "}
              {tags.reduce((total, tag) => total + tag.count, 0)} bookmark uses
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openTagModal("")}
        >
          <Icon name="plus" size={15} />
          New Tag
        </button>
      </div>

      <div className="organization-toolbar">
        <label className="organization-search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tags…"
            aria-label="Search tags"
          />
        </label>
        <div className="organization-filters" aria-label="Tag filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={filter === "unused" ? "active" : ""}
            onClick={() => setFilter("unused")}
          >
            Unused ({tags.filter((tag) => tag.count === 0).length})
          </button>
          <button
            className={filter === "similar" ? "active" : ""}
            onClick={() => setFilter("similar")}
            disabled={duplicateIds.size === 0}
          >
            Similar names ({duplicateIds.size})
          </button>
        </div>

        <section className="tag-alias-panel">
          <div className="tag-alias-panel-header">
            <div>
              <h2>Aliases &amp; normalization</h2>
              <p>
                Map variants to one canonical tag automatically during create,
                import, sync, and bulk operations.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={isBusy || normalizationGroups.length === 0}
              onClick={() => void handleNormalize()}
            >
              Normalize ({normalizationGroups.length})
            </button>
          </div>

          <div className="tag-alias-form">
            <input
              type="text"
              className="form-input"
              value={aliasName}
              onChange={(event) => setAliasName(event.target.value)}
              placeholder="Alias, e.g. js"
              aria-label="Tag alias"
            />
            <span aria-hidden="true">→</span>
            <input
              type="text"
              className="form-input"
              value={canonicalName}
              onChange={(event) => setCanonicalName(event.target.value)}
              placeholder="Canonical tag, e.g. javascript"
              aria-label="Canonical tag"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isBusy || !aliasName.trim() || !canonicalName.trim()}
              onClick={() => void handleCreateAlias()}
            >
              Add Alias
            </button>
          </div>

          {normalizationGroups.length > 0 && (
            <div className="tag-normalization-preview">
              {normalizationGroups.slice(0, 6).map((group) => (
                <span key={group.key}>
                  {group.variants.map((variant) => variant.name).join(" / ")}
                  <strong>→ {group.target}</strong>
                </span>
              ))}
            </div>
          )}

          {aliases.length > 0 && (
            <div className="tag-alias-list">
              {aliases.map((alias) => (
                <div className="tag-alias-row" key={alias.id}>
                  <strong>{alias.alias}</strong>
                  <span>→</span>
                  <span>{alias.canonical_name}</span>
                  <button
                    type="button"
                    className="btn-icon btn-sm text-danger"
                    title={`Delete alias ${alias.alias}`}
                    onClick={() => void handleDeleteAlias(alias)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected.size > 0 && (
        <div className="organization-bulk-bar">
          <strong>{selected.size} selected</strong>
          {selected.size >= 2 && (
            <>
              <label>
                Keep
                <select
                  value={mergeTarget}
                  onChange={(event) => setMergeTarget(event.target.value)}
                  aria-label="Tag to keep when merging"
                >
                  <option value="">Choose merge target…</option>
                  {selectedTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!mergeTarget || isBusy}
                onClick={() => void handleMerge()}
              >
                Merge
              </button>
            </>
          )}
          <button
            className="btn btn-danger btn-sm"
            disabled={isBusy}
            onClick={() => void handleBulkDelete()}
          >
            Delete
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      <div className="tag-organizer-list">
        {visibleTags.map((tag) => (
          <div
            key={tag.id}
            className={`tag-organizer-row ${selected.has(tag.id) ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              checked={selected.has(tag.id)}
              onChange={() => toggleSelected(tag.id)}
              aria-label={`Select ${tag.name}`}
            />
            <span
              className="tag-organizer-dot"
              style={{ background: tag.color || "#f59e0b" }}
            />
            <button
              type="button"
              className="tag-organizer-name"
              onClick={() => openTagModal(tag)}
            >
              {tag.name}
            </button>
            <span className="badge">
              {tag.count} bookmark{tag.count === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="btn-icon btn-sm"
              title={`Edit ${tag.name}`}
              aria-label={`Edit ${tag.name}`}
              onClick={() => openTagModal(tag)}
            >
              <Icon name="edit" size={14} />
            </button>
          </div>
        ))}
        {visibleTags.length === 0 && (
          <div className="organization-empty">
            <Icon name="tag" size={32} />
            <p>No tags match this view.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => openTagModal("")}
            >
              Create your first tag
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
