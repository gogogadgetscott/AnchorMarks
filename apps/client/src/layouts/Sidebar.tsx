import React, { memo, useCallback } from "react";
import { Icon } from "../components/Icon.tsx";
import { Button } from "../components/Button.tsx";
import { useAppState } from "../contexts/AppContext";

interface SidebarProps {
  onAddBookmark?: () => void;
  onToggle?: () => void;
}

export const Sidebar = memo<SidebarProps>(({ onAddBookmark, onToggle }) => {
  const { currentView, setCurrentView, bookmarks, folders } = useAppState();

  const handleNavClick = useCallback(
    (view: string) => {
      setCurrentView(view);
    },
    [setCurrentView],
  );

  const counts = {
    all: bookmarks.length,
    favorites: bookmarks.filter((b) => b.is_favorite).length,
    recent: bookmarks.filter((b) => {
      const added = new Date(b.created_at || 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return added > weekAgo;
    }).length,
    archived: bookmarks.filter((b) => b.is_archived).length,
  };

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon small">
            <img src="/icon.png" alt="AnchorMarks Logo" />
          </div>
          <span className="logo-text">AnchorMarks</span>
        </div>
      </div>

      <div className="sidebar-actions">
        <Button
          variant="primary"
          className="btn-full"
          onClick={onAddBookmark}
          id="sidebar-add-bookmark-btn"
          icon={<Icon name="plus" size={16} />}
        >
          Add Bookmark
        </Button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div
            className={`nav-item ${currentView === "dashboard" ? "active" : ""}`}
            onClick={() => handleNavClick("dashboard")}
            data-view="dashboard"
          >
            <Icon name="grid" size={20} />
            <span>Dashboard</span>
            <span className="badge" id="dashboard-count">
              {counts.all}
            </span>
          </div>

          <div
            className={`nav-item ${currentView === "all" ? "active" : ""}`}
            onClick={() => handleNavClick("all")}
            data-view="all"
          >
            <Icon name="list" size={20} />
            <span>All Bookmarks</span>
            <span className="badge" id="all-count">
              {counts.all}
            </span>
          </div>

          <div
            className={`nav-item ${currentView === "favorites" ? "active" : ""}`}
            onClick={() => handleNavClick("favorites")}
            data-view="favorites"
          >
            <Icon name="star" size={20} />
            <span>Favorites</span>
            <span className="badge" id="favorites-count">
              {counts.favorites}
            </span>
          </div>

          <div
            className={`nav-item ${currentView === "recent" ? "active" : ""}`}
            onClick={() => handleNavClick("recent")}
            data-view="recent"
          >
            <Icon name="refresh" size={20} />
            <span>Recent</span>
            <span className="badge" id="recent-count">
              {counts.recent}
            </span>
          </div>

          <div
            className={`nav-item ${currentView === "archived" ? "active" : ""}`}
            onClick={() => handleNavClick("archived")}
            data-view="archived"
          >
            <Icon name="archive" size={20} />
            <span>Archived</span>
            <span className="badge" id="archived-count">
              {counts.archived}
            </span>
          </div>

          <div
            className={`nav-item ${currentView === "tag-cloud" ? "active" : ""}`}
            onClick={() => handleNavClick("tag-cloud")}
            data-view="tag-cloud"
          >
            <Icon name="tag" size={20} />
            <span>Tag Cloud</span>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-header">
            <span>Folders</span>
            <button className="btn-icon" id="add-folder-btn" title="Add folder">
              <Icon name="plus" size={16} />
            </button>
          </div>
          <div id="folders-list" className="folders-list">
            {folders.length === 0 ? (
              <div className="empty-folders">
                <p>No folders yet</p>
              </div>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.id}
                  className="nav-item folder-item"
                  data-folder-id={folder.id}
                >
                  <Icon
                    name={(folder as any).icon || "folder"}
                    size={20}
                    color={folder.color}
                  />
                  <span>{folder.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="nav-section">
          <div
            className={`nav-item ${currentView === "settings" ? "active" : ""}`}
            onClick={() => handleNavClick("settings")}
            data-view="settings"
          >
            <Icon name="settings" size={20} />
            <span>Settings</span>
          </div>
        </div>
      </nav>
    </aside>
  );
});

Sidebar.displayName = "Sidebar";
