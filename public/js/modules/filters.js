/**
 * AnchorMarks - Filter Dropdown Module
 * Full-width filter bar in header
 */

import * as state from "./state.js";
import { escapeHtml } from "./utils.js";
import { showToast } from "./ui.js";
import { saveSettings } from "./settings.js";

let filterDropdownPinned = false;

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
        Filters
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
                        <svg viewBox="0 0 24 24" fill="${filterDropdownPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <path d="M12 2v3m0 14v3m-3-3h6m-6-3l.75-7.5a1.5 1.5 0 0 1 3 0L13.5 13M9 16h6"/>
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
                        <div class="filter-grid" id="filter-folders-container"></div>
                    </div>
                    
                    <!-- Tags Section -->
                    <div class="filter-column">
                        <h4>Tags</h4>
                        <div class="filter-grid" id="filter-tags-container"></div>
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

    // Render active filters
    renderActiveFilters();

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

  // Get all top-level folders and "No Folder"
  const topLevelFolders = state.folders.filter((f) => !f.parent_id);

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

  // Render top-level folders with counts
  topLevelFolders.sort((a, b) => (a.position || 0) - (b.position || 0));
  topLevelFolders.forEach((folder) => {
    const count = getFolderBookmarkCount(folder.id);
    if (count === 0) return; // Skip empty folders

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

  container.innerHTML =
    html ||
    '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No folders</p>';

  // Attach click handlers
  container.querySelectorAll(".filter-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const folderId = item.dataset.folderId;

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
      await renderFoldersInDropdown(); // Re-render to update active state
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

  // Attach click handlers
  container.querySelectorAll(".filter-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const tagName = item.dataset.tag;
      const currentTags = [...state.filterConfig.tags];

      if (currentTags.includes(tagName)) {
        // Remove tag
        const index = currentTags.indexOf(tagName);
        currentTags.splice(index, 1);
      } else {
        // Add tag
        currentTags.push(tagName);
      }

      state.setFilterConfig({
        ...state.filterConfig,
        tags: currentTags,
      });

      await applyFilters();
      await renderTagsInDropdown(); // Re-render to update active state
    });
  });
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

  showToast("All filters cleared", "success");
}

// Export functions
export { filterDropdownPinned };
