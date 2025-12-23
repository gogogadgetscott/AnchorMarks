/**
 * AnchorMarks - Folders Module
 * Handles folder CRUD operations and rendering
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { escapeHtml } from "@utils/index.ts";
import {
  showToast,
  closeModals,
  openModal,
  updateActiveNav,
} from "@utils/ui-helpers.ts";
import { Badge } from "@components/index.ts";

// Load folders from server
export async function loadFolders(): Promise<void> {
  try {
    const folders = await api("/folders");
    state.setFolders(folders);
    renderFolders();
    updateFolderSelect();
    populateBulkMoveSelect();
  } catch (err) {
    showToast("Failed to load folders", "error");
  }
}

// Render folders in sidebar
export function renderFolders(): void {
  const container = document.getElementById("folders-list");
  if (!container) return;

  const rootFolders = state.folders.filter((f) => !f.parent_id);

  const sorter = (a: any, b: any) => {
    const countA = state.bookmarks.filter((bm) => bm.folder_id === a.id).length;
    const countB = state.bookmarks.filter((bm) => bm.folder_id === b.id).length;
    if (countA > 0 && countB === 0) return -1;
    if (countA === 0 && countB > 0) return 1;
    return a.name.localeCompare(b.name);
  };

  rootFolders.sort(sorter);

  function renderFolderTree(folderList: any[], level = 0): string {
    return folderList
      .map((f) => {
        const children = state.folders
          .filter((child) => child.parent_id === f.id)
          .sort(sorter);

        const descIds = getAllChildFolderIds(f.id);
        const allIds = new Set([f.id, ...descIds]);
        const count = state.bookmarks.filter(
          (b) => b.folder_id && allIds.has(b.folder_id),
        ).length;

        const isEmpty = count === 0;
        const indentation = level * 12;

        return `
            <div class="nav-item folder-item ${state.currentFolder === f.id ? "active" : ""} ${isEmpty ? "empty" : ""}"
                 data-folder="${f.id}"
                 data-folder-name="${escapeHtml(f.name)}"
                 data-folder-color="${f.color || ""}"
                 draggable="true"
                 style="padding-left: ${12 + indentation}px; cursor: grab;"
                 role="treeitem"
                 tabindex="0"
                 aria-label="${escapeHtml(f.name)}"
                 onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
            >
                <span class="folder-color" style="background: ${f.color || "var(--primary-500)"}"></span>
                <span class="folder-name">${escapeHtml(f.name)}</span>
                ${count > 0 ? Badge(count) : ""}
                <div class="folder-actions">
                    <button class="btn-icon" data-action="edit-folder" data-id="${f.id}" title="Edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button class="btn-icon" data-action="delete-folder" data-id="${f.id}" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>
            ${renderFolderTree(children, level + 1)}
            `;
      })
      .join("");
  }

  container.innerHTML = renderFolderTree(rootFolders);

  container.querySelectorAll(".folder-item").forEach((item: any) => {
    item.addEventListener("click", (e: any) => {
      if (e.defaultPrevented) return;

      if (e.target.closest(".folder-actions")) return;

      e.stopPropagation();

      if (state.currentView === "dashboard") {
        import("@features/bookmarks/dashboard.ts").then(
          ({ addDashboardWidget }) => {
            const existingWidgets = state.dashboardWidgets.length;
            const x = 50 + ((existingWidgets * 30) % 300);
            const y = 50 + ((existingWidgets * 30) % 200);

            try {
              addDashboardWidget("folder", item.dataset.folder, x, y);
            } catch (err: any) {
              showToast("Error adding widget: " + err.message, "error");
            }
          },
        );
        return;
      }

      state.setCurrentFolder(item.dataset.folder);
      state.setCurrentView("folder");
      updateActiveNav();
      import("@features/bookmarks/search.ts").then(({ renderActiveFilters }) =>
        renderActiveFilters(),
      );
      import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
        loadBookmarks(),
      );

      const folder = state.folders.find((f) => f.id === state.currentFolder);
      const viewTitle = document.getElementById("view-title");
      if (viewTitle) viewTitle.textContent = folder ? folder.name : "Folder";
    });

    if (item.getAttribute("draggable") === "true") {
      item.addEventListener("dragstart", (e: any) => {
        state.setDraggedSidebarItem({
          type: "folder",
          id: item.dataset.folder,
          name: item.dataset.folderName,
          color: item.dataset.folderColor,
        });
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/plain", item.dataset.folderName);
        }
      });

      item.addEventListener("dragend", () => {
        state.setDraggedSidebarItem(null);
      });
    }
  });
}

// Update folder select dropdown
export function updateFolderSelect(): void {
  const select = document.getElementById("bookmark-folder");
  if (!select) return;

  let options = '<option value="">None</option>';
  const sorter = (a: any, b: any) => a.name.localeCompare(b.name);

  function buildOptions(parent_id: string | null, level = 0) {
    const children = state.folders
      .filter((f) => f.parent_id === parent_id)
      .sort(sorter);
    children.forEach((f) => {
      const prefix = "&nbsp;&nbsp;&nbsp;".repeat(level);
      options += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
      buildOptions(f.id, level + 1);
    });
  }

  buildOptions(null);
  select.innerHTML = options;
}

// Update folder parent select dropdown
export function updateFolderParentSelect(
  currentId: string | null = null,
): void {
  const select = document.getElementById("folder-parent");
  if (!select) return;

  let options = '<option value="">None (Top Level)</option>';

  function isDescendant(potentialParentId: string): boolean {
    if (!currentId) return false;
    if (potentialParentId === currentId) return true;

    let parent = state.folders.find((f) => f.id === potentialParentId);
    while (parent) {
      if (parent.id === currentId) return true;
      parent = state.folders.find((f) => f.id === parent.parent_id);
    }
    return false;
  }

  const sorter = (a: any, b: any) => a.name.localeCompare(b.name);

  function buildOptions(parent_id: string | null, level = 0) {
    const children = state.folders
      .filter((f) => f.parent_id === parent_id)
      .sort(sorter);
    children.forEach((f) => {
      if (currentId && (f.id === currentId || isDescendant(f.id))) return;
      const prefix = "&nbsp;&nbsp;&nbsp;".repeat(level);
      options += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
      buildOptions(f.id, level + 1);
    });
  }

  buildOptions(null);
  select.innerHTML = options;
}

// Populate bulk move select
export function populateBulkMoveSelect(): void {
  const select = document.getElementById("bulk-move-select");
  if (!select) return;

  select.innerHTML =
    '<option value="">Choose folder</option>' +
    state.folders
      .map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`)
      .join("");
}

// Create folder
export async function createFolder(
  data: any,
  options: { closeModal?: boolean } = {},
): Promise<any> {
  const { closeModal = true } = options;

  try {
    const folder = await api("/folders", {
      method: "POST",
      body: JSON.stringify(data),
    });
    state.folders.push(folder);
    renderFolders();
    updateFolderSelect();
    if (closeModal) closeModals();
    showToast("Folder created!", "success");
    return folder;
  } catch (err: any) {
    showToast(err.message, "error");
    return null;
  }
}

// Update folder
export async function updateFolder(id: string, data: any): Promise<void> {
  try {
    const folder = await api(`/folders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const index = state.folders.findIndex((f) => f.id === id);
    if (index !== -1) state.folders[index] = folder;
    renderFolders();
    updateFolderSelect();
    closeModals();
    showToast("Folder updated!", "success");
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Delete folder
export async function deleteFolder(id: string): Promise<void> {
  if (!confirm("Delete this folder? Bookmarks will be moved to uncategorized."))
    return;

  try {
    await api(`/folders/${id}`, { method: "DELETE" });
    state.setFolders(state.folders.filter((f) => f.id !== id));

    if (state.currentFolder === id) {
      state.setCurrentFolder(null);
      state.setCurrentView("all");
      const viewTitle = document.getElementById("view-title");
      if (viewTitle) viewTitle.textContent = "Bookmarks";
      import("@features/bookmarks/search.ts").then(({ renderActiveFilters }) =>
        renderActiveFilters(),
      );
    }

    renderFolders();
    updateFolderSelect();
    import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
      loadBookmarks(),
    );
    showToast("Folder deleted", "success");
  } catch (err: any) {
    showToast(err.message, "error");
  }
}

// Edit folder (populate form)
export function editFolder(id: string): void {
  const folder = state.folders.find((f) => f.id === id);
  if (!folder) return;

  const modalTitle = document.getElementById("folder-modal-title");
  if (modalTitle) modalTitle.textContent = "Edit Folder";

  const idInput = document.getElementById("folder-id") as HTMLInputElement;
  if (idInput) idInput.value = id;

  const nameInput = document.getElementById("folder-name") as HTMLInputElement;
  if (nameInput) nameInput.value = folder.name;

  const colorInput = document.getElementById(
    "folder-color",
  ) as HTMLInputElement;
  if (colorInput) colorInput.value = folder.color || "";

  document.querySelectorAll(".color-option").forEach((opt: any) => {
    if (opt.dataset.color === folder.color) opt.classList.add("active");
    else opt.classList.remove("active");
  });

  updateFolderParentSelect(id);
  const parentSelect = document.getElementById(
    "folder-parent",
  ) as HTMLSelectElement;
  if (parentSelect) parentSelect.value = folder.parent_id || "";

  // Change button text
  const form = document.getElementById("folder-form");
  if (form) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.textContent = "Save";
  }

  openModal("folder-modal");
}

// Navigate to folder by index
export function navigateToFolderByIndex(index: number): void {
  const rootFolders = state.folders.filter((f) => !f.parent_id);

  if (index < 0 || index >= rootFolders.length) {
    return;
  }

  const folder = rootFolders[index];
  state.setCurrentFolder(folder.id);
  state.setCurrentView("folder");

  const viewTitle = document.getElementById("view-title");
  if (viewTitle) viewTitle.textContent = folder.name;

  updateActiveNav();
  import("@features/bookmarks/search.ts").then(({ renderActiveFilters }) =>
    renderActiveFilters(),
  );
  import("@features/bookmarks/bookmarks.ts").then(({ loadBookmarks }) =>
    loadBookmarks(),
  );
}

export function getAllChildFolderIds(folderId: string): string[] {
  const ids = [folderId];
  const children = state.folders.filter((f) => f.parent_id === folderId);
  children.forEach((child) => {
    ids.push(...getAllChildFolderIds(child.id));
  });
  return ids;
}

// Render folders for filter dropdown
export async function renderFoldersForFilter(
  container: HTMLElement,
): Promise<void> {
  if (!container) return;

  const folders = state.folders;

  if (folders.length === 0) {
    container.innerHTML =
      '<div style="padding:0.5rem;color:var(--text-tertiary);text-align:center;font-size:0.85rem">No folders yet</div>';
    return;
  }

  // Build folder tree HTML (similar to sidebar)
  const buildFolderTree = (
    parentId: string | null = null,
    level = 0,
  ): string => {
    return folders
      .filter((f) => f.parent_id === parentId)
      .map((folder) => {
        const isActive = state.currentFolder === folder.id;
        const hasChildren = folders.some((f) => f.parent_id === folder.id);
        const indent = level * 1.25;

        return `
                    <div class="folder-item ${isActive ? "active" : ""}" data-folder-id="${folder.id}" style="padding-left: ${indent}rem">
                        <span class="folder-icon" style="color: ${escapeHtml(folder.color || "#6b7280")}">📁</span>
                        <span class="folder-name">${escapeHtml(folder.name)}</span>
                        <span class="folder-count">${(folder as any).bookmark_count || 0}</span>
                    </div>
                    ${hasChildren ? buildFolderTree(folder.id, level + 1) : ""}
                `;
      })
      .join("");
  };

  container.innerHTML = buildFolderTree();

  // Attach click handlers
  container.querySelectorAll(".folder-item").forEach((item: any) => {
    item.addEventListener("click", async (e: any) => {
      e.stopPropagation();
      const folderId = item.dataset.folderId;

      // Toggle active state
      container
        .querySelectorAll(".folder-item")
        .forEach((f) => f.classList.remove("active"));
      item.classList.add("active");

      // Update state and reload
      state.setCurrentFolder(folderId);
      state.setFilterConfig({
        ...state.filterConfig,
        folder: folderId,
      });

      const { loadBookmarks } =
        await import("@features/bookmarks/bookmarks.ts");
      await loadBookmarks();
    });
  });
}

export default {
  loadFolders,
  renderFolders,
  updateFolderSelect,
  updateFolderParentSelect,
  populateBulkMoveSelect,
  createFolder,
  updateFolder,
  deleteFolder,
  editFolder,
  navigateToFolderByIndex,
  getAllChildFolderIds,
};
