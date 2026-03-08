import { DashboardWidget } from "./DashboardWidget.tsx";
import type {
  Bookmark,
  DashboardWidget as DashboardWidgetType,
  TagAnalyticsItem,
  CooccurrenceItem,
} from "../types/index";

interface DashboardGridProps {
  widgets: DashboardWidgetType[];
  isEditMode?: boolean;
  previewBookmarksByWidgetId?: Record<string, Bookmark[]>;
  metricsByWidgetId?: Record<string, Record<string, number>>;
  linkedWidgetIdByWidgetId?: Record<string, string>;
  tagAnalyticsData?: {
    tags: TagAnalyticsItem[];
    cooccurrence: CooccurrenceItem[];
  };
  onEditWidget?: (widgetId: string) => void;
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

export function DashboardGrid({
  widgets,
  isEditMode = false,
  previewBookmarksByWidgetId = {},
  metricsByWidgetId = {},
  linkedWidgetIdByWidgetId = {},
  tagAnalyticsData,
  onEditWidget,
  onRemoveWidget,
  onSortWidget,
  onAddBookmarkToWidget,
  onOpenAllWidgetBookmarks,
  onShowWidgetInBookmarksView,
  onChangeWidgetColor,
  onTagAnalyticsSettingsChange,
}: DashboardGridProps) {
  if (!widgets.length) {
    return (
      <section
        className="dashboard-freeform-container"
        id="dashboard-drop-zone"
        data-testid="dashboard-grid"
      >
        <div
          className="dashboard-help-text"
          data-testid="dashboard-empty-state"
        >
          No widgets. Click "Add Widget" to get started.
        </div>
      </section>
    );
  }

  return (
    <section
      className="dashboard-freeform-container"
      id="dashboard-drop-zone"
      data-testid="dashboard-grid"
    >
      <div className="dashboard-widgets-container">
        {widgets.map((widget, index) => (
          <DashboardWidget
            key={widget.id}
            widgetIndex={index}
            widget={widget}
            isEditing={isEditMode}
            previewBookmarks={previewBookmarksByWidgetId[widget.id] ?? []}
            metrics={metricsByWidgetId[widget.id] ?? {}}
            linkedWidgetId={linkedWidgetIdByWidgetId[widget.id] ?? widget.id}
            tagAnalyticsData={tagAnalyticsData}
            onEdit={onEditWidget}
            onRemove={onRemoveWidget}
            onSortWidget={onSortWidget}
            onAddBookmarkToWidget={onAddBookmarkToWidget}
            onOpenAllWidgetBookmarks={onOpenAllWidgetBookmarks}
            onShowWidgetInBookmarksView={onShowWidgetInBookmarksView}
            onChangeWidgetColor={onChangeWidgetColor}
            onTagAnalyticsSettingsChange={onTagAnalyticsSettingsChange}
          />
        ))}
      </div>
    </section>
  );
}
