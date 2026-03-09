import { Icon } from "./Icon.tsx";

interface DashboardToolbarProps {
  hasUnsavedChanges?: boolean;
  viewName?: string | null;
  onSaveClick?: () => void;
  onViewsClick?: () => void;
  onAddWidgetClick?: () => void;
  onFullscreenClick?: () => void;
  onLayoutSettingsClick?: () => void;
}

export function DashboardToolbar({
  hasUnsavedChanges = false,
  viewName = null,
  onSaveClick,
  onViewsClick,
  onAddWidgetClick,
  onFullscreenClick,
  onLayoutSettingsClick,
}: DashboardToolbarProps) {
  return (
    <div
      className="dashboard-toolbar"
      role="toolbar"
      aria-label="Dashboard controls"
    >
      {/* Unsaved Indicator */}
      {hasUnsavedChanges && (
        <div
          className="dashboard-unsaved-indicator"
          id="dashboard-unsaved-indicator"
          title="You have unsaved changes"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--warning-600)",
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--warning-500)",
            }}
          ></span>
          Unsaved
        </div>
      )}

      {/* View Name Badge */}
      {viewName && (
        <div
          className="dashboard-view-badge"
          id="dashboard-view-name"
          style={{
            padding: "0.25rem 0.75rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            background: "var(--primary-50)",
            color: "var(--primary-700)",
            borderRadius: "var(--radius-full)",
          }}
        >
          {viewName}
        </div>
      )}

      {/* Action Buttons */}
      <div
        className="dashboard-toolbar-actions"
        style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}
      >
        {onSaveClick && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSaveClick}
            aria-label="Save dashboard"
            disabled={!hasUnsavedChanges}
          >
            <Icon name="save" size={14} />
            Save
          </button>
        )}

        {onViewsClick && (
           <button
             type="button"
             className="btn btn-secondary btn-sm"
             onClick={onViewsClick}
             aria-label="Dashboard views"
             id="views-btn"
           >
             <Icon name="link" size={14} />
             Views
           </button>
        )}

        {onAddWidgetClick && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onAddWidgetClick}
            aria-label="Add widget"
            id="dashboard-add-widget-btn"
          >
            <Icon name="plus" size={14} />
            Add Widget
          </button>
        )}

        {onLayoutSettingsClick && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onLayoutSettingsClick}
            aria-label="Layout settings"
            title="Layout settings"
          >
            <Icon name="settings" size={14} />
          </button>
        )}

        {onFullscreenClick && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onFullscreenClick}
            aria-label="Toggle fullscreen"
            title="Toggle fullscreen"
            id="dashboard-fullscreen-btn"
          >
            <svg
              className="fullscreen-enter-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: 14, height: 14 }}
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            <svg
              className="fullscreen-exit-icon hidden"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: 14, height: 14 }}
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
