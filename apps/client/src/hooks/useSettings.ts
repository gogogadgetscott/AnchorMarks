import { useCallback } from "react";
import { useUI } from "@/contexts/UIContext";
import { useDashboard } from "@/contexts/DashboardContext";
import { useBookmarks } from "@/contexts/BookmarksContext";
import { api } from "@services/api.ts";
import { setTheme } from "@features/bookmarks/settings.ts";
import { safeLocalStorage } from "@utils/index.ts";
import { logger } from "@utils/logger.ts";
import type { FilterConfig } from "../types/index";

export function useSettings() {
  const {
    setViewMode,
    setHideFavicons,
    setHideSidebar,
    setAiSuggestionsEnabled,
    setRichLinkPreviewsEnabled,
    setIncludeChildBookmarks,
    setSnapToGrid,
    setTourCompleted,
    setTagCloudMaxTags,
    setTagCloudDefaultShowAll,
    setCurrentView,
  } = useUI();

  const {
    setDashboardConfig,
    setDashboardWidgets,
    setWidgetOrder,
    setCollapsedSections,
    setCurrentDashboardViewId,
    setCurrentDashboardViewName,
  } = useDashboard();

  const { filterConfig, setFilterConfig, setDashboardWidgets: setBookmarksWidgets } =
    useBookmarks();

  const loadSettings = useCallback(async (): Promise<void> => {
    try {
      const settings = await api<any>("/settings");

      // UI settings
      setViewMode(settings.view_mode || "grid");
      setHideFavicons(settings.hide_favicons || false);
      setHideSidebar(settings.hide_sidebar || false);
      setAiSuggestionsEnabled(settings.ai_suggestions_enabled !== false);
      setRichLinkPreviewsEnabled(!!settings.rich_link_previews_enabled);
      setIncludeChildBookmarks(settings.include_child_bookmarks === 1);
      setSnapToGrid(settings.snap_to_grid !== false);
      setTourCompleted(settings.tour_completed || false);

      if (typeof settings.tag_cloud_max_tags === "number") {
        setTagCloudMaxTags(settings.tag_cloud_max_tags);
      }
      if (typeof settings.tag_cloud_default_show_all !== "undefined") {
        setTagCloudDefaultShowAll(!!settings.tag_cloud_default_show_all);
      }

      if (settings.tag_sort) {
        setFilterConfig({ ...filterConfig, tagSort: settings.tag_sort } as FilterConfig);
      }

      if (settings.current_view) {
        await setCurrentView(settings.current_view);
      }

      // Dashboard settings
      if (settings.dashboard_mode !== undefined || settings.dashboard_tags !== undefined) {
        setDashboardConfig({
          mode: settings.dashboard_mode || "folder",
          tags: settings.dashboard_tags || [],
          bookmarkSort: settings.dashboard_sort || "recently_added",
        });
      }
      setWidgetOrder(settings.widget_order || {});

      const widgets = settings.dashboard_widgets || [];
      setDashboardWidgets(widgets);
      setBookmarksWidgets(widgets);

      setCollapsedSections(settings.collapsed_sections || []);
      if (settings.current_dashboard_view_id) {
        setCurrentDashboardViewId(settings.current_dashboard_view_id);
      }
      if (settings.current_dashboard_view_name) {
        setCurrentDashboardViewName(settings.current_dashboard_view_name);
      }

      // Apply theme (DOM side effect)
      const theme =
        settings.theme || safeLocalStorage.getItem("anchormarks_theme") || "dark";
      setTheme(theme, false);

      // Apply sidebar collapsed state
      const sidebarCollapsed = settings.hide_sidebar
        ? true
        : safeLocalStorage.getItem("anchormarks_sidebar_collapsed") === "true";
      if (window.innerWidth > 1024) {
        document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
      }
      safeLocalStorage.setItem(
        "anchormarks_sidebar_collapsed",
        String(sidebarCollapsed),
      );

      // Apply collapsed sections (DOM side effect for legacy sidebar sections)
      (settings.collapsed_sections || []).forEach((sectionId: string) => {
        const section = document.getElementById(sectionId);
        if (section) section.classList.add("collapsed");
      });
    } catch (err) {
      logger.error("Failed to load settings", err);
    }
  }, [
    setViewMode,
    setHideFavicons,
    setHideSidebar,
    setAiSuggestionsEnabled,
    setRichLinkPreviewsEnabled,
    setIncludeChildBookmarks,
    setSnapToGrid,
    setTourCompleted,
    setTagCloudMaxTags,
    setTagCloudDefaultShowAll,
    setFilterConfig,
    setCurrentView,
    setDashboardConfig,
    setDashboardWidgets,
    setBookmarksWidgets,
    setWidgetOrder,
    setCollapsedSections,
    setCurrentDashboardViewId,
    setCurrentDashboardViewName,
  ]);

  return { loadSettings };
}
