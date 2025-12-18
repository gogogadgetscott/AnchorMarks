/**
 * AnchorMarks - Widget Picker Module
 * Handles the add widget dropdown for dashboard
 */

import * as state from "@features/state.js";
import { escapeHtml } from "@utils/index.js";
import { showToast } from "@utils/ui-helpers.js";
import { addDashboardWidget } from "@features/bookmarks/dashboard.js";

// Track if dropdown is pinned
let widgetDropdownPinned = false;

// Toggle widget dropdown
export function toggleWidgetPicker() {
  const existing = document.getElementById("widget-dropdown");
  if (existing) {
    closeWidgetPicker();
  } else {
    openWidgetPicker();
  }
}

// Open widget picker dropdown
export function openWidgetPicker() {
  // Remove existing
  document.getElementById("widget-dropdown")?.remove();

  const dropdown = document.createElement("div");
  dropdown.id = "widget-dropdown";
  dropdown.className = "filter-dropdown"; // Reuse filter dropdown styles

  dropdown.innerHTML = `
    <div class="filter-dropdown-header">
      <span class="filter-dropdown-title">Add Widgets to Dashboard</span>
      <div class="filter-dropdown-actions">
        <button class="btn-icon" id="widget-pin-btn" title="${widgetDropdownPinned ? "Unpin" : "Pin"}">
          <svg viewBox="0 0 24 24" fill="${widgetDropdownPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
            <path d="M12 2v3m0 14v3m-3-3h6m-6-3l.75-7.5a1.5 1.5 0 0 1 3 0L13.5 13M9 16h6"/>
          </svg>
        </button>
        <button class="btn-icon" id="widget-close-btn" title="Close">
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
          <h4>📁 Folders</h4>
          <input type="text" id="widget-folders-search" placeholder="Search folders..." style="margin-bottom: 0.5rem; font-size: 0.875rem; padding: 0.4rem 0.6rem;" />
          <div class="filter-grid" id="widget-folders-container"></div>
        </div>
        
        <!-- Tags Section -->
        <div class="filter-column">
          <h4>🏷️ Tags</h4>
          <input type="text" id="widget-tags-search" placeholder="Search tags..." style="margin-bottom: 0.5rem; font-size: 0.875rem; padding: 0.4rem 0.6rem;" />
          <div class="filter-grid" id="widget-tags-container"></div>
        </div>
      </div>
    </div>
  `;

  // Find the dashboard header and insert after it
  const dashboardHeader = document.getElementById("dashboard-header");

  if (dashboardHeader && dashboardHeader.style.display !== "none") {
    dashboardHeader.style.position = "relative";
    dashboardHeader.insertAdjacentElement("afterend", dropdown);
  } else {
    // Fallback: append to body if header not found
    document.body.appendChild(dropdown);
  }

  // Render folders and tags
  renderWidgetPickerFolders();
  renderWidgetPickerTags();

  // Attach event listeners
  attachWidgetPickerListeners();

  // Setup auto-hide (if not pinned)
  if (!widgetDropdownPinned) {
    setTimeout(() => {
      document.addEventListener("click", handleWidgetPickerClickOutside);
    }, 0);
  }
}

// Close widget picker dropdown
export function closeWidgetPicker() {
  const dropdown = document.getElementById("widget-dropdown");
  if (dropdown) {
    dropdown.remove();
    document.removeEventListener("click", handleWidgetPickerClickOutside);
  }
}

// Filter folders in widget picker based on search term
function filterWidgetPickerFolders(searchTerm) {
  const container = document.getElementById("widget-folders-container");
  if (!container || !container._allFolders) return;

  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    container.innerHTML = container._originalHTML;
    attachWidgetFolderListeners();
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
    const bookmarkCount = state.bookmarks.filter(
      (b) => b.folder_id === folder.id,
    ).length;
    const isAdded = state.dashboardWidgets.some(
      (w) => w.type === "folder" && w.id === folder.id,
    );

    html += `
      <div class="filter-item widget-picker-item ${isAdded ? "added" : "draggable"}"
           data-type="folder"
           data-id="${folder.id}"
           data-name="${escapeHtml(folder.name)}"
           draggable="${!isAdded ? "true" : "false"}"
           style="${isAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}">
        <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
          <span class="folder-color" style="background:${folder.color || "#6366f1"}"></span>
          <span class="filter-item-name">${escapeHtml(folder.name)}</span>
        </div>
        <span class="filter-item-count">${bookmarkCount}</span>
        ${isAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
      </div>
    `;
  });

  container.innerHTML = html;
  attachWidgetFolderListeners();
}

