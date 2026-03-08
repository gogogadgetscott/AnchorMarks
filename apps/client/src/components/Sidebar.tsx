import React, { useCallback } from "react";
import { useUI } from "../contexts/UIContext";
import { Icon } from "./Icon.tsx";

interface NavItem {
  view: string;
  label: string;
  icon: string;
  tooltip?: string;
  countId?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    view: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    tooltip: "Dashboard",
  },
  {
    view: "all",
    label: "Bookmarks",
    icon: "home",
    tooltip: "Bookmarks",
    countId: "bookmark-count",
  },
  {
    view: "favorites",
    label: "Favorites",
    icon: "star",
    countId: "fav-count",
  },
  {
    view: "recent",
    label: "Recent",
    icon: "clock",
    countId: "count-recent",
  },
  {
    view: "most-used",
    label: "Most Used",
    icon: "activity",
    tooltip: "Most Used",
    countId: "count-most-used",
  },
  {
    view: "archived",
    label: "Archived",
    icon: "archive",
    countId: "count-archived",
  },
  {
    view: "tag-cloud",
    label: "Tag Cloud",
    icon: "cloud",
    tooltip: "Tag Cloud",
  },
  {
    view: "analytics",
    label: "Analytics",
    icon: "bar-chart",
    tooltip: "Analytics",
  },
];

export function Sidebar() {
  const { currentView, setCurrentView } = useUI();

  const handleNavClick = useCallback(
    async (view: string) => {
      setCurrentView(view);

      // Close mobile sidebar
      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }

      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      saveSettings({ current_view: view });

      if (view === "dashboard") {
        const { renderDashboard } =
          await import("@features/bookmarks/dashboard.ts");
        renderDashboard();
      } else if (view === "tag-cloud") {
        const { renderTagCloud } =
          await import("@features/bookmarks/tag-cloud.ts");
        await renderTagCloud();
      } else if (view === "analytics") {
        const { renderAnalytics } = await import("@features/analytics.ts");
        await renderAnalytics();
      } else {
        const { renderSkeletons, loadBookmarks } =
          await import("@features/bookmarks/bookmarks.ts");
        renderSkeletons();
        await loadBookmarks();
      }
    },
    [setCurrentView],
  );

  const handleSectionToggle = useCallback(async (section: string) => {
    const { toggleSection } = await import("@features/bookmarks/settings.ts");
    toggleSection(section);
  }, []);

  const handleAddBookmark = useCallback(async () => {
    const { openModal } = await import("@utils/ui-helpers.ts");
    openModal("bookmark-modal");
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon small">
            <img src="/icon.png" alt="AnchorMarks Logo" />
          </div>
          <span className="logo-text">AnchorMarks</span>
        </div>
      </div>

      <div className="sidebar-actions">
        <button
          className="btn btn-primary btn-full"
          id="sidebar-add-bookmark-btn"
          title="Add Bookmark"
          onClick={handleAddBookmark}
        >
          <Icon name="plus" size={16} />
          Add Bookmark
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          {NAV_ITEMS.map(({ view, label, icon, tooltip, countId }) => (
            <div
              key={view}
              className={`nav-item${currentView === view ? " active" : ""}`}
              data-view={view}
              data-tooltip={tooltip}
              onClick={() => handleNavClick(view)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleNavClick(view)}
            >
              <Icon name={icon} size={20} />
              <span>{label}</span>
              {countId && (
                <span className="badge" id={countId}>
                  0
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Quick Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <Icon name="link" className="stat-icon" size={16} />
            <span className="stat-value" id="stat-bookmarks">
              0
            </span>
            <span className="stat-label" id="stat-label-links">
              links
            </span>
          </div>
          <div className="stat-item">
            <Icon name="folder" className="stat-icon" size={16} />
            <span className="stat-value" id="stat-folders">
              0
            </span>
            <span className="stat-label" id="stat-label-folders">
              folders
            </span>
          </div>
          <div className="stat-item">
            <Icon name="tag" className="stat-icon" size={16} />
            <span className="stat-value" id="stat-tags">
              0
            </span>
            <span className="stat-label" id="stat-label-tags">
              tags
            </span>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <a
          href="/help.html"
          target="_blank"
          className="btn btn-ghost btn-full"
          title="Help & Documentation"
          style={{
            justifyContent: "flex-start",
            gap: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          <Icon name="help" size={18} />
          <span>Help &amp; Docs</span>
        </a>
        <div
          id="app-version"
          style={{
            padding: "0.5rem 1rem",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "0.75rem",
            opacity: 0.7,
          }}
        >
          v%VITE_APP_VERSION%
        </div>
      </div>
    </aside>
  );
}
