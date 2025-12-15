/**
 * AnchorMarks - Widget Picker Module
 * Handles the add widget sidebar for dashboard
 */

import * as state from "./state.js";
import { escapeHtml } from "./utils.js";
import { showToast } from "./ui.js";
import { addDashboardWidget } from "./dashboard.js";

// Track if sidebar is pinned
let isWidgetSidebarPinned = false;

// Open widget picker sidebar
export function openWidgetPicker() {
    const sidebar = document.getElementById("widget-sidebar");
    const overlay = document.getElementById("widget-sidebar-overlay");

    sidebar?.classList.add("open");
    if (!isWidgetSidebarPinned) {
        overlay?.classList.add("active");
    }

    renderWidgetPickerFolders("");
    renderWidgetPickerTags("");
}

// Close widget picker sidebar
export function closeWidgetPicker() {
    const sidebar = document.getElementById("widget-sidebar");
    const overlay = document.getElementById("widget-sidebar-overlay");

    sidebar?.classList.remove("open");
    overlay?.classList.remove("active");
}

// Toggle pin state
export function toggleWidgetSidebarPin() {
    isWidgetSidebarPinned = !isWidgetSidebarPinned;
    const sidebar = document.getElementById("widget-sidebar");
    const overlay = document.getElementById("widget-sidebar-overlay");
    const pinButton = document.getElementById("pin-widget-sidebar");

    if (isWidgetSidebarPinned) {
        sidebar?.classList.add("pinned");
        pinButton?.classList.add("pinned");
        overlay?.classList.remove("active");
        showToast("Widget sidebar pinned", "success");
    } else {
        sidebar?.classList.remove("pinned");
        pinButton?.classList.remove("pinned");
        if (sidebar?.classList.contains("open")) {
            overlay?.classList.add("active");
        }
        showToast("Widget sidebar unpinned", "info");
    }
}

