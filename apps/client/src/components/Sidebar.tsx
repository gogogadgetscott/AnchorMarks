import { useState, useCallback, useEffect } from "react";
import { api } from "../services/api.ts";
import { useUI } from "../contexts/UIContext";
import { useBookmarks } from "../contexts/BookmarksContext";
import { useFolders } from "../contexts/FoldersContext";
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
  { view: "favorites", label: "Favorites", icon: "star", countId: "fav-count" },
  { view: "recent", label: "Recent", icon: "clock", countId: "count-recent" },
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
  const { currentView, setCurrentView, setCurrentFolder } =
    useUI();
  const {
    bookmarks,
    totalCount,
    setFilterConfig,
    filterConfig,
    tagMetadata,
    viewFolderIds,
    dashboardWidgets,
    loadBookmarks,
  } = useBookmarks();
  const { folders } = useFolders();

  const [tagSearch, setTagSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["folders", "tags"]),
  );
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    api<Record<string, number>>("/bookmarks/counts")
      .then((data) => setViewCounts(data))
      .catch(() => {});
  }, [bookmarks]);

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSections(next);
  };

  // Calculate counts for badges using server-provided counts
  const getBadgeCount = (view: string) => {
    switch (view) {
      case "all":
        return viewCounts.all ?? totalCount;
      case "favorites":
        return viewCounts.favorites ?? 0;
      case "recent":
        return viewCounts.recent ?? 0;
      case "most-used":
        return viewCounts.most_used ?? 0;
      case "archived":
        return viewCounts.archived ?? 0;
      default:
        return 0;
    }
  };

  // Calculate stats for the bottom bar
  let bCount = totalCount;
  let fCount = folders.length;
  let tCount = Object.keys(tagMetadata).length;

  if (currentView === "dashboard") {
    fCount = dashboardWidgets.filter((w) => w.type === "folder").length;
    tCount = dashboardWidgets.filter((w) => w.type === "tag").length;

    const displayedIds = new Set();
    dashboardWidgets.forEach((w) => {
      if (w.type === "folder") {
        bookmarks
          .filter((b) => b.folder_id === w.id)
          .forEach((b) => displayedIds.add(b.id));
      } else if (w.type === "tag") {
        bookmarks
          .filter((b) =>
            b.tags
              ?.split(",")
              .map((t) => t.trim())
              .includes(w.id),
          )
          .forEach((b) => displayedIds.add(b.id));
      }
    });
    bCount = displayedIds.size;
  }

  const handleNavClick = useCallback(
    async (view: string) => {
      setCurrentView(view);
      setCurrentFolder(null);

      // Clear tag and folder filters when switching views so sidebar reflects the new view cleanly
      const nextFilterConfig = { ...filterConfig, tags: [], folder: null };
      setFilterConfig(nextFilterConfig);

      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }

      const { saveSettings } = await import("@features/bookmarks/settings.ts");
      saveSettings({ current_view: view });

      if (
        view !== "dashboard" &&
        view !== "tag-cloud" &&
        view !== "analytics"
      ) {
        await loadBookmarks({ view, filterOverride: nextFilterConfig });
      }
    },
    [setCurrentView, setCurrentFolder, setFilterConfig, filterConfig, loadBookmarks],
  );

  const handleAddBookmark = useCallback(async () => {
    const { openModal } = await import("@utils/ui-helpers.ts");
    openModal("bookmark-modal");
  }, []);

  const handleFolderFilter = useCallback(
    async (folderId: string) => {
      const nextFolder = filterConfig.folder === folderId ? null : folderId;
      const nextFilterConfig = { ...filterConfig, folder: nextFolder };
      setFilterConfig(nextFilterConfig);
      await loadBookmarks({ view: currentView, filterOverride: nextFilterConfig });
    },
    [filterConfig, setFilterConfig, loadBookmarks, currentView],
  );

  const handleTagFilter = useCallback(
    async (tagName: string) => {
      const tags = filterConfig.tags.includes(tagName)
        ? filterConfig.tags.filter((t) => t !== tagName)
        : [...filterConfig.tags, tagName];
      const nextFilterConfig = { ...filterConfig, tags, tagMode: "AND" as const };
      setFilterConfig(nextFilterConfig);
      await loadBookmarks({ view: currentView, filterOverride: nextFilterConfig });
    },
    [filterConfig, setFilterConfig, loadBookmarks, currentView],
  );

  const filteredTags = Object.keys(tagMetadata)
    .filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()))
    .sort((a, b) => (tagMetadata[b].count || 0) - (tagMetadata[a].count || 0));

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
              className={`nav-item${currentView === view && !filterConfig.folder ? " active" : ""}`}
              data-view={view}
              onClick={() => handleNavClick(view)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleNavClick(view)}
              title={tooltip}
            >
              <Icon name={icon} size={20} />
              <span>{label}</span>
              {view !== "dashboard" &&
                view !== "tag-cloud" &&
                view !== "analytics" && (
                  <span className="badge" id={countId}>
                    {getBadgeCount(view)}
                  </span>
                )}
            </div>
          ))}
        </div>

        {/* Folders & Tags — only shown on bookmark list views */}
        {["all", "folder", "favorites", "recent", "most-used", "archived"].includes(currentView) && <>

        {/* Folders Section */}
        <div
          className={`sidebar-section ${expandedSections.has("folders") ? "expanded" : ""}`}
        >
          <div
            className="sidebar-section-header"
            onClick={() => toggleSection("folders")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && toggleSection("folders")}
            aria-expanded={expandedSections.has("folders")}
          >
            <Icon name="folder" size={15} />
            <span>Folders</span>
            <span className="section-chevron">
              <Icon
                name={expandedSections.has("folders") ? "chevron-down" : "chevron-right"}
                size={14}
              />
            </span>
          </div>
          {expandedSections.has("folders") && (
            <div className="sidebar-section-content">
              <div className="tag-list">
                {viewFolderIds.map((folderId) => {
                  const folder = folders.find((f) => f.id === folderId);
                  if (!folder) return null;
                  const isActive = filterConfig.folder === folderId;
                  return (
                    <div
                      key={folderId}
                      className={`sidebar-tag-item ${isActive ? "active" : ""}`}
                      onClick={() => void handleFolderFilter(folderId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && void handleFolderFilter(folderId)}
                    >
                      <Icon name="folder" size={14} />
                      <span className="tag-name">{folder.name}</span>
                    </div>
                  );
                })}
                {viewFolderIds.length === 0 && (
                  <div className="sidebar-empty-state">No folders</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tags Section */}
        <div
          className={`sidebar-section ${expandedSections.has("tags") ? "expanded" : ""}`}
        >
          <div
            className="sidebar-section-header"
            onClick={() => toggleSection("tags")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && toggleSection("tags")}
            aria-expanded={expandedSections.has("tags")}
          >
            <Icon name="tag" size={15} />
            <span>Tags</span>
            <span className="section-chevron">
              <Icon
                name={expandedSections.has("tags") ? "chevron-down" : "chevron-right"}
                size={14}
              />
            </span>
          </div>
          {expandedSections.has("tags") && (
            <div className="sidebar-section-content">
              <div className="sidebar-search">
                <Icon
                  name="search"
                  size={14}
                  className="sidebar-search-icon"
                />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                />
              </div>
              <div className="tag-list">
                {filteredTags.slice(0, 20).map((tagName) => (
                  <div
                    key={tagName}
                    className={`sidebar-tag-item ${filterConfig.tags.includes(tagName) ? "active" : ""}`}
                    onClick={() => void handleTagFilter(tagName)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && void handleTagFilter(tagName)}
                  >
                    <span className="tag-name">{tagName}</span>
                    <span className="tag-count">
                      {tagMetadata[tagName].count}
                    </span>
                  </div>
                ))}
                {filteredTags.length === 0 && (
                  <div className="sidebar-empty-state">No tags found</div>
                )}
              </div>
            </div>
          )}
        </div>

        </>}

        {/* Quick Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <Icon name="link" className="stat-icon" size={16} />
            <span className="stat-value" id="stat-bookmarks">
              {bCount}
            </span>
            <span className="stat-label">
              {pluralize(bCount, "link", "links")}
            </span>
          </div>
          <div className="stat-item">
            <Icon name="folder" className="stat-icon" size={16} />
            <span className="stat-value" id="stat-folders">
              {fCount}
            </span>
            <span className="stat-label">
              {pluralize(fCount, "folder", "folders")}
            </span>
          </div>
          <div className="stat-item">
            <Icon name="tag" className="stat-icon" size={16} />
            <span className="stat-value" id="stat-tags">
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
          className="sidebar-help-link"
          title="Help & Documentation"
        >
          <Icon name="help" size={18} />
          <span>Help &amp; Docs</span>
        </a>
        <div id="app-version" className="sidebar-version">
          v{import.meta.env.VITE_APP_VERSION}
        </div>
      </div>
    </aside>
  );
}
