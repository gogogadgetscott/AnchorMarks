/**
 * AnchorMarks - Bulk Operations Module
 * Handles bulk actions on bookmarks
 */

import * as state from './state.js';
import { api } from './api.js';
import { parseTagInput } from './utils.js';
import { showToast, updateCounts, updateBulkUI } from './ui.js';
import { renderBookmarks, clearSelections } from './bookmarks.js';
import { renderSidebarTags } from './search.js';

// Bulk delete
export async function bulkDelete() {
    if (state.selectedBookmarks.size === 0) return;
    if (!confirm(`Delete ${state.selectedBookmarks.size} bookmark(s)?`)) return;

    const ids = Array.from(state.selectedBookmarks);
    for (const id of ids) {
        await api(`/bookmarks/${id}`, { method: 'DELETE' });
    }

    state.setBookmarks(state.bookmarks.filter(b => !state.selectedBookmarks.has(b.id)));
    clearSelections();
    updateCounts();
    showToast('Bookmarks deleted', 'success');
}

// Bulk favorite
export async function bulkFavorite() {
    if (state.selectedBookmarks.size === 0) return;

    const ids = Array.from(state.selectedBookmarks);
    for (const id of ids) {
        await api(`/bookmarks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_favorite: 1 })
        });
        const bm = state.bookmarks.find(b => b.id === id);
        if (bm) bm.is_favorite = 1;
    }

    renderBookmarks();
    updateCounts();
    showToast('Marked as favorite', 'success');
}

// Bulk move
export async function bulkMove() {
    const select = document.getElementById('bulk-move-select');
    if (!select) return;

    const folderId = select.value || null;
    if (folderId === null) return;

    const ids = Array.from(state.selectedBookmarks);
    for (const id of ids) {
        await api(`/bookmarks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ folder_id: folderId })
        });
        const bm = state.bookmarks.find(b => b.id === id);
        if (bm) bm.folder_id = folderId;
    }

    clearSelections();
    updateCounts();
    showToast('Bookmarks moved', 'success');
}

// Bulk add tags
export async function bulkAddTags() {
    if (state.selectedBookmarks.size === 0) return;

    const raw = prompt('Add tags (comma separated):');
    const tagsToAdd = parseTagInput(raw || '');
    if (tagsToAdd.length === 0) return;

    const ids = Array.from(state.selectedBookmarks);
    await api('/tags/bulk-add', {
        method: 'POST',
        body: JSON.stringify({ bookmark_ids: ids, tags: tagsToAdd })
    });

    state.setBookmarks(state.bookmarks.map(b => {
        if (!state.selectedBookmarks.has(b.id)) return b;
        const merged = new Set([...parseTagInput(b.tags || ''), ...tagsToAdd]);
        return { ...b, tags: Array.from(merged).join(', ') };
    }));

    clearSelections();
    updateCounts();
    renderBookmarks();
    renderSidebarTags();
    showToast('Tags added to selection', 'success');
}

// Bulk remove tags
export async function bulkRemoveTags() {
    if (state.selectedBookmarks.size === 0) return;

    const raw = prompt('Remove tags (comma separated):');
    const tagsToRemove = parseTagInput(raw || '');
    if (tagsToRemove.length === 0) return;

    const ids = Array.from(state.selectedBookmarks);
    await api('/tags/bulk-remove', {
        method: 'POST',
        body: JSON.stringify({ bookmark_ids: ids, tags: tagsToRemove })
    });

    const removeSet = new Set(tagsToRemove.map(t => t.toLowerCase()));
    state.setBookmarks(state.bookmarks.map(b => {
        if (!state.selectedBookmarks.has(b.id) || !b.tags) return b;
        const filtered = parseTagInput(b.tags).filter(t => !removeSet.has(t.toLowerCase()));
        return { ...b, tags: filtered.join(', ') };
    }));

    clearSelections();
    updateCounts();
    renderBookmarks();
    renderSidebarTags();
    showToast('Tags removed from selection', 'success');
}

export default {
    bulkDelete,
    bulkFavorite,
    bulkMove,
    bulkAddTags,
    bulkRemoveTags
};
