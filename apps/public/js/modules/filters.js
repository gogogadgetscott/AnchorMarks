/**
 * AnchorMarks - Filter Dropdown Module
 * Full-width filter bar in header
 */

import * as state from "./state.js";
import { api } from "./api.js";
import { escapeHtml } from "./utils.js";
import { showToast } from "./ui.js";
import { saveSettings } from "./settings.js";
import { renderActiveFilters } from "./search.js";

let filterDropdownPinned = false;

// Count active filters
function getActiveFilterCount() {
  let count = 0;

  // Count active tags
  if (state.filterConfig.tags && state.filterConfig.tags.length > 0) {
    count += state.filterConfig.tags.length;
  }

  // Count search term
  const searchInput = document.getElementById("search-input");
  if (searchInput && searchInput.value.trim()) {
    count += 1;
  }

  // Count folder filter (if not "all" view)
  if (state.currentFolder) {
    count += 1;
  }

  // Count collection filter
  if (state.currentView === "collection" && state.currentCollection) {
    count += 1;
  }

  return count;
}

// Update filter button text with count
export function updateFilterButtonText() {
  const filterBtn = document.getElementById("filter-dropdown-btn");
  if (!filterBtn) return;

  const count = getActiveFilterCount();
  const textSpan = filterBtn.querySelector(".filter-btn-text");

  if (textSpan) {
    if (count > 0) {
      textSpan.textContent = `Filters (${count})`;
    } else {
      textSpan.textContent = "Filters";
    }
  }
}

// Show/hide filter button based on current view
export function updateFilterButtonVisibility() {
  const filterBtn = document.getElementById("filter-dropdown-btn");
  if (!filterBtn) return;

  const bookmarksViews = ["all", "folder", "collection"];
  if (bookmarksViews.includes(state.currentView)) {
    filterBtn.style.display = "";
    updateFilterButtonText();
    // If filter was pinned, restore it when coming back to bookmarks view
    if (filterDropdownPinned && !document.getElementById("filter-dropdown")) {
      showFilterDropdown();
    }
  } else {
    filterBtn.style.display = "none";
    closeFilterDropdown();
  }
}

