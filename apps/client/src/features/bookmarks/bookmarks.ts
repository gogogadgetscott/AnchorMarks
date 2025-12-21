/**
 * AnchorMarks - Bookmarks Module
 * Handles bookmark CRUD operations and rendering
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { escapeHtml } from "@utils/index.ts";
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
import { BookmarkCard as createBookmarkCard } from "@components/index.ts";
export { createBookmarkCard };

// Note: renderDashboard, renderSidebarTags, and checkWelcomeTour are loaded dynamically
// to avoid circular dependencies

// Load bookmarks from server
export async function loadBookmarks(): Promise<void> {
  try {
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

    const bookmarks = await api(endpoint);
    state.setBookmarks(bookmarks);

    // Load tags metadata for color/icon rendering
    try {
      const tags = await api("/tags");
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
      console.error("Failed to load tag metadata:", err);
      // Continue without tag metadata
    }

    if (state.currentView === "dashboard") {
      const { renderDashboard } =
        await import("@features/bookmarks/dashboard.ts");
      renderDashboard();
    } else if (state.currentView === "tag-cloud") {
      const { renderTagCloud } =
        await import("@features/bookmarks/tag-cloud.ts");
      renderTagCloud();
    } else {
      renderBookmarks();
    }
    await updateCounts();

    // Update active nav to reflect current view
    updateActiveNav();

    // Initialize bookmark views UI if in bookmark view
    if (
      state.currentView !== "dashboard" &&
      state.currentView !== "tag-cloud"
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

  // Set container class based on view mode
  const classMap = {
    grid: "bookmarks-grid",
    list: "bookmarks-list",
    compact: "bookmarks-compact",
  };
  container.className = classMap[state.viewMode] || "bookmarks-grid";

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
          return state.filterConfig.tags.every((t) => bTags.includes(t));
        } else {
          return state.filterConfig.tags.some((t) => bTags.includes(t));
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

  // Lazy loading
  const toRender = filtered.slice(0, state.displayedCount);
  const hasMore = filtered.length > state.displayedCount;

  container.innerHTML = toRender
    .map((b, i) => createBookmarkCard(b, i))
    .join("");

  if (hasMore) {
    container.innerHTML += `
            <div id="load-more-sentinel" class="load-more-sentinel">
                <div class="loading-spinner"></div>
                <span>Loading more bookmarks...</span>
            </div>
        `;
    setupInfiniteScroll(filtered);
  }

  attachBookmarkCardListeners();
  updateBulkUI();
  // Note: updateCounts() is now called explicitly by callers to avoid race conditions
}

// Attach event listeners to bookmark cards
export function attachBookmarkCardListeners(): void {
  const container = document.getElementById("bookmarks-container");
  if (!container) return;

  container.querySelectorAll(".bookmark-card").forEach((card) => {
    if ((card as HTMLElement).dataset.listenerAttached) return;
    (card as HTMLElement).dataset.listenerAttached = "true";

    card.addEventListener("click", (e) => {
      const id = (card as HTMLElement).dataset.id || "";
      const index = parseInt((card as HTMLElement).dataset.index || "0", 10);

      // Ignore clicks on action buttons or select checkbox
      if ((e.target as HTMLElement).closest(".bookmark-actions")) return;
      if ((e.target as HTMLElement).closest(".bookmark-select")) return;
      if ((e.target as HTMLElement).closest(".bookmark-tags")) return;

      if (state.bulkMode) {
        toggleBookmarkSelection(id, index, (e as MouseEvent).shiftKey, true);
        return;
      }

      // Get the bookmark from state
      const bookmark = state.bookmarks.find((b) => b.id === id);
      if (!bookmark) return;

      const url = bookmark.url;

      // Handle special URL schemes
      // Handle special URL schemes
      if (url.startsWith("view:")) {
        // Dashboard view shortcut
        const viewId = url.substring(5);
        if (state.currentView === "dashboard") {
          import("@features/bookmarks/dashboard.ts").then(({ restoreView }) => {
            restoreView(viewId);
          });
        }
        return;
      }

      if (url.startsWith("bookmark-view:")) {
        // Bookmark view shortcut
        const viewId = url.substring(14);
        restoreBookmarkView(viewId);
        return;
      }

      // Regular bookmark - track and open
      trackClick(bookmark.id);
      window.open(url, "_blank", "noopener,noreferrer");
    });

    const checkbox = card.querySelector(".bookmark-select");
    if (checkbox) {
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = (card as HTMLElement).dataset.id || "";
        const index = parseInt((card as HTMLElement).dataset.index || "0", 10);
        toggleBookmarkSelection(id, index, (e as MouseEvent).shiftKey, true);
      });
    }

    // Handle favicon image errors with proper event listener
    const faviconImg = card.querySelector(".bookmark-favicon-img");
    if (faviconImg && (faviconImg as HTMLElement).dataset.fallback === "true") {
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
    const bookmark = await api("/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    });
    state.bookmarks.unshift(bookmark);
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
    const bookmark = await api(`/bookmarks/${id}`, {
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
    console.error("Failed to update bookmark:", err);
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
    console.error("Failed to archive bookmark:", err);
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
    console.error("Failed to unarchive bookmark:", err);
    showToast("Failed to unarchive bookmark", "error");
  }
}

// Delete bookmark
export async function deleteBookmark(id: string): Promise<void> {
  if (!confirm("Delete this bookmark?")) return;

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

  // Remove dashboard views button if it exists
  document.getElementById("dashboard-views-btn")?.remove();

  // Check if button already exists
  if (document.getElementById("bookmark-views-btn")) return;

  const btn = document.createElement("button");
  btn.id = "bookmark-views-btn";
  btn.className = "btn btn-secondary";
  btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Views
    `;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    showBookmarkViewsMenu();
  });

  headerRight.insertBefore(btn, headerRight.firstChild);
}

// Show bookmark views dropdown menu
async function showBookmarkViewsMenu() {
  // Remove existing dropdown if any
  document.getElementById("bookmark-views-dropdown")?.remove();

  const views = await loadBookmarkViews();

  const dropdown = document.createElement("div");
  dropdown.id = "bookmark-views-dropdown";
  dropdown.className = "dropdown-menu";
  dropdown.style.cssText =
    "position:absolute;top:3rem;right:1rem;z-index:1000;min-width:250px";

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
    (e.target as HTMLElement).id !== "bookmark-views-btn"
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

    console.log("[Bookmark View] Saving view with config:", config);
    console.log(
      "[Bookmark View] Current filterConfig state:",
      state.filterConfig,
    );

    const view = await api("/bookmark/views", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });

    console.log("[Bookmark View] View saved with ID:", view.id);

    showToast("View saved!", "success");
    document.getElementById("bookmark-views-dropdown")?.remove();

    // Prompt to create bookmark shortcut
    if (confirm("Create a bookmark shortcut for this view?")) {
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
  if (!confirm("Delete this view?")) return;
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
    console.log("[Bookmark View] Restoring view ID:", id);

    const response = await api(`/bookmark/views/${id}/restore`, {
      method: "POST",
    });
    const config = response.config;

    console.log("[Bookmark View] Received config:", config);
    console.log(
      "[Bookmark View] Current filterConfig before restore:",
      state.filterConfig,
    );

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

    console.log(
      "[Bookmark View] filterConfig after restore:",
      state.filterConfig,
    );

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

    console.log("[Bookmark View] Reloading bookmarks...");

    // Reload bookmarks with filters applied (this will fetch from server with filters)
    await loadBookmarks();

    // Save current view to ensure we stay in bookmark view
    // @ts-ignore
    const { saveSettings } = await import("@features/bookmarks/settings.ts");
    await saveSettings({ current_view: state.currentView });

    showToast("View restored!", "success");
    document.getElementById("bookmark-views-dropdown")?.remove();
  } catch (err: any) {
    console.error("[Bookmark View] Error restoring view:", err);
    showToast(err.message, "error");
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
