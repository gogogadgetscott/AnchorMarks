import { useMemo, useEffect, useRef, useCallback } from "react";
import { api } from "@services/api.ts";
import { BOOKMARKS_PER_PAGE, useBookmarks } from "@/contexts/index.ts";
import { useUI } from "@/contexts/index.ts";
import { BookmarkCard } from "./BookmarkCard.tsx";
import { RichBookmarkCard } from "./RichBookmarkCard.tsx";
import { SkeletonCard } from "./SkeletonCard.tsx";
import type { Bookmark } from "../types/index";
// TODO (Phase 7): Replace these imports with context-based action handlers
// once the modal and CRUD systems are ported to React.
import {
  deleteBookmark,
  archiveBookmark,
  unarchiveBookmark,
  toggleFavorite,
  editBookmark,
} from "@features/bookmarks/bookmarks.ts";

const SKELETON_COUNT = 6;

// Extracts a bookmark's tags as a normalized string array (mirrors renderBookmarks logic)
function getNormalizedTags(bookmark: Bookmark): string[] {
  const raw = bookmark.tags;
  if (!raw) return [];
  if (Array.isArray(raw))
    return raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  return String(raw)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

interface FilterConfig {
  sort: string;
  tags: string[];
  tagMode: "AND" | "OR";
  search?: string;
}

// Client-side filtering and sorting — mirrors renderBookmarks() from bookmarks.ts
function applyFilters(
  bookmarks: Bookmark[],
  currentView: string,
  filterConfig: FilterConfig,
  displayedCount: number,
): Bookmark[] {
  let result = [...bookmarks];

  // Server-handled views: no client-side filtering, just slice
  if (
    currentView === "favorites" ||
    currentView === "archived" ||
    currentView === "recent" ||
    currentView === "most-used"
  ) {
    if (currentView === "recent") result = result.slice(0, 20);
    if (currentView === "most-used")
      result = result.filter((b) => (b.click_count || 0) > 0);
    return result.slice(0, displayedCount);
  }

  // Search filter (skip when server already applied it)
  const serverFilteredSearch =
    !!filterConfig.search?.trim() &&
    ["all", "folder", "collection"].includes(currentView);
  const searchTerm = filterConfig.search?.trim().toLowerCase() ?? "";
  if (searchTerm && !serverFilteredSearch) {
    result = result.filter(
      (b) =>
        b.title.toLowerCase().includes(searchTerm) ||
        b.url.toLowerCase().includes(searchTerm) ||
        (b.tags && b.tags.toLowerCase().includes(searchTerm)),
    );
  }

  // Tag filter
  if (filterConfig.tags.length > 0) {
    const filterTags = filterConfig.tags.map((t) => t.trim().toLowerCase());
    result = result.filter((b) => {
      const bTags = getNormalizedTags(b);
      return filterConfig.tagMode === "AND"
        ? filterTags.every((t) => bTags.includes(t))
        : filterTags.some((t) => bTags.includes(t));
    });
  }

  // Sort
  result.sort((a, b) => {
    switch (filterConfig.sort) {
      case "a_z":
      case "a-z":
      case "alpha":
        return a.title.localeCompare(b.title);
      case "z_a":
      case "z-a":
        return b.title.localeCompare(a.title);
      case "most_visited":
        return (b.click_count || 0) - (a.click_count || 0);
      case "oldest_first":
      case "created_asc":
        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      default:
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
    }
  });

  return result.slice(0, displayedCount);
}

export function BookmarksList() {
  const {
    bookmarks,
    filterConfig,
    displayedCount,
    totalCount,
    isLoading,
    isLoadingMore,
    selectedBookmarks,
    lastSelectedIndex,
    setRenderedBookmarks,
    setDisplayedCount,
    setIsLoadingMore,
    setBookmarks,
    setTotalCount,
    setSelectedBookmarks,
    setLastSelectedIndex,
    setBulkMode,
    setFilterConfig,
  } = useBookmarks();

  const { viewMode, richLinkPreviewsEnabled, currentView } = useUI();

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Compute filtered list; this replaces renderBookmarks() filtering logic
  const filtered = useMemo(
    () =>
      applyFilters(
        bookmarks,
        currentView,
        filterConfig as FilterConfig,
        displayedCount,
      ),
    [bookmarks, currentView, filterConfig, displayedCount],
  );

  // Keep renderedBookmarks in sync so other parts of the app still work
  useEffect(() => {
    setRenderedBookmarks(filtered);
  }, [filtered, setRenderedBookmarks]);

  // Load more: client-side pagination first, then server fetch when exhausted
  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading) return;

    if (displayedCount < bookmarks.length) {
      setDisplayedCount(displayedCount + BOOKMARKS_PER_PAGE);
      return;
    }

    if (bookmarks.length >= totalCount) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(BOOKMARKS_PER_PAGE),
        offset: String(bookmarks.length),
      });
      const response = await api<{
        bookmarks?: Bookmark[];
        total?: number;
      }>(`/bookmarks?${params}`);
      const newBookmarks =
        response?.bookmarks ??
        (Array.isArray(response) ? (response as Bookmark[]) : []);
      if (newBookmarks.length) {
        setBookmarks([...bookmarks, ...newBookmarks]);
        if (response?.total != null) setTotalCount(response.total);
        setDisplayedCount(displayedCount + BOOKMARKS_PER_PAGE);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    bookmarks,
    displayedCount,
    totalCount,
    isLoading,
    isLoadingMore,
    setDisplayedCount,
    setIsLoadingMore,
    setBookmarks,
    setTotalCount,
  ]);

  // IntersectionObserver sentinel — replaces imperative scroll loadMore calls
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, isLoading]);

  const handleSelect = useCallback(
    (id: string, idx: number, shiftKey: boolean) => {
      const next = new Set(selectedBookmarks);
      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, idx);
        const end = Math.max(lastSelectedIndex, idx);
        filtered.slice(start, end + 1).forEach((b) => next.add(b.id));
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setLastSelectedIndex(idx);
      }
      setSelectedBookmarks(next);
      setBulkMode(next.size > 0);
    },
    [
      selectedBookmarks,
      lastSelectedIndex,
      filtered,
      setSelectedBookmarks,
      setLastSelectedIndex,
      setBulkMode,
    ],
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      const tags = filterConfig.tags.includes(tag)
        ? filterConfig.tags.filter((t) => t !== tag)
        : [...filterConfig.tags, tag];
      setFilterConfig({ ...filterConfig, tags });
    },
    [filterConfig, setFilterConfig],
  );

  // --- Render states ---

  if (isLoading) {
    return (
      <div className={`bookmarks-${viewMode}`}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!filtered.length) {
    return null; // EmptyState component in AppShell handles this
  }

  const containerClass =
    richLinkPreviewsEnabled && viewMode === "grid"
      ? `bookmarks-${viewMode} rich-link-previews`
      : `bookmarks-${viewMode}`;

  const useRichCard = richLinkPreviewsEnabled && viewMode === "grid";
  const hasMore =
    displayedCount < bookmarks.length || bookmarks.length < totalCount;

  return (
    <>
      <div className={containerClass} role="list">
        {filtered.map((b, i) => {
          const sharedProps = {
            bookmark: b,
            index: i,
            onOpen: () => window.open(b.url, "_blank", "noopener,noreferrer"),
            onEdit: () => editBookmark(b.id),
            onFavorite: () => toggleFavorite(b.id),
            onCopy: () => navigator.clipboard.writeText(b.url),
            // onArchive handles both directions based on current archived state
            onArchive: () =>
              b.is_archived ? unarchiveBookmark(b.id) : archiveBookmark(b.id),
            onDelete: () => deleteBookmark(b.id),
            onTagClick: handleTagClick,
            onSelect: (idx: number, shiftKey: boolean) =>
              handleSelect(b.id, idx, shiftKey),
          };

          return useRichCard ? (
            <RichBookmarkCard key={b.id} {...sharedProps} />
          ) : (
            <BookmarkCard key={b.id} {...sharedProps} />
          );
        })}
      </div>

      {hasMore && (
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
      )}

      {isLoadingMore && (
        <div className={`bookmarks-${viewMode} load-more-skeletons`}>
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}
    </>
  );
}