// Filter tags in widget picker based on search term
function filterWidgetPickerTags(searchTerm) {
  const container = document.getElementById("widget-tags-container");
  if (!container || !container._allTags) return;

  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    container.innerHTML = container._originalHTML;
    attachWidgetTagListeners();
    return;
  }

  const filtered = container._allTags.filter((item) => {
    return item.name.toLowerCase().includes(term);
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No tags found</p>';
    return;
  }

  let html = "";
  filtered.forEach((item) => {
    if (item.type === "tag-analytics") {
      const analyticsAdded = state.dashboardWidgets.some(
        (w) => w.type === "tag-analytics" && w.id === "tag-analytics",
      );
      html += `
        <div class="filter-item widget-picker-item ${analyticsAdded ? "added" : "draggable"}"
             data-type="tag-analytics"
             data-id="tag-analytics"
             data-name="Tag Analytics"
             draggable="${!analyticsAdded ? "true" : "false"}"
             style="${analyticsAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}">
          <span class="filter-item-name">Tag Analytics</span>
          ${analyticsAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
        </div>
      `;
    } else {
      const isAdded = state.dashboardWidgets.some(
        (w) => w.type === "tag" && w.id === item.name,
      );

      html += `
        <div class="filter-item widget-picker-item ${isAdded ? "added" : "draggable"}"
             data-type="tag"
             data-id="${escapeHtml(item.name)}"
             data-name="${escapeHtml(item.name)}"
             draggable="${!isAdded ? "true" : "false"}"
             style="${isAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}">
          <span class="filter-item-name">${escapeHtml(item.name)}</span>
          <span class="filter-item-count">${item.count}</span>
          ${isAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
        </div>
      `;
    }
  });

  container.innerHTML = html;
  attachWidgetTagListeners();
}

// Attach event listeners to widget folder items
function attachWidgetFolderListeners() {
  const container = document.getElementById("widget-folders-container");
  if (!container) return;

  container.querySelectorAll(".widget-picker-item").forEach((item) => {
    const type = item.dataset.type;
    const id = item.dataset.id;
    const isAdded = item.classList.contains("added");

    if (isAdded) return;

    // Click to add
    item.addEventListener("click", () => {
      const dropZone = document.getElementById("dashboard-drop-zone");
      const rect = dropZone ? dropZone.getBoundingClientRect() : null;
      const x = rect ? rect.width / 2 - 160 : 100;
      const y = rect ? 50 + dropZone.scrollTop : 50;

      addDashboardWidget(type, id, x, y);

      if (!widgetDropdownPinned) {
        closeWidgetPicker();
      } else {
        // Re-render to update state
        renderWidgetPickerFolders();
        renderWidgetPickerTags();
      }
    });

    // Drag and drop
    item.addEventListener("dragstart", (e) => {
      state.setDraggedSidebarItem({ type, id });
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
      item.style.opacity = "0.5";
      document.body.classList.add("dragging-widget");
    });

    item.addEventListener("dragend", (e) => {
      item.style.opacity = "1";
      document.body.classList.remove("dragging-widget");
    });
  });
}

// Attach event listeners to widget tag items
function attachWidgetTagListeners() {
  const container = document.getElementById("widget-tags-container");
  if (!container) return;

  container.querySelectorAll(".widget-picker-item").forEach((item) => {
    const type = item.dataset.type;
    const id = item.dataset.id;
    const isAdded = item.classList.contains("added");

    if (isAdded) return;

    // Click to add
    item.addEventListener("click", () => {
      const dropZone = document.getElementById("dashboard-drop-zone");
      const rect = dropZone ? dropZone.getBoundingClientRect() : null;
      const x = rect ? rect.width / 2 - 160 : 100;
      const y = rect ? 50 + dropZone.scrollTop : 50;

      addDashboardWidget(type, id, x, y);

      if (!widgetDropdownPinned) {
        closeWidgetPicker();
      } else {
        // Re-render to update state
        renderWidgetPickerFolders();
        renderWidgetPickerTags();
      }
    });

    // Drag and drop
    item.addEventListener("dragstart", (e) => {
      state.setDraggedSidebarItem({ type, id });
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
      item.style.opacity = "0.5";
      document.body.classList.add("dragging-widget");
    });

    item.addEventListener("dragend", (e) => {
      item.style.opacity = "1";
      document.body.classList.remove("dragging-widget");
    });
  });
}

// Toggle pin state
function toggleWidgetPin() {
  widgetDropdownPinned = !widgetDropdownPinned;
  const pinBtn = document.getElementById("widget-pin-btn");

  if (pinBtn) {
    const svg = pinBtn.querySelector("svg");
    if (svg) {
      svg.setAttribute("fill", widgetDropdownPinned ? "currentColor" : "none");
    }
    pinBtn.title = widgetDropdownPinned ? "Unpin" : "Pin";
  }

  // Toggle auto-hide behavior
  if (widgetDropdownPinned) {
    document.removeEventListener("click", handleWidgetPickerClickOutside);
  } else {
    setTimeout(() => {
      document.addEventListener("click", handleWidgetPickerClickOutside);
    }, 0);
  }

  showToast(
    `Widget picker ${widgetDropdownPinned ? "pinned" : "unpinned"}`,
    "success",
  );
}

// Handle click outside to close (if not pinned)
function handleWidgetPickerClickOutside(e) {
  const dropdown = document.getElementById("widget-dropdown");
  const btn = document.getElementById("dashboard-add-widget-btn");

  if (
    dropdown &&
    !dropdown.contains(e.target) &&
    e.target !== btn &&
    !btn?.contains(e.target)
  ) {
    closeWidgetPicker();
  }
}