// Render folders in widget picker
export function renderWidgetPickerFolders(searchTerm = "") {
    const list = document.getElementById("widget-folders-list");
    if (!list) return;

    const lowerSearch = searchTerm.toLowerCase();
    const filteredFolders = state.folders.filter((folder) =>
        folder.name.toLowerCase().includes(lowerSearch),
    );

    if (filteredFolders.length === 0) {
        list.innerHTML = `
            <div class="widget-picker-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <h4>No folders found</h4>
                <p>${searchTerm ? "Try a different search term" : "Create folders to organize your bookmarks"}</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filteredFolders
        .map((folder) => {
            const bookmarkCount = state.bookmarks.filter(
                (b) => b.folder_id === folder.id,
            ).length;
            const isAdded = state.dashboardWidgets.some(
                (w) => w.type === "folder" && w.id === folder.id,
            );

            return `
            <div class="widget-picker-item ${isAdded ? "added" : "draggable"}"
                 data-type="folder"
                 data-id="${folder.id}"
                 data-name="${escapeHtml(folder.name)}"
                 draggable="${!isAdded ? "true" : "false"}">
                <div class="widget-picker-item-icon" style="background: ${folder.color || "#6366f1"}20; color: ${folder.color || "#6366f1"}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="widget-picker-item-info">
                    <div class="widget-picker-item-name">${escapeHtml(folder.name)}</div>
                    <div class="widget-picker-item-count">${bookmarkCount} bookmark${bookmarkCount !== 1 ? "s" : ""}</div>
                </div>
                ${isAdded ? '<span style="font-size: 0.75rem; color: var(--text-tertiary)">Added</span>' : ""}
            </div>
        `;
        })
        .join("");

    // Attach event listeners
    attachWidgetPickerListeners(list);
}

// Render tags in widget picker
export function renderWidgetPickerTags(searchTerm = "") {
    const list = document.getElementById("widget-tags-list");
    if (!list) return;

    // Get all unique tags with counts
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
    const lowerSearch = searchTerm.toLowerCase();
    const filteredTags = allTags.filter((tag) =>
        tag.toLowerCase().includes(lowerSearch),
    );

    if (filteredTags.length === 0) {
        list.innerHTML = `
            <div class="widget-picker-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                <h4>No tags found</h4>
                <p>${searchTerm ? "Try a different search term" : "Add tags to your bookmarks"}</p>
            </div>
        `;
        return;
    }

    // Sort tags by count (most used first)
    filteredTags.sort((a, b) => tagCounts[b] - tagCounts[a]);

    list.innerHTML = filteredTags
        .map((tag) => {
            const count = tagCounts[tag];
            const isAdded = state.dashboardWidgets.some(
                (w) => w.type === "tag" && w.id === tag,
            );

            return `
            <div class="widget-picker-item ${isAdded ? "added" : "draggable"}"
                 data-type="tag"
                 data-id="${escapeHtml(tag)}"
                 data-name="${escapeHtml(tag)}"
                 draggable="${!isAdded ? "true" : "false"}">
                <div class="widget-picker-item-icon" style="background: #10b98120; color: #10b981">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                        <line x1="7" y1="7" x2="7.01" y2="7"/>
                    </svg>
                </div>
                <div class="widget-picker-item-info">
                    <div class="widget-picker-item-name">${escapeHtml(tag)}</div>
                    <div class="widget-picker-item-count">${count} bookmark${count !== 1 ? "s" : ""}</div>
                </div>
                ${isAdded ? '<span style="font-size: 0.75rem; color: var(--text-tertiary)">Added</span>' : ""}
            </div>
        `;
        })
        .join("");

    // Attach event listeners
    attachWidgetPickerListeners(list);
}

// Attach event listeners to widget picker items
function attachWidgetPickerListeners(list) {
    const items = list.querySelectorAll(".widget-picker-item");

    items.forEach((item) => {
        const type = item.dataset.type;
        const id = item.dataset.id;
        const isAdded = item.classList.contains("added");

        if (isAdded) return;

        // Click to add widget at center of dashboard
        item.addEventListener("click", () => {
            const dropZone = document.getElementById("dashboard-drop-zone");
            const rect = dropZone ? dropZone.getBoundingClientRect() : null;

            const x = rect ? rect.width / 2 - 160 : 100; // Center horizontally (160 = half widget width)
            const y = rect ? 50 + dropZone.scrollTop : 50; // Start at top with offset

            addDashboardWidget(type, id, x, y);
            // Don't close if pinned
            if (!isWidgetSidebarPinned) {
                closeWidgetPicker();
            }
            showToast(`${type === "folder" ? "Folder" : "Tag"} added to dashboard`, "success");
        });

        // Drag and drop support
        item.addEventListener("dragstart", (e) => {
            console.log("Drag started:", { type, id });
            state.setDraggedSidebarItem({ type, id });
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
            item.style.opacity = "0.5";
            // Add class to body to disable overlay pointer events
            document.body.classList.add("dragging-widget");
        });

        item.addEventListener("dragend", (e) => {
            console.log("Drag ended");
            item.style.opacity = "1";
            // Remove class from body
            document.body.classList.remove("dragging-widget");
        });
    });
}

// Switch tabs in widget picker
export function switchWidgetPickerTab(tab) {
    // Update tab buttons
    document.querySelectorAll(".widget-picker-tab").forEach((t) => {
        t.classList.toggle("active", t.dataset.pickerTab === tab);
    });

    // Update panels
    document.querySelectorAll(".widget-picker-panel").forEach((p) => {
        p.classList.toggle("active", p.id === `widget-picker-${tab}`);
    });

    // Clear search inputs
    document.getElementById("widget-folder-search").value = "";
    document.getElementById("widget-tag-search").value = "";
}

export default {
    openWidgetPicker,
    closeWidgetPicker,
    toggleWidgetSidebarPin,
    renderWidgetPickerFolders,
    renderWidgetPickerTags,
    switchWidgetPickerTab,
};
