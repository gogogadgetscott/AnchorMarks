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
import { Bookmark } from "@/types";
import { updateFilterButtonVisibility } from "@features/bookmarks/filters.ts";
import {
  BookmarkCard as createBookmarkCard,
  SkeletonCard,
  RichBookmarkCard,
} from "@components/index.ts";
export { createBookmarkCard };

import { confirmDialog } from "@features/ui/confirm-dialog.ts";

/**
 * Render skeletons while loading
 */
export function renderSkeletons(): void {
  const container =
    dom.bookmarksContainer || document.getElementById("bookmarks-container");
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

    const query = params.toString();
    if (query) endpoint += `?${query}`;

    const bookmarks = await api<Bookmark[]>(endpoint);
    state.setBookmarks(bookmarks);

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
export function renderBookmarks(): void {
  updateFilterButtonVisibility();

  const container =
    dom.bookmarksContainer || document.getElementById("bookmarks-container");
  const emptyState = dom.emptyState || document.getElementById("empty-state");
  const searchInput =
    dom.searchInput || document.getElementById("search-input");

  if (!container) return;

  // Show view toggle
  document.querySelector(".view-toggle")?.classList.remove("hidden");

  // Attach view-toggle listeners (fixes broken toggle after header render)
  import("@/App.ts").then(({ attachViewToggleListeners }) =>
    attachViewToggleListeners(),
  );

  // Set container class based on view mode
  const classMap = {
    grid: "bookmarks-grid",
    list: "bookmarks-list",
    compact: "bookmarks-compact",
  };
  let containerClass = classMap[state.viewMode] || "bookmarks-grid";

  // Add rich-link-previews class if enabled
  if (state.richLinkPreviewsEnabled && state.viewMode === "grid") {
    containerClass += " rich-link-previews";
  }

  container.className = containerClass;

  const searchTerm =
    (searchInput as HTMLInputElement)?.value.toLowerCase() || "";
  let filtered = [...state.bookmarks];

  // Apply archive filter
  if (state.currentView === "archived") {
    filtered = filtered.filter((b) => b.is_archived === 1);
  } else {
    filtered = filtered.filter((b) => !b.is_archived);
  }

  // Apply search filter
  if (searchTerm) {
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(searchTerm) ||
        b.url.toLowerCase().includes(searchTerm) ||
        (b.tags && b.tags.toLowerCase().includes(searchTerm)),
    );
  }

  // Apply view-specific filters
  if (state.currentView === "recent") {
    filtered = filtered
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      )
      .slice(0, 20);
  } else {
    // Apply tag filter
    if (state.filterConfig.tags.length > 0) {
      filtered = filtered.filter((b) => {
        if (!b.tags) return false;
        const bTags = b.tags.split(",").map((t) => t.trim());
        if (state.filterConfig.tagMode === "AND") {
          return state.filterConfig.tags.every((t: string) =>
            bTags.includes(t),
          );
        } else {
          return state.filterConfig.tags.some((t: string) => bTags.includes(t));
        }
      });
    }

    // Apply sort
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

  // --- Virtualization parameters ---
  const ROW_HEIGHT = state.viewMode === "compact" ? 40 : 120; // px, estimate
  const BUFFER = 8; // extra rows above/below
  const total = filtered.length;
  let viewportHeight = container.clientHeight || 600;
  let scrollTop = container.scrollTop || 0;
  // Fallback for SSR or hidden containers
  if (!viewportHeight) viewportHeight = 600;

  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + BUFFER;
  let start = Math.max(
    0,
    Math.floor(scrollTop / ROW_HEIGHT) - Math.floor(BUFFER / 2),
  );
  let end = Math.min(total, start + visibleCount);

  // If user is at the bottom, ensure last items are visible
  if (end === total) start = Math.max(0, end - visibleCount);

  // Use RichBookmarkCard if rich link previews are enabled
  const cardRenderer =
    state.richLinkPreviewsEnabled && state.viewMode === "grid"
      ? RichBookmarkCard
      : createBookmarkCard;

  // Keyed row update: use bookmark id as key
  const existing = new Map();
  Array.from(container.children).forEach((el) => {
    const id = el.getAttribute && el.getAttribute("data-bookmark-id");
    if (id) existing.set(id, el);
  });

  // Track which bookmarks are still present
  const seen = new Set();
  const frag = document.createDocumentFragment();

  // Spacer above
  if (start > 0) {
    const spacer = document.createElement("div");
    spacer.style.height = `${start * ROW_HEIGHT}px`;
    spacer.setAttribute("data-virtual-spacer", "top");
    frag.appendChild(spacer);
  }

  // Render only visible bookmarks
  for (let i = start; i < end; i++) {
    const b = filtered[i];
    const key = b.id;
    let el = existing.get(key);
    const newHTML = cardRenderer(b, i);
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-bookmark-id", key);
      el.innerHTML = newHTML;
    } else {
      if (el.innerHTML !== newHTML) {
        el.innerHTML = newHTML;
      }
      existing.delete(key);
    }
    frag.appendChild(el);
    seen.add(key);
  }

  // Spacer below
  if (end < total) {
    const spacer = document.createElement("div");
    spacer.style.height = `${(total - end) * ROW_HEIGHT}px`;
    spacer.setAttribute("data-virtual-spacer", "bottom");
    frag.appendChild(spacer);
  }

  // Remove any cards not in visible window
  existing.forEach((el, key) => {
    if (!seen.has(key)) el.remove();
  });

  // Batch DOM write: clear and append fragment
  while (container.firstChild) container.removeChild(container.firstChild);
  container.appendChild(frag);

  // Add load more sentinel if needed (optional: only if not virtualized)
  // ...existing code...

  // --- Virtualization scroll handler (type-safe) ---
  // Use a WeakMap to store scroll handlers per container
  const scrollHandlerMap: WeakMap<HTMLElement, () => void> =
    (window as any)._bookmarkScrollHandlerMap || new WeakMap();
  (window as any)._bookmarkScrollHandlerMap = scrollHandlerMap;

  if (!scrollHandlerMap.has(container)) {
    const handler = () => {
      renderBookmarks();
    };
    scrollHandlerMap.set(container, handler);
    container.addEventListener("scroll", handler);
  }

  // Defer non-urgent UI work
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => {
      attachBookmarkCardListeners();
      updateBulkUI();
    });
  } else {
    setTimeout(() => {
      attachBookmarkCardListeners();
      updateBulkUI();
    }, 0);
  }

  // Lazy load OG images for rich cards that don't have them (deferred)
  if (state.richLinkPreviewsEnabled && state.viewMode === "grid") {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        lazyLoadOGImages();
      });
    }
  }

  // Note: updateCounts() is now called explicitly by callers to avoid race conditions
}

