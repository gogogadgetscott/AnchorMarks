import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
  onMoveWidget?: (widgetId: string, x: number, y: number) => void;
  onResizeWidget?: (widgetId: string, width: number, height: number) => void;
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
  onMoveWidget,
  onResizeWidget,
  onSortWidget,
  onAddBookmarkToWidget,
  onOpenAllWidgetBookmarks,
  onShowWidgetInBookmarksView,
  onChangeWidgetColor,
  onTagAnalyticsSettingsChange,
}: DashboardGridProps) {
  const CANVAS_PADDING = 40;
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);

  const getWidgetWidth = (widget: DashboardWidgetType): number => {
    const legacyWidget = widget as DashboardWidgetType & { width?: number };
    return widget.w ?? legacyWidget.width ?? 320;
  };

  const getWidgetHeight = (widget: DashboardWidgetType): number => {
    const legacyWidget = widget as DashboardWidgetType & { height?: number };
    return widget.h ?? legacyWidget.height ?? 260;
  };

  const widgetBounds = widgets.reduce(
    (bounds, widget) => {
      const x = Math.max(0, widget.x ?? 0);
      const y = Math.max(0, widget.y ?? 0);
      const width = getWidgetWidth(widget);
      const height = getWidgetHeight(widget);

      return {
        maxRight: Math.max(bounds.maxRight, x + width),
        maxBottom: Math.max(bounds.maxBottom, y + height),
      };
    },
    { maxRight: 0, maxBottom: 0 },
  );

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const widgetId = String(event.active.id);
    const widget = widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    setActiveWidgetId(widgetId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const widgetId = String(event.active.id);
    const widget = widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const x = Math.max(0, (widget.x || 0) + event.delta.x);
    const y = Math.max(0, (widget.y || 0) + event.delta.y);

    onMoveWidget?.(widgetId, x, y);

    setActiveWidgetId(null);
  };

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
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section
        className="dashboard-freeform-container"
        id="dashboard-drop-zone"
        data-testid="dashboard-grid"
      >
        <div
          className="dashboard-widgets-container"
          style={{
            width: `${widgetBounds.maxRight + CANVAS_PADDING}px`,
            height: `${widgetBounds.maxBottom + CANVAS_PADDING}px`,
          }}
        >
          {widgets.map((widget, index) => {
            return (
              <DashboardWidget
                key={widget.id}
                widgetIndex={index}
                widget={widget}
                isEditing={isEditMode}
                isDragging={activeWidgetId === widget.id}
                previewBookmarks={previewBookmarksByWidgetId[widget.id] ?? []}
                metrics={metricsByWidgetId[widget.id] ?? {}}
                linkedWidgetId={
                  linkedWidgetIdByWidgetId[widget.id] ?? widget.id
                }
                tagAnalyticsData={tagAnalyticsData}
                onEdit={onEditWidget}
                onRemove={onRemoveWidget}
                onResizeWidget={onResizeWidget}
                onSortWidget={onSortWidget}
                onAddBookmarkToWidget={onAddBookmarkToWidget}
                onOpenAllWidgetBookmarks={onOpenAllWidgetBookmarks}
                onShowWidgetInBookmarksView={onShowWidgetInBookmarksView}
                onChangeWidgetColor={onChangeWidgetColor}
                onTagAnalyticsSettingsChange={onTagAnalyticsSettingsChange}
              />
            );
          })}
        </div>
      </section>
    </DndContext>
  );
}
