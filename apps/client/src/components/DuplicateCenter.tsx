import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@services/api.ts";
import { showConfirm } from "@contexts/ConfirmContext";
import { showToast } from "@contexts/ToastContext";
import { useBookmarks } from "@contexts/BookmarksContext";
import { Icon } from "./Icon.tsx";

interface DuplicateBookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  folder_id?: string;
  is_favorite?: number;
  created_at?: string;
  tags?: string[];
}

interface DuplicateGroup {
  canonical_url: string;
  match_type: "url" | "title";
  count: number;
  bookmarks: DuplicateBookmark[];
}

export function DuplicateCenter() {
  const { clearViewCache, loadBookmarks } = useBookmarks();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [search, setSearch] = useState("");
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const loadDuplicates = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api<{
        duplicates: DuplicateGroup[];
      }>("/health/duplicates");
      setGroups(response.duplicates);
      const defaults: Record<string, string> = {};
      response.duplicates.forEach((group) => {
        const newest = [...group.bookmarks].sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || "")),
        )[0];
        defaults[group.canonical_url] = newest?.id;
      });
      setKeepers(defaults);
    } catch (error) {
      showToast(
        (error as Error).message || "Failed to load duplicates",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDuplicates();
  }, [loadDuplicates]);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter(
      (group) =>
        group.canonical_url.toLowerCase().includes(term) ||
        group.bookmarks.some(
          (bookmark) =>
            bookmark.title.toLowerCase().includes(term) ||
            bookmark.url.toLowerCase().includes(term),
        ),
    );
  }, [groups, search]);

  const resolveGroup = async (group: DuplicateGroup, keepId: string) => {
    const keeper = group.bookmarks.find((bookmark) => bookmark.id === keepId);
    const mergeIds = group.bookmarks
      .filter((bookmark) => bookmark.id !== keepId)
      .map((bookmark) => bookmark.id);
    if (!keeper || mergeIds.length === 0) return;

    const confirmed = await showConfirm(
      `Keep "${keeper.title}" and merge ${mergeIds.length} duplicate${mergeIds.length === 1 ? "" : "s"} into it? Tags, favorites, folder, reading status, and saved metadata will be preserved.`,
      {
        title: "Resolve Duplicate Group",
        confirmText: "Keep & Merge",
        destructive: true,
      },
    );
    if (!confirmed) return;

    setIsBusy(true);
    try {
      await api("/health/duplicates/resolve", {
        method: "POST",
        body: JSON.stringify({ keep_id: keepId, merge_ids: mergeIds }),
      });
      showToast("Duplicate group resolved", "success");
      clearViewCache();
      await loadBookmarks();
      await loadDuplicates();
    } catch (error) {
      showToast(
        (error as Error).message || "Failed to resolve duplicates",
        "error",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const keepNewest = async (group: DuplicateGroup) => {
    const newest = [...group.bookmarks].sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || "")),
    )[0];
    if (newest) await resolveGroup(group, newest.id);
  };

  const keepOldest = async (group: DuplicateGroup) => {
    const oldest = [...group.bookmarks].sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || "")),
    )[0];
    if (oldest) await resolveGroup(group, oldest.id);
  };

  return (
    <div className="duplicate-center">
      <div className="organization-header">
        <div className="organization-title">
          <Icon name="copy" size={20} />
          <div>
            <h1>Duplicates</h1>
            <p>
              {groups.length} duplicate group{groups.length === 1 ? "" : "s"} ·{" "}
              {groups.reduce((total, group) => total + group.count - 1, 0)}{" "}
              removable bookmarks
            </p>
          </div>
        </div>
      </div>

      <div className="organization-toolbar">
        <label className="organization-search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search duplicate URLs or titles…"
            aria-label="Search duplicates"
          />
        </label>
      </div>

      {isLoading ? (
        <div className="organization-empty">
          <p>Scanning for duplicates…</p>
        </div>
      ) : (
        <div className="duplicate-group-list">
          {visibleGroups.map((group) => (
            <section className="duplicate-group" key={group.canonical_url}>
              <div className="duplicate-group-header">
                <div>
                  <span className="badge">
                    {group.match_type === "url" ? "Same URL" : "Similar title"}
                  </span>
                  <strong>{group.canonical_url}</strong>
                  <small>{group.count} bookmarks</small>
                </div>
                <div className="duplicate-group-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={isBusy}
                    onClick={() => void keepNewest(group)}
                  >
                    Keep Newest
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={isBusy}
                    onClick={() => void keepOldest(group)}
                  >
                    Keep Oldest
                  </button>
                </div>
              </div>
              <div className="duplicate-bookmark-list">
                {group.bookmarks.map((bookmark) => (
                  <label
                    className={`duplicate-bookmark ${keepers[group.canonical_url] === bookmark.id ? "selected" : ""}`}
                    key={bookmark.id}
                  >
                    <input
                      type="radio"
                      name={`keep-${group.canonical_url}`}
                      checked={keepers[group.canonical_url] === bookmark.id}
                      onChange={() =>
                        setKeepers((previous) => ({
                          ...previous,
                          [group.canonical_url]: bookmark.id,
                        }))
                      }
                    />
                    <div>
                      <strong>{bookmark.title}</strong>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {bookmark.url}
                      </a>
                      {bookmark.description && <p>{bookmark.description}</p>}
                      {Array.isArray(bookmark.tags) &&
                        bookmark.tags.length > 0 && (
                          <span className="duplicate-tags">
                            {bookmark.tags.join(", ")}
                          </span>
                        )}
                    </div>
                  </label>
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm duplicate-keep-selected"
                disabled={isBusy || !keepers[group.canonical_url]}
                onClick={() =>
                  void resolveGroup(group, keepers[group.canonical_url])
                }
              >
                Keep Selected &amp; Merge
              </button>
            </section>
          ))}
          {visibleGroups.length === 0 && (
            <div className="organization-empty">
              <Icon name="check" size={32} />
              <p>
                {groups.length === 0
                  ? "No duplicate bookmarks found."
                  : "No duplicate groups match your search."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
