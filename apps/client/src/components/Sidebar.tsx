import { useUI } from "../contexts/UIContext";
import { useBookmarks } from "../contexts/BookmarksContext";
import { Icon } from "./Icon.tsx";
import { pluralize } from "@utils/index.ts";

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
  const {
    bookmarks,
    folders,
    totalCount,
    renderedBookmarks,
    dashboardWidgets
  } = useBookmarks();

  // Calculate counts for badges
  const getBadgeCount = (view: string) => {
    switch (view) {
      case "all": return totalCount;
      case "favorites": return bookmarks.filter(b => b.is_favorite).length;
      case "recent": return bookmarks.filter(b => b.visit_count > 0).length; // Simpler logic for now
      case "most-used": return bookmarks.filter(b => b.visit_count > 5).length;
      case "archived": return bookmarks.filter(b => b.is_archived).length;
      default: return 0;
    }
  };

  // Calculate stats for the bottom bar
  let bCount = totalCount;
  let fCount = folders.length;
  let tCount = 0;

  const tagSet = new Set();
  renderedBookmarks.forEach((b) => {
    if (b.tags) {
      b.tags.split(",").forEach((t) => {
        const tag = t.trim();
        if (tag) tagSet.add(tag);
      });
    }
  });
  tCount = tagSet.size;

  if (currentView === "dashboard") {
    fCount = dashboardWidgets.filter((w) => w.type === "folder").length;
    tCount = dashboardWidgets.filter((w) => w.type === "tag").length;

    const displayedIds = new Set();
    dashboardWidgets.forEach((w) => {
      if (w.type === "folder") {
        bookmarks.filter((b) => b.folder_id === w.id).forEach((b) => displayedIds.add(b.id));
      } else if (w.type === "tag") {
        bookmarks.filter((b) => b.tags?.split(",").map(t => t.trim()).includes(w.id)).forEach((b) => displayedIds.add(b.id));
      }
    });
    bCount = displayedIds.size;
  }

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
              {view !== "dashboard" && view !== "tag-cloud" && view !== "analytics" && (
                <span className="badge">
                  {getBadgeCount(view)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Folders Section */}
        <div className="sidebar-section">
          <div
            className="sidebar-section-header"
            onClick={() => handleSectionToggle("folders")}
          >
            <Icon name="folder" size={16} />
            <span>Folders</span>
            <span className="section-chevron">▼</span>
          </div>
          <div className="sidebar-section-content">
            {folders.filter(f => !f.parent_id).map(folder => (
              <FolderItem
                key={folder.id}
                folder={folder}
                allFolders={folders}
                currentFolder={currentFolder}
                onSelect={setCurrentFolder}
              />
            ))}
          </div>
        </div>

        {/* Tags Section */}
        <div className="sidebar-section" id="tags-section">
          <div
            className="sidebar-section-header"
            onClick={() => handleSectionToggle("tags")}
          >
            <Icon name="tag" size={16} />
            <span>Tags</span>
            <span className="section-chevron">▼</span>
          </div>
          <div className="sidebar-section-content">
            <div className="sidebar-search">
              <input
                type="text"
                placeholder="Search tags..."
                onChange={(e) => {/* Handle search */ }}
              />
            </div>
            <div className="tag-list">
              {Object.keys(tagMetadata).slice(0, 15).map(tagName => (
                <div
                  key={tagName}
                  className={`sidebar-tag-item ${filterConfig.tags.includes(tagName) ? 'active' : ''}`}
                  onClick={() => {
                    const tags = filterConfig.tags.includes(tagName)
                      ? filterConfig.tags.filter(t => t !== tagName)
                      : [...filterConfig.tags, tagName];
                    setFilterConfig({ ...filterConfig, tags });
                  }}
                >
                  <span className="tag-name">{tagName}</span>
                  <span className="tag-count">{tagMetadata[tagName].count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <Icon name="link" className="stat-icon" size={16} />
            <span className="stat-value">
              {bCount}
            </span>
            <span className="stat-label">
              {pluralize(bCount, "link", "links")}
            </span>
          </div>
          <div className="stat-item">
            <Icon name="folder" className="stat-icon" size={16} />
            <span className="stat-value">
              {fCount}
            </span>
            <span className="stat-label">
              {pluralize(fCount, "folder", "folders")}
            </span>
          </div>
          <div className="stat-item">
            <Icon name="tag" className="stat-icon" size={16} />
            <span className="stat-value">
              {tCount}
            </span>
            <span className="stat-label">
              {pluralize(tCount, "tag", "tags")}
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