// Initialize filter dropdown
export function initFilterDropdown() {
  const headerRight = document.querySelector(".header-right");
  if (!headerRight) return;

  // Remove existing filter button
  document.getElementById("filter-dropdown-btn")?.remove();

  const btn = document.createElement("button");
  btn.id = "filter-dropdown-btn";
  btn.className = "btn btn-secondary";
  btn.title = "Filters";
  btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
        </svg>
        <span class="filter-btn-text">Filters</span>
    `;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFilterDropdown();
  });

  // Insert after search input or at beginning
  const searchInput = document.getElementById("search-input");
  if (searchInput && searchInput.parentElement) {
    searchInput.parentElement.after(btn);
  } else {
    headerRight.insertBefore(btn, headerRight.firstChild);
  }
}

// Toggle filter dropdown
export function toggleFilterDropdown() {
  console.log("toggleFilterDropdown called");

  // Only allow filter dropdown in bookmarks views
  const bookmarksViews = ["all", "folder", "collection"];
  if (!bookmarksViews.includes(state.currentView)) {
    console.log(
      "Filter dropdown only available in bookmarks view. Current view:",
      state.currentView,
    );
    return;
  }

  const existing = document.getElementById("filter-dropdown");
  console.log("Existing dropdown:", existing);
  if (existing) {
    closeFilterDropdown();
  } else {
    console.log("Showing filter dropdown...");
    showFilterDropdown();
  }
}

// Show filter dropdown
export async function showFilterDropdown() {
  console.log("showFilterDropdown started");

  // Only show filter dropdown in bookmarks view (all, folder, collection)
  // Hide for dashboard, favorites, recent
  const bookmarksViews = ["all", "folder", "collection"];
  if (!bookmarksViews.includes(state.currentView)) {
    console.log(
      "Filter dropdown only available in bookmarks view. Current view:",
      state.currentView,
    );
    return;
  }

  try {
    // Remove existing
    document.getElementById("filter-dropdown")?.remove();

    const dropdown = document.createElement("div");
    dropdown.id = "filter-dropdown";
    dropdown.className = "filter-dropdown";

    dropdown.innerHTML = `
            <div class="filter-dropdown-header">
                <span class="filter-dropdown-title">Filter Library</span>
                <div class="filter-dropdown-actions">
                    <button class="btn-icon" id="filter-pin-btn" title="${filterDropdownPinned ? "Unpin" : "Pin"}">
                        <svg width="14" height="14" viewBox="0 0 24 24"
                             xmlns="http://www.w3.org/2000/svg" fill="${filterDropdownPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5">
                          <path d="M7 2h10v2.5c0 .9-.4 1.7-1 2.3l-1 1v4.2l1.3.8c1.2.7 2.2 2 2.2 3.5 0 .4-.3.7-.7.7H13v5c0 .6-.4 1-1 1s-1-.4-1-1v-5H6.2c-.4 0-.7-.3-.7-.7 0-1.5 1-2.8 2.2-3.5l1.3-.8V7.8l-1-1C7.4 6 7 5.2 7 4.5V2z"/>
                        </svg>
                    </button>
                    <button class="btn-icon" id="filter-close-btn" title="Close">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="filter-dropdown-body">
                <div class="filter-row">
                    <!-- Folders Section -->
                    <div class="filter-column">
                        <h4>Folders</h4>
                        <input
                            type="text"
                            id="filter-folders-search"
                            class="form-input"
                            placeholder="Search folders..."
                            style="margin-bottom: 0.5rem; font-size: 0.875rem; padding: 0.4rem 0.6rem;"
                        />
                        <div class="filter-grid" id="filter-folders-container"></div>
                    </div>
                    
                    <!-- Tags Section -->
                    <div class="filter-column">
                        <h4>Tags</h4>
                        <input
                            type="text"
                            id="filter-tags-search"
                            class="form-input"
                            placeholder="Search tags..."
                            style="margin-bottom: 0.5rem; font-size: 0.875rem; padding: 0.4rem 0.6rem;"
                        />
                        <div class="filter-grid" id="filter-tags-container"></div>
                    </div>

                    <!-- Collections Section -->
                    <div class="filter-column">
                      <h4>Collections</h4>
                      <div class="filter-grid" id="filter-collections-container"></div>
                    </div>
                    
                    <!-- Sort & Options -->
                <div class="filter-column filter-column-controls">
                    <h4>Active Filters</h4>
                    <div class="filter-active-filters" id="filter-active-filters">
                        <span class="filter-no-active" id="filter-no-active">No filters active</span>
                    </div>
                    
                    <h4 style="margin-top: 1.5rem;">Sort & Search</h4>
                    <div class="filter-controls">
                        <div class="filter-control-group">
                            <label for="filter-sort-select">Sort by:</label>
                            <select id="filter-sort-select" class="filter-select">
                                <option value="recently_added">Recently Added</option>
                                <option value="a_z">A-Z</option>
                                <option value="z_a">Z-A</option>
                                <option value="most_visited">Most Visited</option>
                                <option value="oldest_first">Oldest First</option>
                            </select>
                        </div>
                        <div class="filter-control-group">
                            <label for="filter-tag-mode">Tag mode:</label>
                            <select id="filter-tag-mode" class="filter-select">
                                <option value="OR">Any tag (OR)</option>
                                <option value="AND">All tags (AND)</option>
                            </select>
                        </div>
                        <button class="btn btn-outline btn-sm btn-full" id="filter-clear-all">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;margin-right:4px">
                                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                            Clear All Filters
                        </button>
                    </div>
                </div>
                </div>
            </div>
        `;

    // Find the bookmarks header and insert after it
    const bookmarksHeader = document.getElementById("bookmarks-header");
    console.log("Bookmarks header found:", bookmarksHeader);
    console.log("Bookmarks header display:", bookmarksHeader?.style.display);

    if (bookmarksHeader && bookmarksHeader.style.display !== "none") {
      // Set bookmarks header to position relative so dropdown positions correctly
      bookmarksHeader.style.position = "relative";

      // Insert as next sibling of bookmarks header
      bookmarksHeader.insertAdjacentElement("afterend", dropdown);
      console.log("Dropdown inserted after bookmarks header");
      console.log("Dropdown element:", dropdown);
      console.log(
        "Dropdown in DOM:",
        document.getElementById("filter-dropdown"),
      );

      // Check computed styles
      const computedStyle = window.getComputedStyle(dropdown);
      console.log("Dropdown computed display:", computedStyle.display);
      console.log("Dropdown computed position:", computedStyle.position);
      console.log("Dropdown computed top:", computedStyle.top);
      console.log("Dropdown computed visibility:", computedStyle.visibility);
      console.log("Dropdown computed opacity:", computedStyle.opacity);
      console.log("Dropdown computed z-index:", computedStyle.zIndex);
      console.log("Dropdown bounding rect:", dropdown.getBoundingClientRect());
    } else {
      // Fallback: append to body if header not found
      console.log("Bookmarks header not visible, appending to body");
      document.body.appendChild(dropdown);
    }

    // Render folders and tags in dropdown containers
    console.log("Rendering folders...");
    await renderFoldersInDropdown();
    console.log("Rendering tags...");
    await renderTagsInDropdown();
    console.log("Rendering collections...");
    await renderCollectionsInDropdown();

    // Render active filters
    renderActiveFilters();
    renderDropdownActiveFilters();

    // Set current values
    const sortSelect = document.getElementById("filter-sort-select");
    if (sortSelect)
      sortSelect.value = state.filterConfig.sort || "recently_added";

    const tagModeSelect = document.getElementById("filter-tag-mode");
    if (tagModeSelect) tagModeSelect.value = state.filterConfig.tagMode || "OR";

    // Attach event listeners
    console.log("Attaching event listeners...");
    attachFilterDropdownListeners();

    // Setup auto-hide (if not pinned)
    if (!filterDropdownPinned) {
      setTimeout(() => {
        document.addEventListener("click", handleFilterDropdownClickOutside);
      }, 0);
    }

    console.log("showFilterDropdown completed successfully");
  } catch (error) {
    console.error("Error in showFilterDropdown:", error);
  }
}

// Filter folders based on search term
function filterFoldersInDropdown(searchTerm) {
  const container = document.getElementById("filter-folders-container");
  if (!container || !container._allFolders) return;

  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    container.innerHTML = container._originalHTML;
    attachFolderClickHandlers();
    return;
  }

  const filtered = container._allFolders.filter((folder) => {
    return folder.name.toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No folders found</p>';
    return;
  }

  let html = "";
  filtered.forEach((folder) => {
    const count = getFolderBookmarkCount(folder.id);
    const isActive = state.currentFolder === folder.id;
    const color = folder.color || "#6366f1";

    html += `
      <div class="filter-item ${isActive ? "active" : ""}" data-folder-id="${folder.id}">
          <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
              <span class="folder-color" style="background:${color}"></span>
              <span class="filter-item-name">${escapeHtml(folder.name)}</span>
          </div>
          <span class="filter-item-count">${count}</span>
      </div>
    `;
  });

  container.innerHTML = html;
  attachFolderClickHandlers();
}

// Filter tags based on search term
function filterTagsInDropdown(searchTerm) {
  const container = document.getElementById("filter-tags-container");
  if (!container || !container._allTags) return;

  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    container.innerHTML = container._originalHTML;
    attachTagClickHandlers();
    return;
  }

  const filtered = container._allTags.filter((tag) => {
    return tag.name.toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No tags found</p>';
    return;
  }

  let html = "";
  filtered.forEach((tag) => {
    const isActive = state.filterConfig.tags.includes(tag.name);

    html += `
      <div class="filter-item ${isActive ? "active" : ""}" data-tag="${escapeHtml(tag.name)}">
          <span class="filter-item-name">${escapeHtml(tag.name)}</span>
          <span class="filter-item-count">${tag.count}</span>
      </div>
    `;
  });

  container.innerHTML = html;
  attachTagClickHandlers();
}

// Attach folder click handlers
function attachFolderClickHandlers() {
  const container = document.getElementById("filter-folders-container");
  if (!container) return;

  container.querySelectorAll(".filter-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const folderId = item.dataset.folderId;

      state.setCurrentCollection(null);

      if (folderId === "all") {
        state.setCurrentView("all");
        state.setCurrentFolder(null);
      } else if (folderId === "null") {
        state.setCurrentView("folder");
        state.setCurrentFolder(null);
      } else {
        state.setCurrentView("folder");
        state.setCurrentFolder(folderId);
      }

      await applyFilters();
      renderDropdownActiveFilters();
      renderActiveFilters();
      updateFilterButtonText();
      await renderFoldersInDropdown();
      watchViewChanges();
    });
  });
}

// Attach tag click handlers
function attachTagClickHandlers() {
  const container = document.getElementById("filter-tags-container");
  if (!container) return;

  container.querySelectorAll(".filter-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const tagName = item.dataset.tag;
      const currentTags = [...state.filterConfig.tags];

      if (currentTags.includes(tagName)) {
        const index = currentTags.indexOf(tagName);
        currentTags.splice(index, 1);
      } else {
        currentTags.push(tagName);
      }

      state.setFilterConfig({
        ...state.filterConfig,
        tags: currentTags,
      });

      await applyFilters();
      renderDropdownActiveFilters();
      renderActiveFilters();
      updateFilterButtonText();
      await renderTagsInDropdown();
    });
  });
}

// Helper: Get all descendant folder IDs
function getAllDescendantFolderIds(folderId) {
  const descendants = [];
  const children = state.folders.filter((f) => f.parent_id === folderId);

  children.forEach((child) => {
    descendants.push(child.id);
    descendants.push(...getAllDescendantFolderIds(child.id));
  });

  return descendants;
}

// Helper: Get bookmark count for a folder (including subfolders)
function getFolderBookmarkCount(folderId) {
  if (!folderId || folderId === "null" || folderId === "all") {
    // Count bookmarks with no folder
    return state.bookmarks.filter((b) => !b.folder_id).length;
  }

  // Get all descendant folder IDs
  const descendantIds = getAllDescendantFolderIds(folderId);
  descendantIds.push(folderId);

  return state.bookmarks.filter((b) => descendantIds.includes(b.folder_id))
    .length;
}

// Helper: Get bookmark count for a tag
function getTagBookmarkCount(tagName) {
  return state.bookmarks.filter((b) => {
    if (!b.tags) return false;
    const tags = b.tags.split(",").map((t) => t.trim());
    return tags.includes(tagName);
  }).length;
}

// Render folders in dropdown
async function renderFoldersInDropdown() {
  const container = document.getElementById("filter-folders-container");
  if (!container) return;

  // Add "All Bookmarks" option
  const allCount = state.bookmarks.length;
  const noFolderCount = getFolderBookmarkCount(null);

  let html = "";

  // All Bookmarks
  const isAllActive = !state.currentFolder && state.currentView === "all";
  html += `
        <div class="filter-item ${isAllActive ? "active" : ""}" data-folder-id="all">
            <span class="filter-item-name">All Bookmarks</span>
            <span class="filter-item-count">${allCount}</span>
        </div>
    `;

  // No Folder
  if (noFolderCount > 0) {
    const isNoFolderActive =
      !state.currentFolder && state.currentView === "folder";
    html += `
            <div class="filter-item ${isNoFolderActive ? "active" : ""}" data-folder-id="null">
                <span class="filter-item-name">No Folder</span>
                <span class="filter-item-count">${noFolderCount}</span>
            </div>
        `;
  }

  // Recursive function to render folder tree
  const renderFolderTree = (parentId = null, depth = 0) => {
    const folderList = state.folders.filter((f) => f.parent_id === parentId);
    folderList.sort((a, b) => (a.position || 0) - (b.position || 0));

    folderList.forEach((folder) => {
      const count = getFolderBookmarkCount(folder.id);

      // Even if count is 0, we might want to show it if it has children?
      // strict "if (count === 0) return" might hide parents with children but no bookmarks themselves.
      // But adhering to previous logic:
      if (count === 0 && !state.folders.some((f) => f.parent_id === folder.id))
        return;

      const isActive = state.currentFolder === folder.id;
      const color = folder.color || "#6366f1";
      const paddingLeft = depth * 1.5; // 1.5rem per indentation level

      html += `
            <div class="filter-item ${isActive ? "active" : ""}" data-folder-id="${folder.id}" style="padding-left: ${0.5 + paddingLeft}rem">
                <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
                    <span class="folder-color" style="background:${color}"></span>
                    <span class="filter-item-name">${escapeHtml(folder.name)}</span>
                </div>
                <span class="filter-item-count">${count}</span>
            </div>
        `;

      // Render children
      renderFolderTree(folder.id, depth + 1);
    });
  };

  // Start with top-level folders
  renderFolderTree(null, 0);

  container.innerHTML =
    html ||
    '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No folders</p>';

  // Store original data for filtering
  container._allFolders = [
    { id: "all", name: "All Bookmarks" },
    ...(noFolderCount > 0 ? [{ id: "null", name: "No Folder" }] : []),
    ...state.folders,
  ];
  container._originalHTML = container.innerHTML;

  // Attach click handlers
  attachFolderClickHandlers();
}

// Render smart collections in dropdown
async function renderCollectionsInDropdown() {
  const container = document.getElementById("filter-collections-container");
  if (!container) return;

  try {
    const collections = await api("/collections");
    state.setCollections(Array.isArray(collections) ? collections : []);
  } catch (err) {
    console.error("Failed to load collections:", err);
    state.setCollections([]);
  }

  if (!state.collections || state.collections.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No collections yet</p>';
    return;
  }

  container.innerHTML = state.collections
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((c) => {
      const isActive =
        state.currentView === "collection" && state.currentCollection === c.id;
      const color = c.color || "#6366f1";
      return `
        <div class="filter-item ${isActive ? "active" : ""}" data-collection-id="${escapeHtml(c.id)}">
          <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
            <span class="folder-color" style="background:${color}"></span>
            <span class="filter-item-name">${escapeHtml(c.name)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".filter-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const collectionId = item.dataset.collectionId;
      const collection = state.collections.find((c) => c.id === collectionId);

      state.setCurrentFolder(null);
      state.setCurrentView("collection");
      state.setCurrentCollection(collectionId);

      const viewTitle = document.getElementById("view-title");
      if (viewTitle) viewTitle.textContent = collection?.name || "Collection";

      await applyFilters();
      renderDropdownActiveFilters();
      renderActiveFilters();
      updateFilterButtonText();
      await renderCollectionsInDropdown();
      watchViewChanges(); // Close dropdown if not pinned
    });
  });
}

