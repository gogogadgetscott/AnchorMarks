/**
 * AnchorMarks - Bookmarks Module
 * Handles bookmark CRUD operations and rendering
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { escapeHtml } from "@utils/index.ts";
import { logger } from "@utils/logger.ts";
import {
  dom,
  showToast,
  closeModals,
  updateCounts,
  updateActiveNav,
  updateBulkUI,
  updateStats,
} from "@utils/ui-helpers.ts";
import { Bookmark, Tag } from "../../types/index";
import {
  BookmarkViewResponse,
  RestoreBookmarkViewResponse,
} from "../../types/api";
import { updateFilterButtonVisibility } from "@features/bookmarks/filters.ts";
import { BookmarkCard as createBookmarkCard } from "@components/index.ts";
export { createBookmarkCard };

import { confirmDialog, promptDialog } from "@features/ui/confirm-dialog.ts";

// Tag metadata cache — avoid re-fetching on every page switch
let tagMetadataLoadedAt = 0;
const TAG_METADATA_TTL_MS = 60_000;

export function invalidateTagMetadataCache(): void {
  tagMetadataLoadedAt = 0;
}

/**
 * Render skeletons while loading
 */
/** @deprecated Managed by React (BookmarksList) */
export function renderSkeletons(): void {}

// Load bookmarks from server
export async function loadBookmarks(): Promise<void> {
  try {
    logger.info(
      `loadBookmarks invoked; currentView=${state.currentView} filterTags=${JSON.stringify(state.filterConfig.tags)}`,
    );
    // Don't fetch or overwrite main content when on analytics view
    if (state.currentView === "analytics") {
      return;
    }
    state.setIsLoading(true);
    state.resetPagination();
    // Show skeletons immediately
    renderSkeletons();

    let endpoint = "/bookmarks";
    const params = new URLSearchParams();

    // Smart Collection view is server-filtered and has its own endpoint
    if (state.currentView === "collection" && state.currentCollection) {
      endpoint = `/collections/${state.currentCollection}/bookmarks`;
    }

    if (state.currentView === "favorites") params.append("favorites", "true");
    if (state.currentView === "archived") params.append("archived", "true");
    // Don't send folder_id for favorites, archived, recent, or most-used views - show all items regardless of folder
    if (
      state.currentFolder &&
      state.currentView !== "dashboard" &&
      state.currentView !== "collection" &&
      state.currentView !== "favorites" &&
      state.currentView !== "archived" &&
      state.currentView !== "recent" &&
      state.currentView !== "most-used"
    ) {
      params.append("folder_id", state.currentFolder);
      if (state.includeChildBookmarks) {
        params.append("include_children", "true");
      }
    }

    // Only add sort params when using /bookmarks endpoint
    if (endpoint === "/bookmarks") {
      const sortOption =
        state.currentView === "most-used"
          ? "most_visited"
          : state.filterConfig.sort ||
            state.dashboardConfig.bookmarkSort ||
            "recently_added";
      params.append("sort", sortOption);

      // Server handles all filtering for favorites, archived, recent, and most-used views
      // Don't send search or tag filters for these views
      if (
        state.currentView !== "favorites" &&
        state.currentView !== "archived" &&
        state.currentView !== "recent" &&
        state.currentView !== "most-used"
      ) {
        const searchTerm = state.filterConfig.search?.trim();
        if (searchTerm) {
          params.append("search", searchTerm);
        }

        // If client-side filters contain tags, include them in the server request
        if (state.filterConfig.tags && state.filterConfig.tags.length > 0) {
          // Use comma-separated tags; server performs a LIKE match on tg.tags_joined
          params.append("tags", state.filterConfig.tags.join(","));
          // Pass tagMode so server can apply AND/OR semantics
          params.append("tagMode", state.filterConfig.tagMode || "OR");
        }
      }
    }

    // Add pagination params
    params.append("limit", state.BOOKMARKS_PER_PAGE.toString());
    params.append("offset", "0");

    const query = params.toString();
    if (query) endpoint += `?${query}`;

    const now = Date.now();
    const shouldFetchTags =
      tagMetadataLoadedAt === 0 ||
      now - tagMetadataLoadedAt > TAG_METADATA_TTL_MS;

    // Fetch bookmarks and (if needed) tag metadata in parallel
    const [response, tags] = await Promise.all([
      api<any>(endpoint),
      shouldFetchTags
        ? api<any[]>("/tags").catch((err: unknown) => {
            logger.error("Failed to load tag metadata", err);
            return null;
          })
        : Promise.resolve(null),
    ]);

    if (response && typeof response === "object" && "bookmarks" in response) {
      state.setBookmarks(response.bookmarks);
      state.setTotalCount(response.total);
      logger.info(
        `loadBookmarks fetched ${Array.isArray(response.bookmarks) ? response.bookmarks.length : 0} bookmarks (server response)`,
      );
    } else {
      state.setBookmarks(Array.isArray(response) ? response : []);
      state.setTotalCount(state.bookmarks.length);
      logger.info(
        `loadBookmarks fetched ${state.bookmarks.length} bookmarks (array response)`,
      );
    }

    if (tags) {
      const tagMap: Record<string, any> = {};
      (tags as Tag[]).forEach((tag: Tag) => {
        tagMap[tag.name] = {
          color: tag.color || "#f59e0b",
          icon: (tag as any).icon || "tag",
          id: tag.id,
          count: tag.count || 0,
        };
      });
      state.setTagMetadata(tagMap);
      tagMetadataLoadedAt = now;
    }

    // Refresh omnibar bookmarks cache in background (for unfiltered search)
    import("@features/bookmarks/commands.ts").then(
      ({ refreshOmnibarBookmarks }) => {
        refreshOmnibarBookmarks();
      },
    );

    if (state.currentView === "dashboard") {
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else if (state.currentView === "tag-cloud") {
      // Tag cloud is rendered by React AppShell; data is refreshed above.
    } else {
      renderBookmarks();
    }
    await updateCounts?.();

    // Update active nav to reflect current view
    updateActiveNav?.();

    // Initialize bookmark views UI only for all/folder views
    if (
      state.currentView !== "dashboard" &&
      state.currentView !== "tag-cloud" &&
      state.currentView !== "favorites" &&
      state.currentView !== "recent" &&
      state.currentView !== "archived" &&
      state.currentView !== "most-used"
    ) {
      initBookmarkViews();
    }

    // Dynamic imports to avoid circular dependencies
    const { renderSidebarTags } = await import("@features/bookmarks/search.ts");
    // @ts-ignore
    const { checkWelcomeTour } = await import("@features/bookmarks/tour.ts");
    const { renderFolders } = await import("@features/bookmarks/folders.ts");
    renderSidebarTags();
    renderFolders();
    checkWelcomeTour();
  } catch (err) {
    showToast("Failed to load bookmarks", "error");
  } finally {
    state.setIsLoading(false);
  }
}

// Render bookmarks list
// --- Virtualization State & Constants ---

/**
 * @deprecated This function performs client-side filtering and updates state.renderedBookmarks.
 * React (BookmarksList component) handles the actual rendering automatically via Context.
 * The filtering logic should eventually be moved to BookmarksContext.
 * For now, this updates state that React observes, but doesn't trigger DOM updates directly.
 */
export function renderBookmarks(): void {
  // Only update state if we're in a bookmark-rendering view
  if (
    state.currentView === "dashboard" ||
    state.currentView === "tag-cloud" ||
    state.currentView === "analytics"
  ) {
    return;
  }

  updateFilterButtonVisibility();

  const searchInput =
    dom.searchInput || document.getElementById("search-input");

  let filtered: Bookmark[];

  if (
    state.currentView === "favorites" ||
    state.currentView === "archived" ||
    state.currentView === "recent" ||
    state.currentView === "most-used"
  ) {
    filtered = [...state.bookmarks];

    if (state.currentView === "recent") {
      filtered = filtered.slice(0, 20);
    }
    if (state.currentView === "most-used") {
      filtered = filtered.filter((b) => (b.click_count || 0) > 0);
    }
  } else {
    const searchSource =
      state.filterConfig.search ??
      ((searchInput as HTMLInputElement)?.value || "");
    const searchTerm = searchSource.trim().toLowerCase();
    filtered = [...state.bookmarks];

    const serverAlreadyFilteredSearch =
      state.filterConfig.search?.trim() &&
      ["all", "folder", "collection"].includes(state.currentView);

    if (searchTerm && !serverAlreadyFilteredSearch) {
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(searchTerm) ||
          b.url.toLowerCase().includes(searchTerm) ||
          (b.tags && b.tags.toLowerCase().includes(searchTerm)),
      );
    }

    if (state.filterConfig.tags.length > 0) {
      const filterTags = state.filterConfig.tags.map((t) =>
        t.trim().toLowerCase(),
      );

      const getNormalizedTags = (bookmark: Bookmark): string[] => {
        const raw = bookmark.tags;
        if (!raw) return [];
        if (Array.isArray(raw)) {
          return raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
        }
        if (typeof raw === "object") {
          try {
            return Object.values(raw)
              .map((v) => String(v))
              .join(",")
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean);
          } catch (e) {
            return [];
          }
        }
        return String(raw)
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
      };

      filtered = filtered.filter((b) => {
        const bTags = getNormalizedTags(b);
        return state.filterConfig.tagMode === "AND"
          ? filterTags.every((t) => bTags.includes(t))
          : filterTags.some((t) => bTags.includes(t));
      });
    }

    const sort = state.filterConfig.sort;
    filtered.sort((a, b) => {
      switch (sort) {
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
  }

  state.setRenderedBookmarks(filtered);

  // The global state has already been updated by loadBookmarks or filter changes.
  // BookmarksList (React) automatically re-renders when useBookmarks() signals
  // changes to the Context. React handles the empty state internally now.
  // Legacy empty-state container is deprecated.

  // Update stats to show the current filtered count (legacy system still needs this)
  updateStats?.();
}

// Load more bookmarks for infinite scroll
export async function loadMoreBookmarks(): Promise<void> {
  // Only load more if we're in a bookmark-rendering view (not dashboard/tag-cloud/analytics)
  if (
    state.currentView === "dashboard" ||
    state.currentView === "tag-cloud" ||
    state.currentView === "analytics"
  ) {
    return;
  }
  // Don't load if already loading, or if we've reached the total count
  if (
    state.isLoadingMore ||
    state.isLoading ||
    state.bookmarks.length >= state.totalCount
  )
    return;

  try {
    state.setIsLoadingMore(true);

    let endpoint = "/bookmarks";
    const params = new URLSearchParams();

    // Use same view-specific filters as original load
    if (state.currentView === "collection" && state.currentCollection) {
      endpoint = `/collections/${state.currentCollection}/bookmarks`;
    }

    if (state.currentView === "favorites") params.append("favorites", "true");
    if (state.currentView === "archived") params.append("archived", "true");
    // Don't send folder_id for favorites, archived, recent, or most-used views - show all items regardless of folder
    if (
      state.currentFolder &&
      state.currentView !== "dashboard" &&
      state.currentView !== "collection" &&
      state.currentView !== "favorites" &&
      state.currentView !== "archived" &&
      state.currentView !== "recent" &&
      state.currentView !== "most-used"
    ) {
      params.append("folder_id", state.currentFolder);
      if (state.includeChildBookmarks) {
        params.append("include_children", "true");
      }
    }

    // Only add sort params when using /bookmarks endpoint
    if (endpoint === "/bookmarks") {
      const sortOption =
        state.currentView === "most-used"
          ? "most_visited"
          : state.filterConfig.sort ||
            state.dashboardConfig.bookmarkSort ||
            "recently_added";
      params.append("sort", sortOption);
    }

    // Pagination for next chunk
    params.append("limit", state.BOOKMARKS_PER_PAGE.toString());
    params.append("offset", state.bookmarks.length.toString());

    const query = params.toString();
    if (query) endpoint += `?${query}`;

    const response = await api<any>(endpoint);
    let newBookmarks: Bookmark[] = [];

    if (response && typeof response === "object" && "bookmarks" in response) {
      newBookmarks = response.bookmarks;
      state.setTotalCount(response.total);
    } else {
      newBookmarks = Array.isArray(response) ? response : [];
    }

    if (newBookmarks.length > 0) {
      // Append new bookmarks to the end of the list
      state.setBookmarks([...state.bookmarks, ...newBookmarks]);
      renderBookmarks();
    }
  } catch (err) {
    logger.error("Failed to load more bookmarks", err);
  } finally {
    state.setIsLoadingMore(false);
  }
}

// Adaptive Lazy Loading for Rich Cards - Removed (integrated into React components)

/**
 * Fetch metadata for a URL
 */
export async function fetchMetadata(url: string): Promise<{
  title?: string;
  description?: string;
  og_image?: string;
}> {
  try {
    const metadata = await api<{
      title?: string;
      description?: string;
      og_image?: string;
    }>("/bookmarks/fetch-metadata", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return metadata;
  } catch (err) {
    logger.error("Failed to fetch metadata", { url, err });
    throw err;
  }
}

// Idempotent record of listeners
const attachedContainers = new WeakSet<HTMLElement>();

export function attachBookmarkCardListeners(): void {
  const container = document.getElementById("main-view-outlet");
  if (!container || attachedContainers.has(container)) return;
  attachedContainers.add(container);

  container.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(
      ".bookmark-card, .rich-bookmark-card",
    ) as HTMLElement | null;
    if (!card) return;

    if ((e.target as HTMLElement).closest(".bookmark-select")) {
      e.stopPropagation();
      toggleBookmarkSelection(
        card.dataset.id || "",
        parseInt(card.dataset.index || "0", 10),
        (e as MouseEvent).shiftKey,
        true,
      );
      return;
    }

    if ((e.target as HTMLElement).closest(".bookmark-actions, .bookmark-tags"))
      return;

    const id = card.dataset.id || "";
    const bookmark = state.bookmarks.find((b) => b.id === id);
    if (!bookmark) return;

    const url = bookmark.url;
    if (url.startsWith("view:")) {
      const viewId = url.substring(5);
      import("@features/bookmarks/dashboard.ts").then(({ restoreView }) =>
        restoreView(viewId, bookmark.title),
      );
    } else if (url.startsWith("bookmark-view:")) {
      restoreBookmarkView(url.substring(14));
    } else {
      trackClick(id);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });

  // Favicon error handler using delegation (simulated via bubbling since error doesn't bubble)
  // We use a capture listener or just wrap the existing logic for clarity
  container.addEventListener(
    "error",
    (e) => {
      const target = e.target as HTMLElement;
      if (
        target.classList.contains("bookmark-favicon-img") &&
        target.dataset.fallback === "true"
      ) {
        const parent = target.parentElement;
        if (parent) {
          parent.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }
      }
    },
    true,
  ); // Use capture to "simulate" delegation for non-bubbling 'error' event
}

// Toggle bookmark selection
export function toggleBookmarkSelection(
  id: string,
  index: number,
  isShift: boolean,
  isMulti: boolean,
): void {
  if (
    isShift &&
    state.lastSelectedIndex !== null &&
    state.renderedBookmarks.length > 0
  ) {
    const start = Math.min(state.lastSelectedIndex, index);
    const end = Math.max(state.lastSelectedIndex, index);
    for (let i = start; i <= end; i++) {
      state.selectedBookmarks.add(state.renderedBookmarks[i].id);
    }
  } else {
    if (state.selectedBookmarks.has(id)) {
      state.selectedBookmarks.delete(id);
    } else {
      if (!isMulti) state.selectedBookmarks.clear();
      state.selectedBookmarks.add(id);
    }
    state.setLastSelectedIndex(index);
  }

  state.setBulkMode(state.selectedBookmarks.size > 0);
  updateBulkUI();
  renderBookmarks();
}

// Clear all selections
export function clearSelections(): void {
  state.selectedBookmarks.clear();
  state.setBulkMode(false);
  state.setLastSelectedIndex(null);
  updateBulkUI();
  renderBookmarks();
}

// Select all bookmarks
export function selectAllBookmarks(): void {
  state.renderedBookmarks.forEach((b) => state.selectedBookmarks.add(b.id));
  if (state.selectedBookmarks.size > 0) {
    state.setBulkMode(true);
  }
  updateBulkUI?.();
  renderBookmarks();
}

// Clear bookmarks selection
export function clearSelection(): void {
  state.selectedBookmarks.clear();
  state.setBulkMode(false);
  updateBulkUI?.();
  renderBookmarks();
}

// Stub bulk action functions - to be implemented or delegated through React UI
export function bulkArchive(): void {
  // Bulk archive handled through React Context
}
export function bulkUnarchive(): void {
  // Bulk unarchive handled through React Context
}
export function bulkDelete(): void {
  // Bulk delete handled through React Context
}
export function bulkMove(): void {
  // Bulk move handled through React Context
}
export function bulkTag(): void {
  // Bulk tag handled through React Context
}
export function bulkAutoTag(): void {
  // Bulk auto-tag handled through React Context
}

// Helper to find bookmark in main list or widget cache
function findBookmarkById(id: string): Bookmark | undefined {
  const inMain = state.bookmarks.find((b) => b.id === id);
  if (inMain) return inMain;

  for (const widgetId in state.widgetDataCache) {
    const found = state.widgetDataCache[widgetId].find((b) => b.id === id);
    if (found) return found;
  }
  return undefined;
}

// Create bookmark
export async function createBookmark(data: Partial<Bookmark>): Promise<void> {
  try {
    const bookmark = await api<Bookmark>("/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    });
    state.bookmarks.unshift(bookmark as Bookmark);
    renderBookmarks();
    await updateCounts();
    closeModals();
    showToast("Bookmark added!", "success");
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

// Update bookmark
export async function updateBookmark(
  id: string,
  data: Partial<Bookmark>,
): Promise<void> {
  try {
    const bookmark = await api<Bookmark>(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const index = state.bookmarks.findIndex((b) => b.id === id);
    if (index !== -1) state.bookmarks[index] = bookmark;

    // Re-render the appropriate view based on current state
    if (state.currentView === "dashboard") {
      state.clearWidgetDataCache();
      // Dynamically import and render dashboard
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      renderBookmarks();
    }

    await updateCounts();
    closeModals();
    showToast("Bookmark updated", "success");
  } catch (err) {
    logger.error("Failed to update bookmark", err);
    showToast("Failed to update bookmark", "error");
  }
}

// Archive a bookmark
export async function archiveBookmark(id: string): Promise<void> {
  try {
    await api(`/bookmarks/${id}/archive`, { method: "POST" });
    const bm = findBookmarkById(id);
    if (bm) bm.is_archived = 1;

    if (state.currentView === "dashboard") {
      state.clearWidgetDataCache();
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      renderBookmarks();
    }
    await updateCounts();
    showToast("Bookmark archived", "success");
  } catch (err) {
    logger.error("Failed to archive bookmark", err);
    showToast("Failed to archive bookmark", "error");
  }
}

// Unarchive a bookmark
export async function unarchiveBookmark(id: string): Promise<void> {
  try {
    await api(`/bookmarks/${id}/unarchive`, { method: "POST" });
    const bm = findBookmarkById(id);
    if (bm) bm.is_archived = 0;

    if (state.currentView === "dashboard") {
      state.clearWidgetDataCache();
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      renderBookmarks();
    }
    await updateCounts();
    showToast("Bookmark unarchived", "success");
  } catch (err) {
    logger.error("Failed to unarchive bookmark", err);
    showToast("Failed to unarchive bookmark", "error");
  }
}

// Delete bookmark
export async function deleteBookmark(id: string): Promise<void> {
  if (
    !(await confirmDialog("Delete this bookmark?", {
      title: "Delete Bookmark",
      destructive: true,
    }))
  )
    return;

  try {
    await api(`/bookmarks/${id}`, { method: "DELETE" });
    state.setBookmarks(state.bookmarks.filter((b) => b.id !== id));

    // Re-render the appropriate view based on current state
    if (state.currentView === "dashboard") {
      state.clearWidgetDataCache();
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      renderBookmarks();
    }

    await updateCounts();
    showToast("Bookmark deleted", "success");
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

// Toggle favorite
export async function toggleFavorite(id: string): Promise<void> {
  const bookmark = findBookmarkById(id);
  if (!bookmark) return;

  try {
    await api(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite: bookmark.is_favorite ? 0 : 1 }),
    });
    bookmark.is_favorite = !bookmark.is_favorite;

    if (state.currentView === "dashboard") {
      state.clearWidgetDataCache();
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      renderBookmarks();
    }
    await updateCounts();
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

// Track click
export async function trackClick(id: string): Promise<void> {
  // Update local state before the API call so the UI feels instant
  const bookmark = state.bookmarks.find((b) => b.id === id);
  const wasUntracked =
    bookmark !== undefined && (bookmark.click_count || 0) === 0;
  if (bookmark) {
    bookmark.click_count = (bookmark.click_count || 0) + 1;
  }

  try {
    await api(`/bookmarks/${id}/click`, { method: "POST" });

    // If this was the bookmark's first click, it just entered the most-used set
    if (wasUntracked) {
      const badge = document.getElementById("count-most-used");
      if (badge) {
        badge.textContent = String(parseInt(badge.textContent || "0", 10) + 1);
      }
    }
  } catch (err: unknown) {
    // Silent fail — revert local click_count on error
    if (bookmark) {
      bookmark.click_count = Math.max(0, (bookmark.click_count || 1) - 1);
    }
  }
}

// Edit bookmark (populate form)
import * as modalController from "@utils/modal-controller.ts";

export async function editBookmark(id: string): Promise<void> {
  const bookmark = findBookmarkById(id);
  if (!bookmark) return;

  const bookmarkData = {
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    description: bookmark.description || "",
    folderId: bookmark.folder_id || null,
    tags: bookmark.tags || "",
    color: bookmark.color || "",
    favicon: bookmark.favicon || "",
  };

  modalController.openBookmarkModal(bookmarkData);
}

// Filter by tag
export function filterByTag(tag: string): void {
  const searchInput = document.getElementById(
    "search-input",
  ) as HTMLInputElement;
  const viewTitle = document.getElementById("view-title");

  if (searchInput) searchInput.value = tag;
  state.setCurrentFolder(null);
  state.setCurrentView("all");
  if (viewTitle) viewTitle.textContent = `Tag: ${tag}`;

  updateActiveNav();
  renderBookmarks();
}

// Sort bookmarks helper
export function sortBookmarks(list: Bookmark[]): Bookmark[] {
  const sort = state.dashboardConfig.bookmarkSort || "recently_added";
  return [...list].sort((a, b) => {
    switch (sort) {
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
      case "recently_added":
      case "created_desc":
      default:
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
    }
  });
}

// ============== BOOKMARK VIEWS ==============

// Initialize bookmark views UI
export function initBookmarkViews(): void {
  const headerRight = document.querySelector(".content-header .header-right");
  if (!headerRight) return;

  let btn = document.getElementById("views-btn") as HTMLButtonElement;

  // Create or reposition Views button
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "views-btn";
    btn.className = "btn btn-secondary";
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Views
    `;
  } else {
    // Button exists, remove from current position to reposition
    btn.remove();
  }

  // Update click handler for bookmark view
  btn.onclick = (e) => {
    e.stopPropagation();
    showBookmarkViewsMenu();
  };

  // Insert Views button based on current view
  const filterBtn = document.getElementById("filter-dropdown-btn");
  const sortControls = document.querySelector(".sort-controls");
  const timeRangeControls = document.querySelector(".time-range-controls");
  const headerSearchBar = document.querySelector(".header-search-bar");
  const viewToggle = document.querySelector(".view-toggle");

  if ((sortControls || timeRangeControls || headerSearchBar) && viewToggle) {
    // On favorites/recent/archived page with controls and view toggle, insert before view toggle
    headerRight.insertBefore(btn, viewToggle);
  } else if (sortControls || timeRangeControls || headerSearchBar) {
    // On favorites/recent/archived page without view toggle, append after controls
    headerRight.appendChild(btn);
  } else if (filterBtn && filterBtn.nextSibling) {
    // On bookmarks page, insert after Filters button
    headerRight.insertBefore(btn, filterBtn.nextSibling);
  } else {
    // Fallback: insert before first child
    headerRight.insertBefore(btn, headerRight.firstChild);
  }
}

// Show bookmark views dropdown menu
async function showBookmarkViewsMenu() {
  // Remove existing dropdown if any
  document.getElementById("bookmark-views-dropdown")?.remove();

  const viewsUnknown = await loadBookmarkViews();
  const views: BookmarkViewResponse[] = Array.isArray(viewsUnknown)
    ? viewsUnknown
    : [];

  const dropdown = document.createElement("div");
  dropdown.id = "bookmark-views-dropdown";
  dropdown.className = "dropdown-menu";

  // Position dropdown below the Views button
  const viewsBtn = document.getElementById("views-btn");
  if (viewsBtn) {
    const rect = viewsBtn.getBoundingClientRect();
    // Center the dropdown under the button
    const dropdownWidth = 250;
    const left = Math.max(10, rect.left + rect.width / 2 - dropdownWidth / 2);
    dropdown.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 8}px;
      left: ${left}px;
      z-index: 1000;
      min-width: 250px;
    `;
  } else {
    // Fallback positioning
    dropdown.style.cssText = `
      position: fixed;
      top: 5rem;
      right: 1rem;
      z-index: 1000;
      min-width: 250px;
    `;
  }

  let html = `
        <div style="font-weight:600;padding:0.5rem;border-bottom:1px solid var(--border-color);margin-bottom:0.5rem">
            Bookmark Views
        </div>
        <div class="views-list" style="max-height:200px;overflow-y:auto">
    `;

  if (views.length === 0) {
    html += `<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center">No saved views</div>`;
  } else {
    views.forEach((view: BookmarkViewResponse) => {
      html += `
                <div class="dropdown-item view-item" data-view-id="${view.id}" style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;cursor:pointer;border-radius:4px">
                    <span class="view-name" style="flex:1">${escapeHtml(view.name)}</span>
                    <button class="btn-icon small text-danger delete-view-btn" data-view-id="${view.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;
    });
  }

  html += `
        </div>
        <div style="border-top:1px solid var(--border-color);margin-top:0.5rem;padding-top:0.5rem">
            <button class="btn btn-primary btn-sm btn-full" id="save-bookmark-view-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                Save Current View
            </button>
        </div>
    `;

  dropdown.innerHTML = html;
  document.body.appendChild(dropdown);

  // Attach event listeners to view items
  dropdown.querySelectorAll(".view-item").forEach((item) => {
    const viewId = (item as HTMLElement).dataset.viewId || "";
    const nameSpan = item.querySelector(".view-name");
    const deleteBtn = item.querySelector(".delete-view-btn");

    // Click on view name to restore
    if (nameSpan) {
      nameSpan.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await restoreBookmarkView(viewId);
      });
    }

    // Click on delete button
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteBookmarkView(viewId);
      });
    }
  });

  // Attach event listener to save button
  const saveBtn = dropdown.querySelector("#save-bookmark-view-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await saveCurrentBookmarkView();
    });
  }

  // Global click to close
  setTimeout(() => {
    document.addEventListener("click", closeBookmarkViewsDropdown);
  }, 0);
}

function closeBookmarkViewsDropdown(e: Event) {
  const dropdown = document.getElementById("bookmark-views-dropdown");
  if (
    dropdown &&
    !dropdown.contains(e.target as Node) &&
    (e.target as HTMLElement).id !== "views-btn"
  ) {
    dropdown.remove();
    document.removeEventListener("click", closeBookmarkViewsDropdown);
  }
}

// Save current bookmark view
async function saveCurrentBookmarkView() {
  try {
    const name = await promptDialog("Enter a name for this view:", {
      title: "Save Bookmark View",
      confirmText: "Save",
      placeholder: "e.g., My Collection",
    });
    if (!name) return;

    // Capture current state
    const config = {
      search_query: state.filterConfig.search || "",
      filter_tags: state.filterConfig.tags || [],
      filter_folder: state.filterConfig.folder || null,
      sort_order: state.filterConfig.sort || "recently_added",
      tag_sort: state.filterConfig.tagSort || "count_desc",
      tag_mode: state.filterConfig.tagMode || "OR",
    };

    logger.debug("Saving bookmark view", {
      config,
      filterConfig: state.filterConfig,
    });

    const view = await api<{ id: string }>("/bookmark/views", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });

    logger.debug("Bookmark view saved", { viewId: view.id });

    showToast("View saved!", "success");
    document.getElementById("bookmark-views-dropdown")?.remove();

    // Prompt to create bookmark shortcut
    if (
      await confirmDialog("Create a bookmark shortcut for this view?", {
        title: "Create Shortcut",
      })
    ) {
      await createBookmark({
        title: name,
        url: `bookmark-view:${view.id}`,
        description: "Bookmark View Shortcut",
        tags: "bookmark-views",
      });
    }
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

// Load bookmark views
async function loadBookmarkViews() {
  try {
    return await api("/bookmark/views");
  } catch {
    return [];
  }
}

// Delete bookmark view
async function deleteBookmarkView(id: string) {
  if (
    !(await confirmDialog("Delete this view?", {
      title: "Delete View",
      destructive: true,
    }))
  )
    return;
  try {
    await api(`/bookmark/views/${id}`, { method: "DELETE" });
    showToast("View deleted", "success");
    // Refresh dropdown if open
    document.getElementById("bookmark-views-dropdown")?.remove();
  } catch (err: unknown) {
    showToast((err as Error).message, "error");
  }
}

// Restore bookmark view
// Restore bookmark view
export async function restoreBookmarkView(id: string): Promise<void> {
  try {
    logger.debug("Restoring bookmark view", { viewId: id });

    const response = await api<RestoreBookmarkViewResponse>(
      `/bookmark/views/${id}/restore`,
      {
        method: "POST",
      },
    );
    const config = response.config;

    logger.debug("Received bookmark view config", {
      config,
      filterConfig: state.filterConfig,
    });

    // Ensure we're in bookmark view (not dashboard)
    if (state.currentView === "dashboard") {
      state.setCurrentView("all");
    }

    // Apply the view configuration to state
    state.setFilterConfig({
      search: config.search_query || "",
      tags: config.filter_tags || [],
      folder: config.filter_folder || null,
      sort: config.sort_order || "recently_added",
      tagSort: config.tag_sort || "count_desc",
      tagMode: config.tag_mode || "OR",
    });

    logger.debug("Filter config after restore", {
      filterConfig: state.filterConfig,
    });

    // Set current folder if specified
    if (config.filter_folder) {
      state.setCurrentFolder(config.filter_folder);
    } else {
      state.setCurrentFolder(null);
    }

    // Update UI controls
    const searchInput = document.getElementById(
      "search-input",
    ) as HTMLInputElement;
    if (searchInput) searchInput.value = config.search_query || "";

    const tagSortSelect = document.getElementById(
      "sidebar-filter-tag-sort",
    ) as HTMLSelectElement;
    if (tagSortSelect) tagSortSelect.value = config.tag_sort || "count_desc";

    logger.debug("Reloading bookmarks after view restore");

    // Reload bookmarks with filters applied (this will fetch from server with filters)
    await loadBookmarks();

    // Save current view to ensure we stay in bookmark view
    // @ts-ignore
    const { saveSettings } = await import("@features/bookmarks/settings.ts");
    await saveSettings({ current_view: state.currentView });

    showToast("View restored!", "success");
    document.getElementById("bookmark-views-dropdown")?.remove();
  } catch (err) {
    logger.error("Error restoring bookmark view", err);
    const errorMessage =
      err instanceof Error ? (err as Error).message : "Failed to restore view";
    showToast(errorMessage, "error");
  }
}

// Make restoreBookmarkView global for bookmark shortcuts
window.restoreBookmarkView = restoreBookmarkView;

export default {
  loadBookmarks,
  renderBookmarks,
  createBookmarkCard,
  attachBookmarkCardListeners,
  toggleBookmarkSelection,
  clearSelections,
  selectAllBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  toggleFavorite,
  trackClick,
  editBookmark,
  filterByTag,
  sortBookmarks,
};