// Attach event listeners
function attachWidgetPickerListeners() {
  // Pin button
  const pinBtn = document.getElementById("widget-pin-btn");
  if (pinBtn) {
    pinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWidgetPin();
    });
  }

  // Close button
  const closeBtn = document.getElementById("widget-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeWidgetPicker();
    });
  }

  // Folder search input
  const folderSearchInput = document.getElementById("widget-folders-search");
  if (folderSearchInput) {
    folderSearchInput.addEventListener("input", (e) => {
      filterWidgetPickerFolders(e.target.value);
    });
  }

  // Tag search input
  const tagSearchInput = document.getElementById("widget-tags-search");
  if (tagSearchInput) {
    tagSearchInput.addEventListener("input", (e) => {
      filterWidgetPickerTags(e.target.value);
    });
  }
}

// Render folders in widget picker
export function renderWidgetPickerFolders() {
  const container = document.getElementById("widget-folders-container");
  if (!container) return;

  const folders = state.folders.filter((f) => {
    const bookmarkCount = state.bookmarks.filter(
      (b) => b.folder_id === f.id,
    ).length;
    return bookmarkCount > 0;
  });

  if (folders.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No folders with bookmarks</p>';
    return;
  }

  let html = "";
  folders.forEach((folder) => {
    const bookmarkCount = state.bookmarks.filter(
      (b) => b.folder_id === folder.id,
    ).length;
    const isAdded = state.dashboardWidgets.some(
      (w) => w.type === "folder" && w.id === folder.id,
    );

    html += `
      <div class="filter-item widget-picker-item ${isAdded ? "added" : "draggable"}"
           data-type="folder"
           data-id="${folder.id}"
           data-name="${escapeHtml(folder.name)}"
           draggable="${!isAdded ? "true" : "false"}"
           style="${isAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}">
        <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
          <span class="folder-color" style="background:${folder.color || "#6366f1"}"></span>
          <span class="filter-item-name">${escapeHtml(folder.name)}</span>
        </div>
        <span class="filter-item-count">${bookmarkCount}</span>
        ${isAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
      </div>
    `;
  });

  container.innerHTML = html;

  // Store original data for filtering
  container._allFolders = folders;
  container._originalHTML = container.innerHTML;

  // Attach listeners to items
  attachWidgetFolderListeners();
}

// Render tags in widget picker
export function renderWidgetPickerTags() {
  const container = document.getElementById("widget-tags-container");
  if (!container) return;

  // Collect all unique tags with counts
  const tagCounts = {};
  state.bookmarks.forEach((bookmark) => {
    if (bookmark.tags) {
      bookmark.tags.split(",").forEach((tag) => {
        const trimmed = tag.trim();
        if (trimmed) {
          tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
        }
      });
    }
  });

  const allTags = Object.keys(tagCounts);

  if (allTags.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No tags yet</p>';
    return;
  }

  // Sort tags by count (most used first)
  allTags.sort((a, b) => tagCounts[b] - tagCounts[a]);

  let html = "";
  // Special: Tag Analytics widget shortcut
  const analyticsAdded = state.dashboardWidgets.some(
    (w) => w.type === "tag-analytics" && w.id === "tag-analytics",
  );
  html += `
      <div class="filter-item widget-picker-item ${analyticsAdded ? "added" : "draggable"}"
           data-type="tag-analytics"
           data-id="tag-analytics"
           data-name="Tag Analytics"
           draggable="${!analyticsAdded ? "true" : "false"}"
           style="${analyticsAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}">
        <span class="filter-item-name">Tag Analytics</span>
        ${analyticsAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
      </div>
  `;

  allTags.forEach((tag) => {
    const count = tagCounts[tag];
    const isAdded = state.dashboardWidgets.some(
      (w) => w.type === "tag" && w.id === tag,
    );

    html += `
      <div class="filter-item widget-picker-item ${isAdded ? "added" : "draggable"}"
           data-type="tag"
           data-id="${escapeHtml(tag)}"
           data-name="${escapeHtml(tag)}"
           draggable="${!isAdded ? "true" : "false"}"
           style="${isAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}">
        <span class="filter-item-name">${escapeHtml(tag)}</span>
        <span class="filter-item-count">${count}</span>
        ${isAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
      </div>
    `;
  });

  container.innerHTML = html;

  // Store original data for filtering (include Tag Analytics as special item)
  const tagsWithAnalytics = [
    { type: "tag-analytics", name: "Tag Analytics", count: 0 },
    ...allTags.map((tag) => ({ name: tag, count: tagCounts[tag] })),
  ];
  container._allTags = tagsWithAnalytics;
  container._originalHTML = container.innerHTML;

  // Attach listeners to items
  attachWidgetTagListeners();
}

export default {
  toggleWidgetPicker,
  openWidgetPicker,
  closeWidgetPicker,
  renderWidgetPickerFolders,
  renderWidgetPickerTags,
};
