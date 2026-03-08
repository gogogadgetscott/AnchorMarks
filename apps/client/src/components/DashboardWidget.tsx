import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "./Icon.tsx";
import { PreviewWidgetContent } from "./PreviewWidgetContent.tsx";
import { StaticWidgetContent } from "./StaticWidgetContent.tsx";
import { WidgetColorPicker } from "./WidgetColorPicker.tsx";
import { TagAnalyticsWidget } from "./TagAnalyticsWidget.tsx";
import type {
  Bookmark,
  DashboardWidget as DashboardWidgetType,
  TagAnalyticsItem,
  CooccurrenceItem,
} from "../types/index";

interface DashboardWidgetProps {
  widget: DashboardWidgetType;
  widgetIndex: number;
  isEditing: boolean;
  isDragging?: boolean;
  previewBookmarks?: Bookmark[];
  metrics?: Record<string, number>;
  linkedWidgetId: string;
  tagAnalyticsData?: {
    tags: TagAnalyticsItem[];
    cooccurrence: CooccurrenceItem[];
  };
  onEdit?: (widgetId: string) => void;
  onRemove?: (widgetId: string) => void;
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

function renderWidgetBody(
  widget: DashboardWidgetType,
  widgetIndex: number,
  previewBookmarks: Bookmark[],
  metrics: Record<string, number>,
  tagAnalyticsData?: {
    tags: TagAnalyticsItem[];
    cooccurrence: CooccurrenceItem[];
  },
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
  ) => void,
) {
  if (widget.type === "tag-analytics" && tagAnalyticsData) {
    return (
      <TagAnalyticsWidget
        widgetIndex={widgetIndex}
        tags={tagAnalyticsData.tags}
        cooccurrence={tagAnalyticsData.cooccurrence}
        initialSettings={widget.settings}
        onSettingsChange={onTagAnalyticsSettingsChange}
      />
    );
  }

  if (widget.type === "stats") {
    return <StaticWidgetContent data={metrics} />;
  }

  return <PreviewWidgetContent bookmarks={previewBookmarks} />;
}

export function DashboardWidget({
  widget,
  widgetIndex,
  isEditing,
  isDragging = false,
  previewBookmarks = [],
  metrics = {},
  linkedWidgetId,
  tagAnalyticsData,
  onEdit,
  onRemove,
  onSortWidget,
  onAddBookmarkToWidget,
  onOpenAllWidgetBookmarks,
  onShowWidgetInBookmarksView,
  onChangeWidgetColor,
  onTagAnalyticsSettingsChange,
}: DashboardWidgetProps) {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const optionsContainerRef = useRef<HTMLDivElement | null>(null);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: widget.id,
    disabled: !isEditing,
  });

  useEffect(() => {
    if (!isOptionsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!optionsContainerRef.current?.contains(target)) {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOptionsOpen]);

  const legacyWidget = widget as DashboardWidgetType & {
    width?: number;
    height?: number;
  };
  const style: CSSProperties = {
    left: `${widget.x || 0}px`,
    top: `${widget.y || 0}px`,
    width: `${widget.w ?? legacyWidget.width ?? 320}px`,
    height: `${widget.h ?? legacyWidget.height ?? 260}px`,
    position: "absolute",
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  const widgetCount =
    widget.type === "tag-analytics"
      ? ""
      : String(metrics.Bookmarks ?? previewBookmarks.length ?? 0);
  const headerStyle = widget.color
    ? ({
        backgroundColor: widget.color,
        borderColor: widget.color,
      } as CSSProperties)
    : undefined;

  return (
    <article
      ref={setNodeRef}
      className="dashboard-widget-freeform"
      data-widget-index={widgetIndex}
      data-widget-id={widget.id}
      data-widget-type={widget.type}
      data-testid="dashboard-widget"
      style={style}
      {...attributes}
    >
      <header className="widget-header" style={headerStyle}>
        <span
          className="widget-drag-handle"
          aria-hidden="true"
          style={{ cursor: isEditing ? "grab" : "default" }}
          {...listeners}
        >
          <Icon name="dashboard" size={14} />
        </span>
        <h3>{widget.title}</h3>
        <span className="widget-count">{widgetCount}</span>
        <div className="widget-actions">
          <div
            className="widget-options-container"
            ref={optionsContainerRef}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn-icon small widget-options-btn"
              title="Options"
              onClick={(e) => {
                e.stopPropagation();
                setIsOptionsOpen((prev) => !prev);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ width: 14, height: 14 }}
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
            <div
              className={`widget-options-menu ${isOptionsOpen ? "" : "hidden"}`}
              data-widget-index={widgetIndex}
            >
              {widget.type !== "tag-analytics" ? (
                <>
                  <button
                    className="widget-option"
                    type="button"
                    onClick={() => {
                      onSortWidget?.(widgetIndex, "a-z");
                      setIsOptionsOpen(false);
                    }}
                  >
                    Sort A-Z
                  </button>
                  <button
                    className="widget-option"
                    type="button"
                    onClick={() => {
                      onSortWidget?.(widgetIndex, "z-a");
                      setIsOptionsOpen(false);
                    }}
                  >
                    Sort Z-A
                  </button>
                  <div className="widget-option-divider"></div>
                  <button
                    className="widget-option"
                    type="button"
                    onClick={() => {
                      onAddBookmarkToWidget?.(widget.type, linkedWidgetId);
                      setIsOptionsOpen(false);
                    }}
                  >
                    Add Bookmark
                  </button>
                  <button
                    className="widget-option"
                    type="button"
                    onClick={() => {
                      onOpenAllWidgetBookmarks?.(widgetIndex);
                      setIsOptionsOpen(false);
                    }}
                  >
                    Open All
                  </button>
                  <button
                    className="widget-option"
                    type="button"
                    onClick={() => {
                      onShowWidgetInBookmarksView?.(
                        widget.type,
                        linkedWidgetId,
                      );
                      setIsOptionsOpen(false);
                    }}
                  >
                    Show in Bookmarks
                  </button>
                  <div className="widget-option-divider"></div>
                </>
              ) : null}
              <button
                className="widget-option"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColorPickerOpen((prev) => !prev);
                }}
              >
                Change Color
              </button>
              {isColorPickerOpen && (
                <WidgetColorPicker
                  currentColor={widget.color}
                  onColorSelect={(color) => {
                    onChangeWidgetColor?.(widgetIndex, color);
                    setIsColorPickerOpen(false);
                    setIsOptionsOpen(false);
                  }}
                />
              )}
            </div>
          </div>
          {isEditing ? (
            <button
              type="button"
              className="btn-icon small"
              aria-label="Edit widget"
              onClick={() => onEdit?.(widget.id)}
            >
              <Icon name="edit" size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="btn-icon small remove-widget-btn"
            data-widget-index={widgetIndex}
            aria-label="Remove widget"
            onClick={() => onRemove?.(widget.id)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </header>

      <div className="widget-body">
        {renderWidgetBody(
          widget,
          widgetIndex,
          previewBookmarks,
          metrics,
          tagAnalyticsData,
          onTagAnalyticsSettingsChange,
        )}
      </div>
      <div className="widget-resize-handle" title="Drag to resize"></div>
    </article>
  );
}
