/**
 * AnchorMarks - Settings Module
 * Handles user settings loading, saving, and applying
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";

// Load settings from server
export async function loadSettings(): Promise<void> {
  try {
    const settings = await api("/settings");
    state.setViewMode(settings.view_mode || "grid");
    state.setHideFavicons(settings.hide_favicons || false);
    state.setHideSidebar(settings.hide_sidebar || false);
    state.setAiSuggestionsEnabled(settings.ai_suggestions_enabled !== false);
    state.setRichLinkPreviewsEnabled(!!settings.rich_link_previews_enabled);
    state.setIncludeChildBookmarks(settings.include_child_bookmarks === 1);
    state.setSnapToGrid(settings.snap_to_grid !== false);
    state.setDashboardConfig({
      mode: settings.dashboard_mode || "folder",
      tags: settings.dashboard_tags || [],
      bookmarkSort: settings.dashboard_sort || "recently_added",
    });
    state.setWidgetOrder(settings.widget_order || {});
    state.setDashboardWidgets(settings.dashboard_widgets || []);
    state.setCollapsedSections(settings.collapsed_sections || []);
    state.setTourCompleted(settings.tour_completed || false);

    // Load tag sort preference
    if (settings.tag_sort) {
      state.setFilterConfig({
        ...state.filterConfig,
        tagSort: settings.tag_sort,
      });
    }

    // Set current view from settings
    if (settings.current_view) {
      state.setCurrentView(settings.current_view);
    }

    // Restore current dashboard view name and ID
    if (settings.current_dashboard_view_id) {
      state.setCurrentDashboardViewId(settings.current_dashboard_view_id);
    }
    if (settings.current_dashboard_view_name) {
      state.setCurrentDashboardViewName(settings.current_dashboard_view_name);
    }

    // Apply theme
    const theme =
      settings.theme || localStorage.getItem("anchormarks_theme") || "dark";
    setTheme(theme, false); // false = don't save to server again since we just loaded it

    // Apply sidebar collapsed state from localStorage
    const sidebarCollapsed =
      localStorage.getItem("anchormarks_sidebar_collapsed") === "true";
    // Persist desktop collapsed state only; ignore on mobile
    if (sidebarCollapsed && window.innerWidth > 768) {
      document.body.classList.add("sidebar-collapsed");
    }

    // Apply collapsed sections
    state.collapsedSections.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) section.classList.add("collapsed");
    });
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

// Save settings to server
export async function saveSettings(
  updates: Record<string, any>,
): Promise<void> {
  try {
    await api("/settings", {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

// Apply theme
export function applyTheme(): void {
  // Theme is applied when settings are loaded
}

// Set theme
export function setTheme(themeName: string, save = true): void {
  if (!themeName) return;
  document.documentElement.setAttribute("data-theme", themeName);
  localStorage.setItem("anchormarks_theme", themeName);

  const themeSelect = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement;
  if (themeSelect) themeSelect.value = themeName;

  if (save) {
    saveSettings({ theme: themeName });
  }
}

// Apply favicon setting
export function applyFaviconSetting(): void {
  const toggle = document.getElementById(
    "hide-favicons-toggle",
  ) as HTMLInputElement;
  if (toggle) toggle.checked = state.hideFavicons;

  const aiToggle = document.getElementById(
    "ai-suggestions-toggle",
  ) as HTMLInputElement;
  if (aiToggle) aiToggle.checked = state.aiSuggestionsEnabled;

  const richToggle = document.getElementById(
    "rich-link-previews-toggle",
  ) as HTMLInputElement;
  if (richToggle) richToggle.checked = state.richLinkPreviewsEnabled;

  const childToggle = document.getElementById(
    "include-children-toggle",
  ) as HTMLInputElement;
  if (childToggle) childToggle.checked = state.includeChildBookmarks;
}

// Toggle favicons
export function toggleFavicons(): void {
  const toggle = document.getElementById(
    "hide-favicons-toggle",
  ) as HTMLInputElement;
  const newValue = toggle?.checked || false;
  state.setHideFavicons(newValue);
  saveSettings({ hide_favicons: newValue });
}

// Toggle AI suggestions
export function toggleAiSuggestions(): void {
  const toggle = document.getElementById(
    "ai-suggestions-toggle",
  ) as HTMLInputElement;
  const newValue = toggle?.checked !== false;
  state.setAiSuggestionsEnabled(newValue);
  saveSettings({ ai_suggestions_enabled: newValue ? 1 : 0 });
}

// Toggle rich link previews
export function toggleRichLinkPreviews(): void {
  const toggle = document.getElementById(
    "rich-link-previews-toggle",
  ) as HTMLInputElement;
  const newValue = toggle?.checked || false;
  state.setRichLinkPreviewsEnabled(newValue);
  saveSettings({ rich_link_previews_enabled: newValue ? 1 : 0 });

  // Reload bookmarks to apply the new view if we matches some criteria?
  // Actually, the card view logic should handle the switch dynamically.
  import("@features/bookmarks/bookmarks.ts")
    .then(({ renderBookmarks }) => {
      renderBookmarks();
    })
    .catch(console.error);
}

// Toggle child bookmarks
export function toggleIncludeChildBookmarks(): void {
  const toggle = document.getElementById(
    "include-children-toggle",
  ) as HTMLInputElement;
  const newValue = toggle?.checked || false;
  state.setIncludeChildBookmarks(newValue);
  saveSettings({ include_child_bookmarks: newValue ? 1 : 0 });

  // Reload if necessary
  if (state.currentView === "folder" || state.currentView === "dashboard") {
    import("@features/bookmarks/bookmarks.ts")
      .then(({ loadBookmarks }) => {
        loadBookmarks();
      })
      .catch(console.error);
  }
}

// Toggle sidebar
export function toggleSidebar(): void {
  // Check if we're on mobile (window width <= 768px)
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // On mobile, toggle the mobile sidebar open state (overlay)
    document.body.classList.toggle("mobile-sidebar-open");
  } else {
    // On desktop, toggle the collapsed state
    const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("anchormarks_sidebar_collapsed", String(isCollapsed));
  }
}

// Set view mode
export function setViewMode(mode: "grid" | "list" | "compact"): void {
  state.setViewMode(mode);
  saveSettings({ view_mode: mode });

  document.querySelectorAll(".view-btn").forEach((btn: any) => {
    btn.classList.toggle("active", btn.dataset.viewMode === mode);
  });

  const classMap: Record<string, string> = {
    grid: "bookmarks-grid",
    list: "bookmarks-list",
    compact: "bookmarks-compact",
  };

  const container = document.getElementById("bookmarks-container");
  if (container) {
    container.className = classMap[mode] || "bookmarks-grid";
  }
}

// Toggle sidebar section
export function toggleSection(sectionId: string): void {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.toggle("collapsed");
    const isCollapsed = section.classList.contains("collapsed");

    let sections = [...state.collapsedSections];
    if (isCollapsed) {
      if (!sections.includes(sectionId)) {
        sections.push(sectionId);
      }
    } else {
      sections = sections.filter((id) => id !== sectionId);
    }
    state.setCollapsedSections(sections);
    saveSettings({ collapsed_sections: sections });
  }
}

export default {
  loadSettings,
  saveSettings,
  applyTheme,
  setTheme,
  applyFaviconSetting,
  toggleFavicons,
  toggleAiSuggestions,
  toggleRichLinkPreviews,
  toggleSidebar,
  setViewMode,
  toggleSection,
};