// Render tags in dropdown
async function renderTagsInDropdown() {
  const container = document.getElementById("filter-tags-container");
  if (!container) return;

  // Collect all unique tags with counts
  const tagMap = new Map();
  state.bookmarks.forEach((b) => {
    if (b.tags) {
      b.tags.split(",").forEach((t) => {
        const tag = t.trim();
        if (tag) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      });
    }
  });

  // Convert to array and sort by count (most used first)
  const tags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      // Apply tag sort from filter config
      if (state.filterConfig.tagSort === "name_asc") {
        return a.name.localeCompare(b.name);
      } else if (state.filterConfig.tagSort === "name_desc") {
        return b.name.localeCompare(a.name);
      } else if (state.filterConfig.tagSort === "count_asc") {
        return a.count - b.count;
      } else {
        // count_desc (default)
        return b.count - a.count;
      }
    });

  if (tags.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No tags yet</p>';
    return;
  }

  let html = "";
  tags.forEach((tag) => {
    const isActive = state.filterConfig.tags.includes(tag.name);

    html += `
            <div class="filter-item ${isActive ? "active" : ""}" data-tag="${escapeHtml(tag.name)}">
                <span class="filter-item-name">${escapeHtml(tag.name)}</span>
                <span class="filter-item-count">${tag.count}</span>
            </div>
        `;
  });

  container.innerHTML = html;

  // Store original data for filtering
  container._allTags = tags;
  container._originalHTML = container.innerHTML;

  // Attach click handlers
  attachTagClickHandlers();
}

