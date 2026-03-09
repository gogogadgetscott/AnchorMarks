import { useState, useCallback } from "react";
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

const FOLDER_INDENT_PX = 10;

function FolderItem({
  folder,
  allFolders,
  currentFolder,
  onSelect,
  depth = 0,
}: {
  folder: any;
  allFolders: any[];
  currentFolder: string | null;
  onSelect: (id: string | null) => void | Promise<void>;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const children = allFolders.filter((f) => f.parent_id === folder.id);
  const hasChildren = children.length > 0;
  const isActive = currentFolder === folder.id;

  return (
    <div
      className="folder-tree-item"
      style={{ paddingLeft: `${depth * FOLDER_INDENT_PX}px` }}
    >
      <div
        className={`nav-item folder-item ${isActive ? "active" : ""}`}
        onClick={() => void onSelect(isActive ? null : folder.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && void onSelect(isActive ? null : folder.id)}
      >
        <span
          className={["folder-toggle", !hasChildren && "folder-toggle-hidden"].filter(Boolean).join(" ")}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
        >
          <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={12} />
        </span>
        <Icon name="folder" size={16} />
        <span className="folder-name">{folder.name}</span>
      </div>
      {isOpen && hasChildren && (
        <div className="folder-children">
          {children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              currentFolder={currentFolder}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { currentView, setCurrentView, currentFolder, setCurrentFolder } =
    useUI();
  const {
    bookmarks,
    totalCount,
    setFilterConfig,
    filterConfig,
    tagMetadata,
    dashboardWidgets,
    loadBookmarks,
  } = useBookmarks();
  const { folders } = useFolders();

  const [tagSearch, setTagSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["folders", "tags"]),
  );

  const toggleSection = (id: string) => {
    const next = new Set(expandedSections);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSections(next);
  };

  // Calculate counts for badges
  const getBadgeCount = (view: string) => {
    switch (view) {
      case "all":
        return totalCount;
      case "favorites":
        return bookmarks.filter((b) => b.is_favorite).length;
      case "recent":
        return bookmarks.filter((b) => b.click_count ?? 0 > 0).length;
      case "most-used":
        return bookmarks.filter((b) => b.click_count ?? 0 > 5).length;
      case "archived":
        return bookmarks.filter((b) => b.is_archived).length;
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
        await loadBookmarks();
      }
    },
    [setCurrentView, setCurrentFolder, loadBookmarks],
  );

  const handleAddBookmark = useCallback(async () => {
    const { openModal } = await import("@utils/ui-helpers.ts");
    openModal("bookmark-modal");
  }, []);

  const handleFolderSelect = useCallback(
    async (folderId: string | null) => {
      const targetView = folderId ? "folder" : "all";
      const nextFilterConfig = {
        ...filterConfig,
        tags: [],
        search: undefined,
        folder: folderId,
      };

      await setCurrentView(targetView);
      setCurrentFolder(folderId);
      setFilterConfig(nextFilterConfig);

      if (window.innerWidth <= 1024) {
        document.body.classList.remove("mobile-sidebar-open");
      }

      await loadBookmarks({
        folderId,
        view: targetView,
        filterOverride: nextFilterConfig,
      });
    },
    [
      setCurrentView,
      setCurrentFolder,
      setFilterConfig,
      filterConfig,
      loadBookmarks,
    ],
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
              className={`nav-item${currentView === view && !currentFolder ? " active" : ""}`}
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
              <div className="folder-item-container">
                {folders
                  .filter((f) => !f.parent_id)
                  .map((folder) => (
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      allFolders={folders}
                      currentFolder={currentFolder}
                      onSelect={handleFolderSelect}
                    />
                  ))}
              </div>
              {folders.length === 0 && (
                <div className="sidebar-empty-state">No folders yet</div>
              )}
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
                    onClick={() => {
                      const tags = filterConfig.tags.includes(tagName)
                        ? filterConfig.tags.filter((t) => t !== tagName)
                        : [...filterConfig.tags, tagName];
                      setFilterConfig({ ...filterConfig, tags });
                      setCurrentView("all");
                      setCurrentFolder(null);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const tags = filterConfig.tags.includes(tagName)
                          ? filterConfig.tags.filter((t) => t !== tagName)
                          : [...filterConfig.tags, tagName];
                        setFilterConfig({ ...filterConfig, tags });
                        setCurrentView("all");
                        setCurrentFolder(null);
                      }
                    }}
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
