/**
 * AnchorMarks - Folders Module
 * Handles folder CRUD operations and rendering
 */

import * as state from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { showToast, closeModals, openModal, updateActiveNav } from './ui.js';
import { loadBookmarks } from './bookmarks.js';
import { renderActiveFilters } from './search.js';

// Load folders from server
export async function loadFolders() {
    try {
        const folders = await api('/folders');
        state.setFolders(folders);
        renderFolders();
        updateFolderSelect();
        populateBulkMoveSelect();
    } catch (err) {
        showToast('Failed to load folders', 'error');
    }
}

// Render folders in sidebar
export function renderFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;

    const rootFolders = state.folders.filter(f => !f.parent_id);

    const sorter = (a, b) => {
        const countA = state.bookmarks.filter(bm => bm.folder_id === a.id).length;
        const countB = state.bookmarks.filter(bm => bm.folder_id === b.id).length;
        if (countA > 0 && countB === 0) return -1;
        if (countA === 0 && countB > 0) return 1;
        return a.name.localeCompare(b.name);
    };

    rootFolders.sort(sorter);

    function renderFolderTree(folderList, level = 0) {
        return folderList.map(f => {
            const children = state.folders.filter(child => child.parent_id === f.id).sort(sorter);
            const count = state.bookmarks.filter(b => b.folder_id === f.id).length;
            const isEmpty = count === 0;
            const indentation = level * 12;

            return `
            <div class="nav-item folder-item ${state.currentFolder === f.id ? 'active' : ''} ${isEmpty ? 'empty' : ''}" 
                 data-folder="${f.id}" 
                 data-folder-name="${escapeHtml(f.name)}"
                 data-folder-color="${f.color}"
                 draggable="true"
                 style="padding-left: ${12 + indentation}px; cursor: grab;">
                <span class="folder-color" style="background: ${f.color}"></span>
                <span class="folder-name">${escapeHtml(f.name)}</span>
                ${count > 0 ? `<span class="badge">${count}</span>` : ''}
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
        }).join('');
    }

    container.innerHTML = renderFolderTree(rootFolders);

    // Attach event listeners
    container.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.defaultPrevented) return;

            state.setCurrentFolder(item.dataset.folder);
            state.setCurrentView('folder');
            updateActiveNav();
            renderActiveFilters();
            loadBookmarks();

            const folder = state.folders.find(f => f.id === state.currentFolder);
            const viewTitle = document.getElementById('view-title');
            if (viewTitle) viewTitle.textContent = folder ? folder.name : 'Folder';
        });

        // Setup drag for dashboard
        if (item.getAttribute('draggable') === 'true') {
            item.addEventListener('dragstart', (e) => {
                state.setDraggedSidebarItem({
                    type: 'folder',
                    id: item.dataset.folder,
                    name: item.dataset.folderName,
                    color: item.dataset.folderColor
                });
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', item.dataset.folderName);
            });

            item.addEventListener('dragend', () => {
                state.setDraggedSidebarItem(null);
            });
        }
    });
}


// Update folder select dropdown
export function updateFolderSelect() {
    const select = document.getElementById('bookmark-folder');
    if (!select) return;

    let options = '<option value="">None</option>';
    const sorter = (a, b) => a.name.localeCompare(b.name);

    function buildOptions(parent_id, level = 0) {
        const children = state.folders.filter(f => f.parent_id === parent_id).sort(sorter);
        children.forEach(f => {
            const prefix = '&nbsp;&nbsp;&nbsp;'.repeat(level);
            options += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
            buildOptions(f.id, level + 1);
        });
    }

    buildOptions(null);
    select.innerHTML = options;
}

// Update folder parent select dropdown
export function updateFolderParentSelect(currentId = null) {
    const select = document.getElementById('folder-parent');
    if (!select) return;

    let options = '<option value="">None (Top Level)</option>';

    function isDescendant(potentialParentId) {
        if (!currentId) return false;
        if (potentialParentId === currentId) return true;

        let parent = state.folders.find(f => f.id === potentialParentId);
        while (parent) {
            if (parent.id === currentId) return true;
            parent = state.folders.find(f => f.id === parent.parent_id);
        }
        return false;
    }

    const sorter = (a, b) => a.name.localeCompare(b.name);

    function buildOptions(parent_id, level = 0) {
        const children = state.folders.filter(f => f.parent_id === parent_id).sort(sorter);
        children.forEach(f => {
            if (currentId && (f.id === currentId || isDescendant(f.id))) return;
            const prefix = '&nbsp;&nbsp;&nbsp;'.repeat(level);
            options += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
            buildOptions(f.id, level + 1);
        });
    }

    buildOptions(null);
    select.innerHTML = options;
}

// Populate bulk move select
export function populateBulkMoveSelect() {
    const select = document.getElementById('bulk-move-select');
    if (!select) return;

    select.innerHTML = '<option value="">Choose folder</option>' +
        state.folders.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
}

// Create folder
export async function createFolder(data) {
    try {
        const folder = await api('/folders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        state.folders.push(folder);
        renderFolders();
        updateFolderSelect();
        closeModals();
        showToast('Folder created!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Update folder
export async function updateFolder(id, data) {
    try {
        const folder = await api(`/folders/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        const index = state.folders.findIndex(f => f.id === id);
        if (index !== -1) state.folders[index] = folder;
        renderFolders();
        updateFolderSelect();
        closeModals();
        showToast('Folder updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete folder
export async function deleteFolder(id) {
    if (!confirm('Delete this folder? Bookmarks will be moved to uncategorized.')) return;

    try {
        await api(`/folders/${id}`, { method: 'DELETE' });
        state.setFolders(state.folders.filter(f => f.id !== id));

        if (state.currentFolder === id) {
            state.setCurrentFolder(null);
            state.setCurrentView('all');
            const viewTitle = document.getElementById('view-title');
            if (viewTitle) viewTitle.textContent = 'Bookmarks';
            renderActiveFilters();
        }

        renderFolders();
        updateFolderSelect();
        loadBookmarks();
        showToast('Folder deleted', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Edit folder (populate form)
export function editFolder(id) {
    const folder = state.folders.find(f => f.id === id);
    if (!folder) return;

    document.getElementById('folder-modal-title').textContent = 'Edit Folder';
    document.getElementById('folder-id').value = id;
    document.getElementById('folder-name').value = folder.name;
    document.getElementById('folder-color').value = folder.color;

    document.querySelectorAll('.color-option').forEach(opt => {
        if (opt.dataset.color === folder.color) opt.classList.add('active');
        else opt.classList.remove('active');
    });

    updateFolderParentSelect(id);
    document.getElementById('folder-parent').value = folder.parent_id || '';

    openModal('folder-modal');
}

// Navigate to folder by index
export function navigateToFolderByIndex(index) {
    const rootFolders = state.folders.filter(f => !f.parent_id);

    if (index < 0 || index >= rootFolders.length) {
        return;
    }

    const folder = rootFolders[index];
    state.setCurrentFolder(folder.id);
    state.setCurrentView('folder');

    const viewTitle = document.getElementById('view-title');
    if (viewTitle) viewTitle.textContent = folder.name;

    updateActiveNav();
    renderActiveFilters();
    loadBookmarks();
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
    navigateToFolderByIndex
};