// Attach event listeners to dropdown elements
function attachFilterDropdownListeners() {
  // Pin button
  const pinBtn = document.getElementById("filter-pin-btn");
  if (pinBtn) {
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      filterDropdownPinned = !filterDropdownPinned;

      // Update icon
      const svg = pinBtn.querySelector("svg");
      if (svg) {
        svg.setAttribute(
          "fill",
          filterDropdownPinned ? "currentColor" : "none",
        );
      }
      pinBtn.title = filterDropdownPinned ? "Unpin" : "Pin";

      // Toggle auto-hide behavior
      if (filterDropdownPinned) {
        document.removeEventListener("click", handleFilterDropdownClickOutside);
      } else {
        setTimeout(() => {
          document.addEventListener("click", handleFilterDropdownClickOutside);
        }, 0);
      }

      showToast(
        `Filters ${filterDropdownPinned ? "pinned" : "unpinned"}`,
        "success",
      );
    });
  }

  // Close button
  const closeBtn = document.getElementById("filter-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeFilterDropdown();
    });
  }

  // Sort select
  const sortSelect = document.getElementById("filter-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      state.setFilterConfig({
        ...state.filterConfig,
        sort: sortSelect.value,
      });
      applyFilters();
    });
  }

  // Tag mode select
  const tagModeSelect = document.getElementById("filter-tag-mode");
  if (tagModeSelect) {
    tagModeSelect.addEventListener("change", () => {
      state.setFilterConfig({
        ...state.filterConfig,
        tagMode: tagModeSelect.value,
      });
      applyFilters();
    });
  }

  // Folder search input
  const folderSearchInput = document.getElementById("filter-folders-search");
  if (folderSearchInput) {
    folderSearchInput.addEventListener("input", (e) => {
      filterFoldersInDropdown(e.target.value);
    });
  }

  // Tag search input
  const tagSearchInput = document.getElementById("filter-tags-search");
  if (tagSearchInput) {
    tagSearchInput.addEventListener("input", (e) => {
      filterTagsInDropdown(e.target.value);
    });
  }

  // Clear all button
  const clearBtn = document.getElementById("filter-clear-all");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearAllFilters();
    });
  }
}

