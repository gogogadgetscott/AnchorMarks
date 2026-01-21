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
  openModal,
  updateCounts,
  getEmptyStateMessage,
  updateBulkUI,
  updateActiveNav,
} from "@utils/ui-helpers.ts";
import { Bookmark } from "../../types/index";
import { updateFilterButtonVisibility } from "@features/bookmarks/filters.ts";
import {
  BookmarkCard as createBookmarkCard,
  SkeletonCard,
  RichBookmarkCard,
} from "@components/index.ts";
export { createBookmarkCard };

import { confirmDialog, promptDialog } from "@features/ui/confirm-dialog.ts";

/**
 * Render skeletons while loading
 */
export function renderSkeletons(): void {
  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
  if (!container) return;

  // Set container class based on view mode
  const classMap = {
    grid: "bookmarks-grid",
    list: "bookmarks-list",
    compact: "bookmarks-compact",
  };
  container.className = classMap[state.viewMode] || "bookmarks-grid";

  // Render 8 skeleton cards
  container.innerHTML = Array(8)
    .fill(null)
    .map(() => SkeletonCard())
    .join("");
}

// Load bookmarks from server
export async function loadBookmarks(): Promise<void> {
  try {
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
    if (
      state.currentFolder &&
      state.currentView !== "dashboard" &&
      state.currentView !== "collection"
    ) {
      params.append("folder_id", state.currentFolder);
      if (state.includeChildBookmarks) {
        params.append("include_children", "true");
      }
    }

    // Only add sort params when using /bookmarks endpoint
    if (endpoint === "/bookmarks") {
      const sortOption =
        state.filterConfig.sort ||
        state.dashboardConfig.bookmarkSort ||
        "recently_added";
      params.append("sort", sortOption);
    }

    // Add pagination params
    params.append("limit", state.BOOKMARKS_PER_PAGE.toString());
    params.append("offset", "0");

    const query = params.toString();
    if (query) endpoint += `?${query}`;

    const response = await api<any>(endpoint);

    if (response && typeof response === "object" && "bookmarks" in response) {
      state.setBookmarks(response.bookmarks);
      state.setTotalCount(response.total);
    } else {
      state.setBookmarks(Array.isArray(response) ? response : []);
      state.setTotalCount(state.bookmarks.length);
    }

    // Load tags metadata for color/icon rendering
    try {
      const tags = await api<any[]>("/tags");
      // Create a lookup map for quick access
      const tagMap: Record<string, any> = {};
      tags.forEach((tag: any) => {
        tagMap[tag.name] = {
          color: tag.color || "#f59e0b",
          icon: tag.icon || "tag",
          id: tag.id,
          count: tag.count || 0,
        };
      });
      // Store in state for use in rendering
      state.setTagMetadata(tagMap);
    } catch (err) {
      logger.error("Failed to load tag metadata", err);
      // Continue without tag metadata
    }

    if (state.currentView === "dashboard") {
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else if (state.currentView === "tag-cloud") {
      const { renderTagCloud } =
        await import("@features/bookmarks/tag-cloud.ts");
      await renderTagCloud();
    } else {
      renderBookmarks();
    }
    await updateCounts();

    // Update active nav to reflect current view
    updateActiveNav();

    // Initialize bookmark views UI only for all/folder views
    if (
      state.currentView !== "dashboard" &&
      state.currentView !== "tag-cloud" &&
      state.currentView !== "favorites" &&
      state.currentView !== "recent" &&
      state.currentView !== "archived"
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
const pendingMetadataFetches = new Set<string>();
let ogImageObserver: IntersectionObserver | null = null;

export function renderBookmarks(): void {
  // Only render if we're in a bookmark-rendering view
  if (state.currentView === "dashboard" || state.currentView === "tag-cloud") {
    return;
  }

  updateFilterButtonVisibility();

  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
  const emptyState = dom.emptyState || document.getElementById("empty-state");
  const searchInput =
    dom.searchInput || document.getElementById("search-input");

  if (!container) return;

  // Set container class based on view mode
  const classMap = {
    grid: "bookmarks-grid",
    list: "bookmarks-list",
    compact: "bookmarks-compact",
  };
  let containerClass = classMap[state.viewMode] || "bookmarks-grid";

  if (state.richLinkPreviewsEnabled && state.viewMode === "grid") {
    containerClass += " rich-link-previews";
  }

  container.className = containerClass;

  const searchTerm =
    (searchInput as HTMLInputElement)?.value.toLowerCase() || "";
  let filtered = [...state.bookmarks];

  // Apply filters...
  if (state.currentView === "archived") {
    filtered = filtered.filter((b) => b.is_archived === 1);
  } else {
    filtered = filtered.filter((b) => !b.is_archived);
  }

  if (searchTerm) {
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(searchTerm) ||
        b.url.toLowerCase().includes(searchTerm) ||
        (b.tags && b.tags.toLowerCase().includes(searchTerm)),
    );
  }

  if (state.currentView === "recent") {
    filtered = filtered
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      )
      .slice(0, 20);
  } else {
    if (state.filterConfig.tags.length > 0) {
      filtered = filtered.filter((b) => {
        if (!b.tags) return false;
        const bTags = b.tags.split(",").map((t) => t.trim());
        return state.filterConfig.tagMode === "AND"
          ? state.filterConfig.tags.every((t) => bTags.includes(t))
          : state.filterConfig.tags.some((t) => bTags.includes(t));
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

  if (filtered.length === 0) {
    container.innerHTML = "";
    if (emptyState) {
      emptyState.innerHTML = getEmptyStateMessage();
      emptyState.classList.remove("hidden");
    }
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  // --- Virtualization logic ---
  const containerWidth = container.clientWidth || 1000;
  const scrollContainer = (container.closest(".main-content") ||
    container) as HTMLElement;

  let itemsPerRow = 1;
  let rowHeight = 120;

  if (state.viewMode === "grid") {
    itemsPerRow = Math.max(1, Math.floor((containerWidth + 20) / (320 + 20)));
    rowHeight = 352;
  } else if (state.viewMode === "compact") {
    rowHeight = 40;
  }

  const BUFFER_ROWS = 2;
  const totalRows = Math.ceil(filtered.length / itemsPerRow);
  const viewportHeight = scrollContainer.clientHeight || 1000;
  const scrollTop = scrollContainer.scrollTop || 0;

  const containerRect = container.getBoundingClientRect();
  const scrollRect = scrollContainer.getBoundingClientRect();
  const containerOffsetTop = containerRect.top - scrollRect.top + scrollTop;
  const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);

  const visibleRows = Math.ceil(viewportHeight / rowHeight) + BUFFER_ROWS * 2;
  const startRow = Math.max(
    0,
    Math.floor(relativeScrollTop / rowHeight) - BUFFER_ROWS,
  );
  const endRow = Math.min(totalRows, startRow + visibleRows);

  const startIndex = startRow * itemsPerRow;
  const endIndex = Math.min(filtered.length, endRow * itemsPerRow);

  const targetBookmarks = filtered.slice(startIndex, endIndex);
  const targetIdSet = new Set(targetBookmarks.map((b) => b.id));

  // Sync DOM nodes
  const children = Array.from(container.children) as HTMLElement[];
  const existingNodesMap = new Map<string, HTMLElement>();
  children.forEach((child) => {
    const id = child.dataset.bookmarkId;
    if (id && targetIdSet.has(id)) {
      existingNodesMap.set(id, child);
    } else {
      container.removeChild(child);
    }
  });

  const cardRenderer =
    state.richLinkPreviewsEnabled && state.viewMode === "grid"
      ? RichBookmarkCard
      : createBookmarkCard;

  targetBookmarks.forEach((b, i) => {
    let el = existingNodesMap.get(b.id);
    const html = cardRenderer(b, startIndex + i);
    const stableHTML = el
      ? html.replace(/entrance-animation|delay-\d+/g, "")
      : html;

    if (!el) {
      el = document.createElement("div");
      el.className = "bookmark-card-wrapper";
      el.dataset.bookmarkId = b.id;
      el.innerHTML = stableHTML;
      container.insertBefore(el, container.children[i] || null);
    } else {
      if (container.children[i] !== el)
        container.insertBefore(el, container.children[i]);
      if (el.innerHTML !== stableHTML) el.innerHTML = stableHTML;
    }
  });

  container.style.paddingTop = `${startRow * rowHeight}px`;
  container.style.paddingBottom = `${Math.max(0, (totalRows - endRow) * rowHeight)}px`;

  // Attach listeners once
  const scrollHandlerMap =
    (window as any)._bookmarkScrollHandlerMap || new WeakMap();
  (window as any)._bookmarkScrollHandlerMap = scrollHandlerMap;

  const debounce = <T extends (...args: any[]) => void>(
    fn: T,
    delay: number,
  ): T => {
    let timeoutId: any;
    return ((...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    }) as any;
  };

  const syncLayout = debounce(() => {
    // Double check view mode before re-rendering
    if (
      state.currentView === "dashboard" ||
      state.currentView === "tag-cloud"
    ) {
      return;
    }
    renderBookmarks();

    // Infinite scroll detection: check if near bottom
    const scrollBottom =
      scrollContainer.scrollTop + scrollContainer.clientHeight;
    // Lower threshold for grid view to account for larger cards
    const threshold =
      scrollContainer.scrollHeight - (state.viewMode === "grid" ? 1000 : 500);

    if (scrollBottom > threshold) {
      loadMoreBookmarks();
    }
  }, 16);

  if (!scrollHandlerMap.has(scrollContainer)) {
    scrollHandlerMap.set(scrollContainer, syncLayout);
    scrollContainer.addEventListener("scroll", syncLayout, { passive: true });
    window.addEventListener("resize", syncLayout, { passive: true });
  }

  // Defer non-critical work
  setTimeout(() => {
    attachBookmarkCardListeners();
    updateBulkUI();
    if (state.richLinkPreviewsEnabled && state.viewMode === "grid") {
      lazyLoadOGImages();
    }
  }, 50);
}

// Load more bookmarks for infinite scroll
export async function loadMoreBookmarks(): Promise<void> {
  // Only load more if we're in a bookmark-rendering view (not dashboard/tag-cloud)
  if (state.currentView === "dashboard" || state.currentView === "tag-cloud") {
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
    if (
      state.currentFolder &&
      state.currentView !== "dashboard" &&
      state.currentView !== "collection"
    ) {
      params.append("folder_id", state.currentFolder);
      if (state.includeChildBookmarks) {
        params.append("include_children", "true");
      }
    }

    // Only add sort params when using /bookmarks endpoint
    if (endpoint === "/bookmarks") {
      const sortOption =
        state.filterConfig.sort ||
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

// Adaptive Lazy Loading for Rich Cards
async function lazyLoadOGImages(): Promise<void> {
  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
  if (!container) return;

  const placeholders = Array.from(
    container.querySelectorAll(
      ".rich-card-image-placeholder[data-bookmark-id]",
    ),
  ) as HTMLElement[];
  if (placeholders.length === 0) return;

  // Initialize IntersectionObserver if not already present
  if (!ogImageObserver) {
    ogImageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const id = el.dataset.bookmarkId;
            const url = el.dataset.bookmarkUrl;
            if (id && url) processOGImageFetch(id, url);
            ogImageObserver?.unobserve(el);
          }
        });
      },
      { rootMargin: "200px" },
    );
  }

  // Observe all placeholders in the current DOM
  placeholders.forEach((p) => ogImageObserver?.observe(p));
}

async function processOGImageFetch(
  bookmarkId: string,
  bookmarkUrl: string,
): Promise<void> {
  if (pendingMetadataFetches.has(bookmarkId)) return;
  pendingMetadataFetches.add(bookmarkId);

  try {
    const bookmark = state.bookmarks.find((b) => b.id === bookmarkId);
    if (bookmark && (bookmark.og_image || bookmark.thumbnail_local)) {
      updateRichCardImage(
        bookmarkId,
        bookmark.og_image || bookmark.thumbnail_local!,
      );
      return;
    }

    const metadata = await api<{ og_image?: string }>(
      "/bookmarks/fetch-metadata",
      {
        method: "POST",
        body: JSON.stringify({ url: bookmarkUrl }),
      },
    );

    if (metadata?.og_image) {
      const idx = state.bookmarks.findIndex((b) => b.id === bookmarkId);
      if (idx !== -1) {
        state.bookmarks[idx].og_image = metadata.og_image;
        await api(`/bookmarks/${bookmarkId}`, {
          method: "PUT",
          body: JSON.stringify({ og_image: metadata.og_image }),
        });
        updateRichCardImage(bookmarkId, metadata.og_image);
      }
    }
  } catch (err) {
    logger.debug("Failed to fetch OG image", { id: bookmarkId, err });
  } finally {
    pendingMetadataFetches.delete(bookmarkId);
  }
}

function updateRichCardImage(bookmarkId: string, ogImage: string): void {
  const card = document.querySelector(
    `.rich-bookmark-card[data-id="${bookmarkId}"]`,
  );
  const placeholder = card?.querySelector(".rich-card-image-placeholder");
  if (placeholder) {
    placeholder.outerHTML = `<div class="rich-card-image"><img src="${escapeHtml(ogImage)}" alt="" loading="lazy"></div>`;
  }
}

// Idempotent record of listeners
const attachedContainers = new WeakSet<HTMLElement>();

export function attachBookmarkCardListeners(): void {
  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
  if (!container || attachedContainers.has(container)) return;
  attachedContainers.add(container);

  container.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(
      ".bookmark-card, .rich-bookmark-card",
    ) as HTMLElement | null;
    if (!card) return;

    if ((e.target as HTMLElement).classList.contains("bookmark-select")) {
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

    if (state.bulkMode) {
      toggleBookmarkSelection(
        id,
        parseInt(card.dataset.index || "0", 10),
        (e as MouseEvent).shiftKey,
        true,
      );
      return;
    }

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
  updateBulkUI();
  renderBookmarks();
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
  } catch (err: any) {
    showToast(err.message, "error");
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
    const bm = state.bookmarks.find((b) => b.id === id);
    if (bm) bm.is_archived = 1;

    renderBookmarks();
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
    const bm = state.bookmarks.find((b) => b.id === id);
    if (bm) bm.is_archived = 0;

    renderBookmarks();
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
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else {
      renderBookmarks();
    }

    await updateCounts();
    showToast("Bookmark deleted", "success");
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Toggle favorite
export async function toggleFavorite(id: string): Promise<void> {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (!bookmark) return;

  try {
    await api(`/bookmarks/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite: bookmark.is_favorite ? 0 : 1 }),
    });
    bookmark.is_favorite = !bookmark.is_favorite;
    renderBookmarks();
    await updateCounts();
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Track click
export async function trackClick(id: string): Promise<void> {
  try {
    await api(`/bookmarks/${id}/click`, { method: "POST" });
  } catch (err: any) {
    // Silent fail
  }
}

// Edit bookmark (populate form)
export async function editBookmark(id: string): Promise<void> {
  const bookmark = state.bookmarks.find((b) => b.id === id);
  if (!bookmark) return;

  document.getElementById("bookmark-modal-title")!.textContent =
    "Edit Bookmark";
  (document.getElementById("bookmark-id") as HTMLInputElement).value = id;
  (document.getElementById("bookmark-url") as HTMLInputElement).value =
    bookmark.url;
  (document.getElementById("bookmark-title") as HTMLInputElement).value =
    bookmark.title;
  (document.getElementById("bookmark-description") as HTMLInputElement).value =
    bookmark.description || "";
  (document.getElementById("bookmark-folder") as HTMLSelectElement).value =
    bookmark.folder_id || "";
  (document.getElementById("bookmark-tags") as HTMLInputElement).value =
    bookmark.tags || "";

  // Load color
  const colorInput = document.getElementById(
    "bookmark-color",
  ) as HTMLInputElement;
  if (colorInput) colorInput.value = bookmark.color || "";

  // Update color picker UI
  document.querySelectorAll(".color-option-bookmark").forEach((opt: any) => {
    const optColor = opt.dataset.color || "";
    opt.classList.toggle("active", optColor === (bookmark.color || ""));
  });

  // Load tags into the new tag input system
  // @ts-ignore
  const { loadTagsFromInput } =
    await import("@features/bookmarks/tag-input.ts");
  loadTagsFromInput(bookmark.tags || "");

  openModal("bookmark-modal");
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
export function initBookmarkViews() {
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
  const views: any[] = Array.isArray(viewsUnknown) ? viewsUnknown : [];

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
    views.forEach((view: any) => {
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
  } catch (err: any) {
    showToast(err.message, "error");
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
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Restore bookmark view
// Restore bookmark view
export async function restoreBookmarkView(id: string) {
  try {
    logger.debug("Restoring bookmark view", { viewId: id });

    const response = await api<{ config: any }>(
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
      err instanceof Error ? err.message : "Failed to restore view";
    showToast(errorMessage, "error");
  }
}

// Make restoreBookmarkView global for bookmark shortcuts
(window as any).restoreBookmarkView = restoreBookmarkView;

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
