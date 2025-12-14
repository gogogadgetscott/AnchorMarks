/**
 * AnchorMarks - Import/Export Module
 * Handles bookmark import and export functionality
 */

import * as state from './state.js';
import { api } from './api.js';
import { downloadBlob } from './utils.js';
import { showToast, closeModals } from './ui.js';
import { loadBookmarks } from './bookmarks.js';
import { loadFolders } from './folders.js';

// Import HTML bookmarks file
export async function importHtml(file) {
    const html = await file.text();
    try {
        const result = await api('/import/html', {
            method: 'POST',
            body: JSON.stringify({ html })
        });
        await loadBookmarks();
        showToast(`Imported ${result.imported} bookmarks!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Export as JSON
export async function exportJson() {
    try {
        const data = await api('/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        downloadBlob(blob, 'anchormarks-bookmarks.json');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Export as HTML
export async function exportHtml() {
    try {
        const response = await fetch(`${state.API_BASE}/export?format=html`, {
            credentials: 'include'
        });

        if (response.status === 401) {
            const { logout } = await import('./auth.js');
            logout();
            throw new Error('Session expired');
        }

        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        downloadBlob(blob, 'anchormarks-bookmarks.html');
        showToast('Export successful', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Reset bookmarks to default
export async function resetBookmarks() {
    if (!confirm('Reset all bookmarks? This will delete all your bookmarks and folders, and restore the example bookmarks. This cannot be undone!')) return;

    try {
        const data = await api('/settings/reset-bookmarks', { method: 'POST' });
        state.setCurrentFolder(null);
        state.setCurrentView('all');

        const viewTitle = document.getElementById('view-title');
        if (viewTitle) viewTitle.textContent = 'Bookmarks';

        await Promise.all([loadFolders(), loadBookmarks()]);

        const { updateActiveNav } = await import('./ui.js');
        updateActiveNav();
        closeModals();
        showToast(`Bookmarks reset! ${data.bookmarks_created} example bookmarks created.`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

export default {
    importHtml,
    exportJson,
    exportHtml,
    resetBookmarks
};