// Lazy load OG images for rich cards that don't have them
async function lazyLoadOGImages(): Promise<void> {
  const container = document.getElementById("bookmarks-container");
  if (!container) return;

  // Find all placeholders that need OG images
  const placeholders = Array.from(
    container.querySelectorAll(
      ".rich-card-image-placeholder[data-bookmark-id]",
    ),
  ) as HTMLElement[];

  if (placeholders.length === 0) return;

  // Process sequentially with delays to respect rate limits
  // Rate limit is 100 requests/minute, so we'll do max 1 request per second to be safe
  let rateLimitHit = false;

  for (const placeholder of placeholders) {
    // If we hit rate limit, wait longer before continuing
    if (rateLimitHit) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      rateLimitHit = false;
    }

    const bookmarkId = placeholder.dataset.bookmarkId;
    const bookmarkUrl = placeholder.dataset.bookmarkUrl;

    if (!bookmarkId || !bookmarkUrl) continue;

    // Check if bookmark already has og_image or thumbnail_local (might have been updated)
    const bookmark = state.bookmarks.find((b) => b.id === bookmarkId);
    if (bookmark && (bookmark.og_image || bookmark.thumbnail_local)) {
      // Update the card with existing image
      updateRichCardImage(bookmarkId, bookmark.og_image || bookmark.thumbnail_local!);
      continue;
    }

    try {
      // Step 1: Try to fetch OG image from metadata
      let metadata: { og_image?: string } | null = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && !metadata) {
        try {
          metadata = await api<{ og_image?: string }>(
            "/bookmarks/fetch-metadata",
            {
              method: "POST",
              body: JSON.stringify({ url: bookmarkUrl }),
            },
          );
          rateLimitHit = false; // Reset rate limit flag on success
        } catch (err: any) {
          if (
            err.message?.includes("429") ||
            err.message?.includes("Too Many Requests")
          ) {
            rateLimitHit = true;
            // Exponential backoff: wait 2^retries seconds
            const waitTime = Math.min(1000 * Math.pow(2, retries), 10000);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            retries++;
            if (retries >= maxRetries) {
              logger.debug("Rate limited, skipping remaining OG image fetches");
              return; // Stop processing if we hit rate limit multiple times
            }
            continue;
          }
          throw err; // Re-throw non-rate-limit errors
        }
      }

      if (metadata?.og_image) {
        // Update bookmark in state with og_image
        const bookmarkIndex = state.bookmarks.findIndex(
          (b) => b.id === bookmarkId,
        );
        if (bookmarkIndex !== -1) {
          state.bookmarks[bookmarkIndex].og_image = metadata.og_image;

          // Update bookmark on server (with retry for rate limits)
          try {
            await api(`/bookmarks/${bookmarkId}`, {
              method: "PUT",
              body: JSON.stringify({ og_image: metadata.og_image }),
            });
          } catch (err: any) {
            if (err.message?.includes("429")) {
              rateLimitHit = true;
              logger.debug("Rate limited on bookmark update, will retry later");
            }
          }

          // Update the card visually
          updateRichCardImage(bookmarkId, metadata.og_image);
        }
      } else {
        // Step 2: No og_image found, try to generate a screenshot thumbnail
        logger.debug("No og_image found, requesting thumbnail generation", { bookmarkId });

        try {
          const thumbnailResult = await api<{ success: boolean; thumbnail_local?: string }>(
            `/bookmarks/${bookmarkId}/thumbnail`,
            { method: "POST" },
          );

          if (thumbnailResult.success && thumbnailResult.thumbnail_local) {
            // Update bookmark in state with thumbnail_local
            const bookmarkIndex = state.bookmarks.findIndex(
              (b) => b.id === bookmarkId,
            );
            if (bookmarkIndex !== -1) {
              state.bookmarks[bookmarkIndex].thumbnail_local = thumbnailResult.thumbnail_local;
            }

            // Update the card visually
            updateRichCardImage(bookmarkId, thumbnailResult.thumbnail_local);
          }
        } catch (thumbnailErr: any) {
          // Thumbnail generation failed (e.g., page couldn't be loaded)
          logger.debug("Thumbnail generation failed", {
            bookmarkId,
            error: thumbnailErr.message,
          });
        }
      }
    } catch (err) {
      // Log but continue processing other bookmarks
      logger.debug("Failed to fetch OG image for bookmark", {
        bookmarkId,
        error: err,
      });
    }

    // Delay between requests to avoid rate limiting (1 request per second max)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Update a rich card's image when OG image is loaded
