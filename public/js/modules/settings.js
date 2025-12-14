/**
 * AnchorMarks - Settings Module
 * Handles user settings loading, saving, and applying
 */

import * as state from './state.js';
import { api } from './api.js';

// Load settings from server
export async function loadSettings() {
    try {
        const settings = await api('/settings');
        state.setViewMode(settings.view_mode || 'grid');
        state.setHideFavicons(settings.hide_favicons || false);
        state.setHideSidebar(settings.hide_sidebar || false);
        state.setDashboardConfig({
            mode: settings.dashboard_mode || 'folder',
            tags: settings.dashboard_tags || [],
            bookmarkSort: settings.dashboard_sort || 'recently_added'
        });
        state.setWidgetOrder(settings.widget_order || {});
        state.setDashboardWidgets(settings.dashboard_widgets || []);
        state.setCollapsedSections(settings.collapsed_sections || []);

        // Apply theme
        document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = settings.theme === 'dark';

        // Apply sidebar collapsed state from localStorage
        const sidebarCollapsed = localStorage.getItem('anchormarks_sidebar_collapsed') === 'true';
        if (sidebarCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        }

        // Apply collapsed sections
        state.collapsedSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.classList.add('collapsed');
        });
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

// Save settings to server
export async function saveSettings(updates) {
    try {
        await api('/settings', {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
}

// Apply theme
export function applyTheme() {
    // Theme is applied when settings are loaded
}

// Toggle theme
export function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    saveSettings({ theme: newTheme });
}

// Apply favicon setting
export function applyFaviconSetting() {
    const toggle = document.getElementById('hide-favicons-toggle');
    if (toggle) toggle.checked = state.hideFavicons;
}

// Toggle favicons
export function toggleFavicons() {
    const toggle = document.getElementById('hide-favicons-toggle');
    const newValue = toggle?.checked || false;
    state.setHideFavicons(newValue);
    saveSettings({ hide_favicons: newValue });
}

// Toggle sidebar
export function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('anchormarks_sidebar_collapsed', isCollapsed);
}

// Set view mode
export function setViewMode(mode) {
    state.setViewMode(mode);
    saveSettings({ view_mode: mode });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.viewMode === mode);
    });

    const classMap = {
        'grid': 'bookmarks-grid',
        'list': 'bookmarks-list',
        'compact': 'bookmarks-compact'
    };

    const container = document.getElementById('bookmarks-container');
    if (container) {
        container.className = classMap[mode] || 'bookmarks-grid';
    }
}

// Toggle sidebar section
export function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');

        let sections = [...state.collapsedSections];
        if (isCollapsed) {
            if (!sections.includes(sectionId)) {
                sections.push(sectionId);
            }
        } else {
            sections = sections.filter(id => id !== sectionId);
        }
        state.setCollapsedSections(sections);
        saveSettings({ collapsed_sections: sections });
    }
}

export default {
    loadSettings,
    saveSettings,
    applyTheme,
    toggleTheme,
    applyFaviconSetting,
    toggleFavicons,
    toggleSidebar,
    setViewMode,
    toggleSection
};