// Handle click outside to close (if not pinned)
function handleFilterDropdownClickOutside(e) {
  console.log("Click detected, checking if outside dropdown...");
  const dropdown = document.getElementById("filter-dropdown");
  const btn = document.getElementById("bookmarks-filter-btn");

  console.log("Dropdown:", dropdown);
  console.log("Button:", btn);
  console.log("Click target:", e.target);
  console.log("Contains check:", dropdown?.contains(e.target));
  console.log("Is pinned:", filterDropdownPinned);

  if (
    dropdown &&
    !dropdown.contains(e.target) &&
    e.target !== btn &&
    !btn?.contains(e.target)
  ) {
    console.log("Closing dropdown (clicked outside)");
    closeFilterDropdown();
  } else {
    console.log("Not closing - clicked inside or on button");
  }
}

// Close filter dropdown
export function closeFilterDropdown() {
  const dropdown = document.getElementById("filter-dropdown");
  if (dropdown) {
    dropdown.remove();
    document.removeEventListener("click", handleFilterDropdownClickOutside);
  }
}

// Watch for view changes and close dropdown if not in bookmarks view
export function watchViewChanges() {
  // This function is called after view changes
  // Only keep dropdown open if in bookmarks view (all, folder, collection)
  const bookmarksViews = ["all", "folder", "collection"];
  if (!bookmarksViews.includes(state.currentView)) {
    closeFilterDropdown();
  }
  updateFilterButtonVisibility();
}