function updateRichCardImage(bookmarkId: string, ogImage: string): void {
  const container = document.getElementById("bookmarks-container");
  if (!container) return;

  const card = container.querySelector(
    `.rich-bookmark-card[data-id="${bookmarkId}"]`,
  ) as HTMLElement;
  if (!card) return;

  const placeholder = card.querySelector(".rich-card-image-placeholder");
  if (!placeholder) return;

  // Replace placeholder with image
  placeholder.outerHTML = `<div class="rich-card-image">
    <img src="${escapeHtml(ogImage)}" alt="" loading="lazy">
  </div>`;
}

// Attach event listeners to bookmark cards
export function attachBookmarkCardListeners(): void {
  const container = document.getElementById("bookmarks-container");
  if (!container) return;

  // Event delegation for card click and checkbox
  container.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(
      ".bookmark-card, .rich-bookmark-card",
    ) as HTMLElement | null;
    if (!card) return;

    // Checkbox click
    if ((e.target as HTMLElement).classList.contains("bookmark-select")) {
      e.stopPropagation();
      const id = card.dataset.id || "";
      const index = parseInt(card.dataset.index || "0", 10);
      toggleBookmarkSelection(id, index, (e as MouseEvent).shiftKey, true);
      return;
    }

    // Ignore clicks on action buttons or tags
    if ((e.target as HTMLElement).closest(".bookmark-actions")) return;
    if ((e.target as HTMLElement).closest(".bookmark-tags")) return;

    const id = card.dataset.id || "";
    const index = parseInt(card.dataset.index || "0", 10);

    if (state.bulkMode) {
      toggleBookmarkSelection(id, index, (e as MouseEvent).shiftKey, true);
      return;
    }

    // Get the bookmark from state
    const bookmark = state.bookmarks.find((b) => b.id === id);
    if (!bookmark) return;

    const url = bookmark.url;

    // Handle special URL schemes
    if (url.startsWith("view:")) {
      const viewId = url.substring(5);
      if (state.currentView === "dashboard") {
        import("@features/bookmarks/dashboard.ts").then(({ restoreView }) => {
          restoreView(viewId);
        });
      }
      return;
    }
    if (url.startsWith("bookmark-view:")) {
      const viewId = url.substring(14);
      restoreBookmarkView(viewId);
      return;
    }
    // Regular bookmark - track and open
    trackClick(bookmark.id);
    window.open(url, "_blank", "noopener,noreferrer");
  });

  // Favicon error handler (still per-card, as event delegation for 'error' is not supported)
  container.querySelectorAll(".bookmark-favicon-img").forEach((faviconImg) => {
    if ((faviconImg as HTMLElement).dataset.fallback === "true") {
      faviconImg.addEventListener("error", (e) => {
        const parent = (e.target as HTMLElement).parentElement;
        if (parent) {
          parent.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }
      });
    }
  });
}

