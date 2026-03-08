import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
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
  onSortWidget,
  onAddBookmarkToWidget,
  onOpenAllWidgetBookmarks,
  onShowWidgetInBookmarksView,
  onChangeWidgetColor,
  onTagAnalyticsSettingsChange,
}: DashboardGridProps) {
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [widgetPositions, setWidgetPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [dragStartPositions, setDragStartPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

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
    setDragStartPositions((prev) => ({
      ...prev,
      [widgetId]: { x: widget.x || 0, y: widget.y || 0 },
    }));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!event.active.id) return;

    const widgetId = String(event.active.id);
    const widget = widgets.find((w) => w.id === widgetId);
    if (!widget) return;
    const startPos = dragStartPositions[widgetId] || {
      x: widget.x || 0,
      y: widget.y || 0,
    };

    setWidgetPositions((prev) => {
      return {
        ...prev,
        [widgetId]: {
          x: startPos.x + event.delta.x,
          y: startPos.y + event.delta.y,
        },
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const widgetId = String(event.active.id);
    const widget = widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const finalPos = widgetPositions[widgetId] || { x: widget.x || 0, y: widget.y || 0 };

    // Ensure positions are non-negative
    const x = Math.max(0, finalPos.x);
    const y = Math.max(0, finalPos.y);

    onMoveWidget?.(widgetId, x, y);

    setActiveWidgetId(null);
    setWidgetPositions((prev) => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
    setDragStartPositions((prev) => {
      const next = { ...prev };
      delete next[widgetId];
      return next;
    });
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
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <section
        className="dashboard-freeform-container"
        id="dashboard-drop-zone"
        data-testid="dashboard-grid"
      >
        <div className="dashboard-widgets-container">
          {widgets.map((widget, index) => {
            const tempPos = widgetPositions[widget.id];
            const widgetWithPos = tempPos
              ? { ...widget, x: tempPos.x, y: tempPos.y }
              : widget;

            return (
              <DashboardWidget
                key={widget.id}
                widgetIndex={index}
                widget={widgetWithPos}
                isEditing={isEditMode}
                isDragging={activeWidgetId === widget.id}
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
            );
          })}
        </div>
      </section>
    </DndContext>
  );
}
