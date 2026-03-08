import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { DashboardGrid } from "@components/DashboardGrid.tsx";
import type {
  Bookmark,
  DashboardWidget,
  TagAnalyticsItem,
  CooccurrenceItem,
} from "@types";

interface RenderReactDashboardInput {
  outlet: HTMLElement;
  widgets: DashboardWidget[];
  previewBookmarksByWidgetId?: Record<string, Bookmark[]>;
  metricsByWidgetId?: Record<string, Record<string, number>>;
  linkedWidgetIdByWidgetId?: Record<string, string>;
  tagAnalyticsData?: {
    tags: TagAnalyticsItem[];
    cooccurrence: CooccurrenceItem[];
  };
  onRemoveWidget?: (widgetId: string) => void;
  onSortWidget?: (
    widgetIndex: number,
    sort: "a-z" | "z-a" | "recent" | "most_visited",
  ) => void;
  onAddBookmarkToWidget?: (widgetType: string, widgetId: string) => void;
  onOpenAllWidgetBookmarks?: (widgetIndex: number) => void;
  onShowWidgetInBookmarksView?: (widgetType: string, widgetId: string) => void;
  onChangeWidgetColor?: (widgetIndex: number, color: string) => void;
  onTagAnalyticsSettingsChange?: (
    widgetIndex: number,
    settings: {
      metric?: string;
      limit?: number;
      pairSort?: string;
      colors?: {
        usage?: string;
        clicks?: string;
        favorites?: string;
        pairs?: string;
      };
    },
  ) => void;
}

let dashboardRoot: Root | null = null;
let dashboardMountPoint: HTMLElement | null = null;

export function renderReactDashboard({
  outlet,
  widgets,
  previewBookmarksByWidgetId = {},
  metricsByWidgetId = {},
  linkedWidgetIdByWidgetId = {},
  tagAnalyticsData,
  onRemoveWidget,
  onSortWidget,
  onAddBookmarkToWidget,
  onOpenAllWidgetBookmarks,
  onShowWidgetInBookmarksView,
  onChangeWidgetColor,
  onTagAnalyticsSettingsChange,
}: RenderReactDashboardInput): void {
  let mountPoint = outlet.querySelector(
    "#dashboard-react-root",
  ) as HTMLElement | null;

  if (!mountPoint) {
    outlet.innerHTML = '<div id="dashboard-react-root"></div>';
    mountPoint = outlet.querySelector(
      "#dashboard-react-root",
    ) as HTMLElement | null;
  }

  if (!mountPoint) {
    throw new Error("Dashboard React mount point could not be created");
  }

  if (!dashboardRoot || dashboardMountPoint !== mountPoint) {
    dashboardRoot?.unmount();
    dashboardRoot = createRoot(mountPoint);
    dashboardMountPoint = mountPoint;
  }

  flushSync(() => {
    dashboardRoot?.render(
      React.createElement(DashboardGrid, {
        widgets,
        isEditMode: true,
        previewBookmarksByWidgetId,
        metricsByWidgetId,
        linkedWidgetIdByWidgetId,
        tagAnalyticsData,
        onRemoveWidget,
        onSortWidget,
        onAddBookmarkToWidget,
        onOpenAllWidgetBookmarks,
        onShowWidgetInBookmarksView,
        onChangeWidgetColor,
        onTagAnalyticsSettingsChange,
      }),
    );
  });
}

export function unmountReactDashboard(): void {
  if (dashboardRoot) {
    dashboardRoot.unmount();
  }

  dashboardRoot = null;
  dashboardMountPoint = null;
}
