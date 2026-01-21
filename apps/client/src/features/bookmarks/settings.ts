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
import { applyTheme } from "@features/state.ts";
import type { UserSettings } from "../../types/index";
// Import saveSettings at the top for use in all functions
// (function is defined below)
// Initialize theme and high contrast controls
export function initThemeControls(settings: UserSettings) {
  const themeSelect = document.getElementById(
    "theme-select",
  ) as HTMLSelectElement;
  if (themeSelect) {
    themeSelect.value = settings.theme || "system";
    themeSelect.addEventListener("change", () => {
      settings.theme = themeSelect.value as UserSettings["theme"];
      applyTheme(settings);
      saveSettings(settings);
    });
  }
}
/**
 * AnchorMarks - Settings Module
 * Handles user settings loading, saving, and applying
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { dom } from "@utils/ui-helpers.ts";

// Load settings from server
export async function loadSettings(): Promise<void> {
  try {
    const settings = await api<any>("/settings");
    state.setViewMode(settings.view_mode || "grid");
    // Theme and high contrast controls
    initThemeControls(settings);
    applyTheme(settings);
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

    // Tag Cloud settings
    if (typeof settings.tag_cloud_max_tags === "number") {
      state.setTagCloudMaxTags(settings.tag_cloud_max_tags);
    }
    if (typeof settings.tag_cloud_default_show_all !== "undefined") {
      state.setTagCloudDefaultShowAll(!!settings.tag_cloud_default_show_all);
    }

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

    // Apply sidebar collapsed state - use server setting with localStorage fallback
    let sidebarCollapsed = settings.hide_sidebar
      ? true
      : localStorage.getItem("anchormarks_sidebar_collapsed") === "true";
    // Persist desktop collapsed state only; ignore on mobile
    // removed stray import
    if (sidebarCollapsed && window.innerWidth > 1024) {
      document.body.classList.add("sidebar-collapsed");
    } else if (!sidebarCollapsed && window.innerWidth > 1024) {
      document.body.classList.remove("sidebar-collapsed");
    }
    localStorage.setItem(
      "anchormarks_sidebar_collapsed",
      String(sidebarCollapsed),
    );
    // removed erroneous call
    // Apply collapsed sections
    state.collapsedSections.forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) section.classList.add("collapsed");
    });
  } catch (err) {
    console.error("Failed to load settings:", err);
    // removed erroneous call
  }

  // Save settings to server
  // ...existing code...

  // Apply theme
  // removed erroneous call
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
  console.log("[Settings] Toggling rich link previews:", newValue);
  state.setRichLinkPreviewsEnabled(newValue);
  saveSettings({ rich_link_previews_enabled: newValue ? 1 : 0 });

  // Refresh view
  import("@features/bookmarks/bookmarks.ts").then(({ renderBookmarks }) => {
    renderBookmarks();
  });
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
    import("@features/bookmarks/bookmarks.ts");
  }
}

// Toggle sidebar
export function toggleSidebar(): void {
  // Check if we're on mobile/tablet (window width <= 1024px)
  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    // On mobile/tablet, toggle the sidebar open state (overlay)
    document.body.classList.toggle("mobile-sidebar-open");
  } else {
    // On desktop, toggle the collapsed state
    const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("anchormarks_sidebar_collapsed", String(isCollapsed));
    state.setHideSidebar(isCollapsed);
    // Also save to server settings for cross-device sync
    saveSettings({ hide_sidebar: isCollapsed ? 1 : 0 });
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

  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
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

// Install bookmark button shortcut (drag to bookmarks bar)
function buildBookmarkletCode(): string {
  // Use server origin even when running Vite dev (5173/4173) so the bookmarklet hits the Express server
  const currentOrigin = window.location.origin;
  const devOrigins = [":5173", ":4173"];
  const isDevClient = devOrigins.some((p) => currentOrigin.endsWith(p));
  const baseUrl = isDevClient
    ? currentOrigin.replace(/:\d+$/, ":3000")
    : currentOrigin;

  return `javascript:(function(){var title=encodeURIComponent(window.document.title||'');var url=encodeURIComponent(window.location.href);var ua=navigator.userAgent;var ver="1.0";var isSafari=ua.indexOf('Safari')>-1&&ua.indexOf('Chrome')===-1&&ua.indexOf('Chromium')===-1;if(isM())mAdd();else dAdd();function dAdd(){var br=getBrowser();var w=579;var h=467;if(br=='firefox'){if(isMac())h=462;else h=495;}else if(br=='opera'){w=600;h=554;}else if(br=='safari'){h=488;}else if(br=='chrome'&&isMac()){h=467;}else if(br=='ie'){h=452;}var left=(screen.width-w)/2;var tops=(screen.height-h)/3;var win=window.open('${baseUrl}/addbookmark?title='+title+'&url='+url+'&bv='+ver,'_blank','top='+tops+', left='+left+', width='+w+', height='+h+' resizable=1, location=no, menubar=0, scrollbars=0, status=0, toolbar=0');if(br=='ie'&&win)setTimeout(function(){win.focus();},5);}function mAdd(){void(window.open('${baseUrl}/m-addbookmark?title='+title+'&url='+url+'&bv='+ver,'_blank'));}function isM(){return !!(ua.match(/Android/i)||ua.match(/webOS/i)||ua.match(/iPhone/i)||ua.match(/iPad/i)||ua.match(/iPod/i)||ua.match(/BlackBerry/i)||ua.match(/Windows Phone/i));}function getBrowser(){if(ua.indexOf('Edge')>-1)return 'edge';if(ua.indexOf('Opera')>-1||ua.indexOf('OPR')>-1)return 'opera';if(ua.indexOf('Chrome')>-1)return 'chrome';if(ua.indexOf('Firefox')>-1)return 'firefox';if(ua.indexOf('MSIE')>-1||ua.indexOf('Trident')>-1||ua.indexOf('rv:11')>-1)return 'ie';if(isSafari)return 'safari';return 'other';}function isMac(){return ua.indexOf('Macintosh')>-1;}})();`;
}

function primeBookmarkletButton(
  button: HTMLElement | null,
  code: string,
): void {
  if (!button) return;
  const anchor = button as HTMLAnchorElement;
  anchor.setAttribute("href", code);
  anchor.setAttribute("draggable", "true");
  anchor.setAttribute("title", "📌 Add to AnchorMarks");
  anchor.dataset.bookmarkletReady = "true";
}

export function installBookmarkShortcut(): void {
  const button = document.getElementById("add-bookmark-button");
  const statusDiv = document.getElementById("bookmark-shortcut-status");
  const statusText = document.getElementById("shortcut-status-text");
  const helpLink = document.getElementById("bookmark-help-link");

  if (!button) return;

  const bookmarkletCode = buildBookmarkletCode();
  primeBookmarkletButton(button, bookmarkletCode);

  // Ensure the rendered button carries the correct bookmarklet code for drag/click
  const bookmarkAnchor = button as HTMLAnchorElement;
  bookmarkAnchor.setAttribute("href", bookmarkletCode);
  bookmarkAnchor.setAttribute("draggable", "true");

  button.addEventListener("dragstart", (e: DragEvent) => {
    if (!e.dataTransfer) return;
    // Provide multiple mime types so browsers accept the drop as a link/bookmark
    e.dataTransfer.clearData();
    e.dataTransfer.effectAllowed = "copyLink";
    e.dataTransfer.dropEffect = "copy";
    // Ensure title is carried across browsers when creating the bookmark entry
    // Carry the URL in standard formats; browsers typically take the title from the link text itself
    e.dataTransfer.setData("text/uri-list", bookmarkletCode);
    e.dataTransfer.setData("text/plain", bookmarkletCode);
    e.dataTransfer.setData(
      "text/html",
      `<a href="${bookmarkletCode}">📌 Add to AnchorMarks</a>`,
    );
    // Firefox honors text/x-moz-url as "url\nTitle" for bookmark drops
    e.dataTransfer.setData(
      "text/x-moz-url",
      `${bookmarkletCode}\n📌 Add to AnchorMarks`,
    );
    // Keep the drag image stable so the button doesn't "move" while dragging
    if (typeof e.dataTransfer.setDragImage === "function") {
      e.dataTransfer.setDragImage(
        button as HTMLElement,
        (button as HTMLElement).clientWidth / 2,
        (button as HTMLElement).clientHeight / 2,
      );
    }
    button.style.opacity = "0.6";
    if (statusDiv && statusText) {
      statusText.textContent = "📍 Drag to your Bookmarks Bar...";
      statusDiv.style.color = "var(--info-color, #2196f3)";
      statusDiv.style.display = "block";
    }
  });

  button.addEventListener("dragend", () => {
    button.style.opacity = "1";
    if (statusDiv) {
      setTimeout(() => {
        statusDiv.style.display = "none";
      }, 1000);
    }
  });

  // Optional click-to-copy convenience; not required before dragging
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      if (statusDiv && statusText) {
        statusText.textContent =
          "✅ Bookmarklet copied. Right-click the button and choose 'Bookmark this link' if drag is blocked.";
        statusDiv.style.color = "var(--success-color, #16a34a)";
        statusDiv.style.display = "block";
      } else {
        alert(
          "Bookmarklet copied. If drag is blocked, right-click and choose 'Bookmark this link'.",
        );
      }
    } catch (err) {
      console.warn("Clipboard copy failed", err);
      const fallback = document.createElement("textarea");
      fallback.value = bookmarkletCode;
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      document.body.removeChild(fallback);
      if (statusDiv && statusText) {
        statusText.textContent =
          "ℹ️ Drag to the bookmarks bar or right-click and bookmark this link.";
        statusDiv.style.color = "var(--info-color, #2196f3)";
        statusDiv.style.display = "block";
      } else {
        alert(
          "Copy failed in this browser. Create a new bookmark manually and paste the code.",
        );
      }
    }
  });

  if (helpLink) {
    helpLink.addEventListener("click", (e) => {
      e.preventDefault();
      showBookmarkletHelp();
    });
  }
}

function showBookmarkletHelp(): void {
  const message = [
    "How to use the bookmark button:",
    "",
    "Desktop (Chrome/Edge/Firefox/Safari):",
    "1) Show your Bookmarks Bar (Ctrl+Shift+B or Cmd+Shift+B).",
    "2) Drag the 'Add to AnchorMarks' button to the bar.",
    "3) Click it on any page to open the add-bookmark window.",
    "",
    "Mobile:",
    "The button opens a mobile-friendly add page in a new tab.",
    "",
    "If drag doesn't work, create a new bookmark manually and paste the button code as the URL.",
  ].join("\n");
  alert(message);
}

export default {
  loadSettings,
  applyTheme,
  setTheme,
  applyFaviconSetting,
  toggleFavicons,
  toggleAiSuggestions,
  toggleRichLinkPreviews,
  toggleSidebar,
  setViewMode,
  toggleSection,
  installBookmarkShortcut,
};