// Apply filters to bookmarks
async function applyFilters() {
  const { loadBookmarks } = await import("./bookmarks.js");
  await loadBookmarks();
}

// Clear all filters
async function clearAllFilters() {
  state.setFilterConfig({
    search: "",
    tags: [],
    folder: null,
    sort: "recently_added",
    tagSort: "count_desc",
    tagMode: "OR",
  });

  state.setCurrentFolder(null);
  state.setCurrentCollection(null);
  state.setCurrentView("all");

  // Clear search input
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";

  // Reset dropdowns
  const sortSelect = document.getElementById("filter-sort-select");
  if (sortSelect) sortSelect.value = "recently_added";

  const tagModeSelect = document.getElementById("filter-tag-mode");
  if (tagModeSelect) tagModeSelect.value = "OR";

  // Reload
  await applyFilters();

  renderDropdownActiveFilters();
  renderActiveFilters();
  updateFilterButtonText();

  // Re-render lists to clear selection state
  await renderFoldersInDropdown();
  await renderTagsInDropdown();
  await renderCollectionsInDropdown();

  showToast("All filters cleared", "success");
  watchViewChanges(); // Close dropdown if not pinned
}

// Render active filters in dropdown
function renderDropdownActiveFilters() {
  const container = document.getElementById("filter-active-filters");
  if (!container) return;

  const tags = state.filterConfig.tags || [];
  const folderId = state.currentFolder;
  const collectionId = state.currentCollection;
  const searchTerm = document.getElementById("search-input")?.value?.trim();

  const activeItems = [];

  // Folder
  if (folderId) {
    const folder = state.folders.find((f) => f.id === folderId);
    if (folder)
      activeItems.push({ type: "folder", label: folder.name, id: folderId });
  }

  // Collection
  if (state.currentView === "collection" && collectionId) {
    const collection = state.collections.find((c) => c.id === collectionId);
    if (collection)
      activeItems.push({
        type: "collection",
        label: collection.name,
        id: collectionId,
      });
  }

  // Tags
  tags.forEach((tag) => {
    activeItems.push({ type: "tag", label: tag, id: tag });
  });

  // Search
  if (searchTerm) {
    activeItems.push({
      type: "search",
      label: `Search: ${searchTerm}`,
      id: "search",
    });
  }

  if (activeItems.length === 0) {
    container.innerHTML =
      '<span class="filter-no-active" id="filter-no-active">No filters active</span>';
    return;
  }

  let html = "";
  activeItems.forEach((item) => {
    let icon = "";
    if (item.type === "folder") {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>`;
    } else if (item.type === "collection") {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M9 18h6"/></svg>`;
    } else if (item.type === "tag") {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>`;
    } else {
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>`;
    }

    html += `
            <div class="filter-chip">
                ${icon}
                <span>${escapeHtml(item.label)}</span>
                <button class="btn-icon remove-filter-btn" data-type="${item.type}" data-id="${escapeHtml(item.id)}" style="padding:2px;width:14px;height:14px;margin-left:4px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `;
  });

  container.innerHTML = html;

  // Attach remove handlers
  container.querySelectorAll(".remove-filter-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const type = btn.dataset.type;
      const id = btn.dataset.id;

      if (type === "folder") {
        state.setCurrentFolder(null);
        state.setCurrentView("all");
      } else if (type === "collection") {
        state.setCurrentCollection(null);
        state.setCurrentView("all");
        const viewTitle = document.getElementById("view-title");
        if (viewTitle) viewTitle.textContent = "Bookmarks";
      } else if (type === "tag") {
        const newTags = state.filterConfig.tags.filter((t) => t !== id);
        state.setFilterConfig({ ...state.filterConfig, tags: newTags });
      } else if (type === "search") {
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
      }

      await applyFilters();
      renderDropdownActiveFilters();
      renderActiveFilters();
      updateFilterButtonText();

      // Update other UI components
      renderFoldersInDropdown();
      renderTagsInDropdown();
      renderCollectionsInDropdown();
      watchViewChanges(); // Close dropdown if not pinned
    });
  });
}

// Export functions
export { filterDropdownPinned };