// Setup infinite scroll
function setupInfiniteScroll(allFiltered: Bookmark[]): void {
  const sentinel = document.getElementById("load-more-sentinel");
  if (!sentinel) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !state.isLoadingMore) {
        loadMoreBookmarks(allFiltered);
      }
    },
    { rootMargin: "100px" },
  );

  observer.observe(sentinel);
}

// Load more bookmarks for infinite scroll
function loadMoreBookmarks(allFiltered: Bookmark[]): void {
  if (state.isLoadingMore) return;
  if (state.displayedCount >= allFiltered.length) return;

  state.setIsLoadingMore(true);

  setTimeout(() => {
    const prevCount = state.displayedCount;
    state.setDisplayedCount(
      Math.min(
        state.displayedCount + state.BOOKMARKS_PER_PAGE,
        allFiltered.length,
      ),
    );

    const newBookmarks = allFiltered.slice(prevCount, state.displayedCount);
    const sentinel = document.getElementById("load-more-sentinel");

    const newHtml = newBookmarks
      .map((b, i) => createBookmarkCard(b, prevCount + i))
      .join("");
    if (sentinel) {
      sentinel.insertAdjacentHTML("beforebegin", newHtml);
    }

    attachBookmarkCardListeners();

    if (state.displayedCount >= allFiltered.length && sentinel) {
      sentinel.remove();
    }

    state.setIsLoadingMore(false);
  }, 100);
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
    const name = prompt("Enter a name for this view:");
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
async function restoreBookmarkView(id: string) {
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
