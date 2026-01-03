/**
 * AnchorMarks - Widget Picker Module
 * Handles the add widget dropdown for dashboard
 */

import * as state from "@features/state.ts";
import { escapeHtml } from "@utils/index.ts";
import { showToast } from "@utils/ui-helpers.ts";
import { addDashboardWidget } from "@features/bookmarks/dashboard.ts";
import { getRecursiveBookmarkCount } from "@features/bookmarks/folders.ts";

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
          <svg viewBox="0 0 512 512" fill="${widgetDropdownPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="16" style="width:14px;height:14px;${widgetDropdownPinned ? "transform:rotate(45deg);" : ""}">
            <polygon points="419.286,301.002 416.907,248.852 357.473,219.867 337.487,55.355 369.774,38.438 369.774,0 286.751,0 225.249,0 142.219,0 142.219,38.438 174.509,55.355 154.52,219.867 95.096,248.852 92.714,301.002 256.001,301.002"/>
            <polygon points="231.399,465.871 254.464,512 277.522,465.871 277.522,315.194 231.399,315.194"/>
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

  // Find the headers container and insert the dropdown there
  const headersContainer = document.getElementById("headers-container");
  const dashboardHeader = document.getElementById("dashboard-header");

  if (headersContainer) {
    // Insert into headers container as a sibling
    if (dashboardHeader && dashboardHeader.parentElement === headersContainer) {
      dashboardHeader.insertAdjacentElement("afterend", dropdown);
    } else {
      headersContainer.appendChild(dropdown);
    }
  } else if (dashboardHeader && dashboardHeader.style.display !== "none") {
    // Fallback: insert after dashboard header
    dashboardHeader.style.position = "relative";
    dashboardHeader.insertAdjacentElement("afterend", dropdown);
  } else {
    // Last resort: append to body if header not found
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
function filterWidgetPickerFolders(searchTerm: string): void {
  const container = document.getElementById(
    "widget-folders-container",
  ) as HTMLElement & { _allFolders: any[]; _originalHTML: string };
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
    const bookmarkCount = getRecursiveBookmarkCount(folder.id);
    const isAdded = state.dashboardWidgets.some(
      (w) => w.type === "folder" && w.id === folder.id,
    );

    html += `
      <div class="filter-item widget-picker-item ${isAdded ? "added" : "draggable"}"
           data-type="folder"
           data-id="${folder.id}"
           data-name="${escapeHtml(folder.name)}"
           draggable="${!isAdded ? "true" : "false"}"
           style="${isAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}; margin-bottom: 4px;">
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
function filterWidgetPickerTags(searchTerm: string): void {
  const container = document.getElementById(
    "widget-tags-container",
  ) as HTMLElement & { _allTags: any[]; _originalHTML: string };
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
    const type = (item as HTMLElement).dataset.type || "";
    const id = (item as HTMLElement).dataset.id || "";
    const isAdded = item.classList.contains("added");

    if (isAdded) return;

    // Click to add
    item.addEventListener("click", () => {
      const dropZone = document.getElementById("dashboard-drop-zone");
      if (!dropZone) return; // Guard clause
      const rect = dropZone.getBoundingClientRect();
      const x = rect ? rect.width / 2 - 160 : 100;
      const y = rect ? 50 + dropZone.scrollTop : 50;

      // Fix type mismatch for Tag Analytics
      if (type === "tag-analytics") {
        addDashboardWidget(type as "tag", id, x, y);
      } else {
        addDashboardWidget(type as "tag" | "folder", id, x, y);
      }

      if (!widgetDropdownPinned) {
        closeWidgetPicker();
      } else {
        // Re-render to update state
        renderWidgetPickerFolders();
        renderWidgetPickerTags();
      }
    });

    // Drag and drop
    item.addEventListener("dragstart", (e: Event) => {
      const dragEvent = e as DragEvent;
      if (!dragEvent.dataTransfer) return;

      state.setDraggedSidebarItem({ type, id });
      dragEvent.dataTransfer.effectAllowed = "copy";
      dragEvent.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ type, id }),
      );
      (item as HTMLElement).style.opacity = "0.5";
      document.body.classList.add("dragging-widget");
    });

    item.addEventListener("dragend", () => {
      (item as HTMLElement).style.opacity = "1";
      document.body.classList.remove("dragging-widget");
    });
  });
}

// Attach event listeners to widget tag items
function attachWidgetTagListeners() {
  const container = document.getElementById("widget-tags-container");
  if (!container) return;

  container.querySelectorAll(".widget-picker-item").forEach((item) => {
    const type = (item as HTMLElement).dataset.type || "";
    const id = (item as HTMLElement).dataset.id || "";
    const isAdded = item.classList.contains("added");

    if (isAdded) return;

    // Click to add
    item.addEventListener("click", () => {
      const dropZone = document.getElementById("dashboard-drop-zone");
      if (!dropZone) return;
      const rect = dropZone.getBoundingClientRect();
      const x = rect ? rect.width / 2 - 160 : 100;
      const y = rect ? 50 + dropZone.scrollTop : 50;

      // Pass the correct type - tag-analytics needs to be passed as-is
      addDashboardWidget(type as "tag" | "folder" | "tag-analytics", id, x, y);

      if (!widgetDropdownPinned) {
        closeWidgetPicker();
      } else {
        // Re-render to update state
        renderWidgetPickerFolders();
        renderWidgetPickerTags();
      }
    });

    // Drag and drop
    item.addEventListener("dragstart", (e: Event) => {
      const dragEvent = e as DragEvent;
      if (!dragEvent.dataTransfer) return;

      state.setDraggedSidebarItem({ type, id });
      dragEvent.dataTransfer.effectAllowed = "copy";
      dragEvent.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ type, id }),
      );
      (item as HTMLElement).style.opacity = "0.5";
      document.body.classList.add("dragging-widget");
    });

    item.addEventListener("dragend", () => {
      (item as HTMLElement).style.opacity = "1";
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
function handleWidgetPickerClickOutside(e: Event) {
  const dropdown = document.getElementById("widget-dropdown");
  const btn = document.getElementById("dashboard-add-widget-btn");
  const target = e.target as Node;

  if (
    dropdown &&
    !dropdown.contains(target) &&
    e.target !== btn &&
    !btn?.contains(target)
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
  const folderSearchInput = document.getElementById(
    "widget-folders-search",
  ) as HTMLInputElement;
  if (folderSearchInput) {
    folderSearchInput.addEventListener("input", (e: Event) => {
      filterWidgetPickerFolders((e.target as HTMLInputElement).value);
    });
  }

  // Tag search input
  const tagSearchInput = document.getElementById(
    "widget-tags-search",
  ) as HTMLInputElement;
  if (tagSearchInput) {
    tagSearchInput.addEventListener("input", (e: Event) => {
      filterWidgetPickerTags((e.target as HTMLInputElement).value);
    });
  }
}

// Render folders in widget picker
export function renderWidgetPickerFolders(): void {
  const container = document.getElementById(
    "widget-folders-container",
  ) as HTMLElement & { _allFolders: any[]; _originalHTML: string };
  if (!container) return;

  // Use a flex column layout for the tree structure instead of flat grid
  container.style.display = "flex";
  container.style.flexDirection = "column";

  // Filter out folders that don't have bookmarks (even in subfolders)
  const foldersToRender = state.folders.filter(
    (f) => getRecursiveBookmarkCount(f.id) > 0,
  );
  
  console.log(`[WidgetPicker] Found ${state.folders.length} total folders, ${foldersToRender.length} have bookmarks (recursive)`);

  if (foldersToRender.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">No folders with bookmarks</p>';
    return;
  }

  const rootFolders = foldersToRender.filter((f) => !f.parent_id);
  const sorter = (a: any, b: any) => a.name.localeCompare(b.name);

  function renderTree(folderList: any[], level = 0): string {
    return folderList
      .sort(sorter)
      .map((folder) => {
        const children = foldersToRender.filter((f) => f.parent_id === folder.id);
        const count = getRecursiveBookmarkCount(folder.id);
        const isAdded = state.dashboardWidgets.some(
          (w) => w.type === "folder" && w.id === folder.id,
        );
        const indentation = level * 16;

        return `
            <div class="filter-item widget-picker-item ${isAdded ? "added" : "draggable"}"
                 data-type="folder"
                 data-id="${folder.id}"
                 data-name="${escapeHtml(folder.name)}"
                 draggable="${!isAdded ? "true" : "false"}"
                 style="${isAdded ? "opacity: 0.5; cursor: not-allowed;" : ""}; margin-left: ${indentation}px; margin-bottom: 4px;">
              <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0;">
                <span class="folder-color" style="background:${folder.color || "#6366f1"}"></span>
                <span class="filter-item-name">${escapeHtml(folder.name)}</span>
              </div>
              <span class="filter-item-count">${count}</span>
              ${isAdded ? '<span style="font-size:0.65rem;color:var(--text-tertiary);margin-left:0.25rem;">✓</span>' : ""}
            </div>
            ${renderTree(children, level + 1)}
          `;
      })
      .join("");
  }

  container.innerHTML = renderTree(rootFolders);

  // Store original data for filtering
  container._allFolders = foldersToRender;
  container._originalHTML = container.innerHTML;

  // Attach listeners to items
  attachWidgetFolderListeners();
}

// Render tags in widget picker
export function renderWidgetPickerTags(): void {
  const container = document.getElementById(
    "widget-tags-container",
  ) as HTMLElement & { _allTags: any[]; _originalHTML: string };
  if (!container) return;

  // Use tag metadata from state which has accurate counts
  const tagCounts: Record<string, number> = {};
  Object.keys(state.tagMetadata).forEach((tagName) => {
    tagCounts[tagName] = state.tagMetadata[tagName].count || 0;
  });

  const allTags = Object.keys(tagCounts).filter((t) => tagCounts[t] > 0);

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
