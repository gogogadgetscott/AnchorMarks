import { useCallback, useState } from "react";
import { DashboardToolbar } from "./DashboardToolbar.tsx";
import { useAuth } from "../contexts/AuthContext";
import { useBookmarks } from "../contexts/BookmarksContext";
import { useDashboard } from "../contexts/DashboardContext";
import { useUI } from "../contexts/UIContext";
import { Icon } from "./Icon.tsx";
import { Omnibar } from "./Omnibar.tsx";
import { SelectionUI, BulkAction } from "./SelectionUI.tsx";
import { UserProfile } from "./UserProfile.tsx";
import { ViewToggle } from "./ViewToggle.tsx";
import BookmarkViews from "./BookmarkViews"; // Rendered near DashboardToolbar

export function Header() {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const {
    currentView,
    viewMode,
    viewToolbarConfig,
    isWidgetPickerOpen,
    setViewMode,
    setIsWidgetPickerOpen,
  } = useUI();
  const { currentUser } = useAuth();
  const { selectedBookmarks } = useBookmarks();
  const { dashboardHasUnsavedChanges, currentDashboardViewName } =
    useDashboard();

  const config = (viewToolbarConfig[currentView] ?? {}) as Record<
    string,
    unknown
  >;
  const title = (config.title as string) ?? currentView;
  const showViewToggle = (config.showViewToggle as boolean) ?? true;
  const showFilters = (config.showFilters as boolean) ?? false;

  const selectionCount = selectedBookmarks.size;
  const isBulkMode = selectionCount > 0;

  const handleSidebarToggle = useCallback(async () => {
    const { toggleSidebar } = await import("@features/bookmarks/settings.ts");
    toggleSidebar();
  }, []);

  const handleOpenSettings = useCallback(async () => {
    const { openModal } = await import("@utils/ui-helpers.ts");
    openModal("settings-modal");
    setIsUserDropdownOpen(false);
  }, []);

  const handleLogout = useCallback(async () => {
    const { logout } = await import("@features/auth/auth.ts");
    logout();
  }, []);

  const handleToggleUserDropdown = useCallback(() => {
    setIsUserDropdownOpen((prev) => !prev);
  }, []);

  const handleClearSelection = useCallback(async () => {
    const { clearSelection } = await import("@features/bookmarks/bookmarks.ts");
    clearSelection?.();
  }, []);

  const handleSelectAll = useCallback(async () => {
    const { selectAllBookmarks } =
      await import("@features/bookmarks/bookmarks.ts");
    selectAllBookmarks?.();
  }, []);

  const handleBulkAction = useCallback(async (action: BulkAction) => {
    const m: any = await import("@features/bookmarks/bookmarks.ts");
    switch (action) {
      case "archive":
        m.bulkArchive?.();
        break;
      case "unarchive":
        m.bulkUnarchive?.();
        break;
      case "delete":
        m.bulkDelete?.();
        break;
      case "move":
        m.bulkMove?.();
        break;
      case "tag":
        m.bulkTag?.();
        break;
      case "auto-tag":
        m.bulkAutoTag?.();
        break;
    }
  }, []);

  const handleSaveDashboard = useCallback(async () => {
    const { saveDashboardStateSnapshot } =
      await import("@features/bookmarks/dashboard.ts");
    saveDashboardStateSnapshot?.();
  }, []);

  // Bookmark views are rendered by the React component; no legacy init required.

  const handleToggleFullscreen = useCallback(async () => {
    const { toggleFullscreen } =
      await import("@features/bookmarks/dashboard.ts");
    toggleFullscreen?.();
  }, []);

  const handleLayoutSettings = useCallback(async () => {
    const { toggleLayoutSettings } =
      await import("@features/bookmarks/dashboard.ts");
    toggleLayoutSettings?.();
  }, []);

    const handleViewsClick = useCallback(async () => {
      try {
        const { api } = await import("@services/api.ts");
        const views = await api("/bookmark/views");
        window.dispatchEvent(
          new CustomEvent("bookmark-views:open", { detail: { views } })
        );
      } catch (err) {
        console.error("Failed to load views:", err);
      }
    }, []);

  const handleFilterClick = useCallback(async () => {
    const { toggleFilterDropdown } = await import("@features/bookmarks/filters.ts");
    toggleFilterDropdown();
  }, []);

  const avatarChar = currentUser?.username?.[0]?.toUpperCase() ?? "U";
  const userName = currentUser?.username ?? "User";

  return (
    <header
      className="header content-header"
      id={`${currentView}-header`}
      role="banner"
    >
      {!isBulkMode ? (
        <div className="header-content header-normal-ui">
          <div className="header-left">
            <button
              id="sidebar-toggle-btn"
              className="btn-icon sidebar-toggle"
              title="Toggle Sidebar"
              aria-label="Toggle sidebar"
              aria-expanded="true"
              onClick={handleSidebarToggle}
            >
              <Icon name="menu" size={20} />
            </button>
            <h1 id="view-title" className="view-title">
              {title}
            </h1>
          </div>

          <div className="header-center">
            <Omnibar />
          </div>

          <div className="header-right">
            {currentView === "dashboard" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <DashboardToolbar
                    hasUnsavedChanges={dashboardHasUnsavedChanges}
                    viewName={currentDashboardViewName}
                    onSaveClick={handleSaveDashboard}
                     onViewsClick={handleViewsClick}
                    onAddWidgetClick={() =>
                      setIsWidgetPickerOpen(!isWidgetPickerOpen)
                    }
                    onFullscreenClick={handleToggleFullscreen}
                    onLayoutSettingsClick={handleLayoutSettings}
                  />
                  <BookmarkViews />
                </div>
                <UserProfile
                  name={userName}
                  avatarChar={avatarChar}
                  isOpen={isUserDropdownOpen}
                  onToggleDropdown={handleToggleUserDropdown}
                  onOpenSettings={handleOpenSettings}
                  onLogout={handleLogout}
                />
              </>
            ) : (
              <>
                {showFilters && (
                  <button
                    id="filter-dropdown-btn"
                    className="btn btn-secondary"
                    title="Filters"
                    aria-label="Open filters"
                    aria-haspopup="true"
                    onClick={handleFilterClick}
                  >
                    <Icon name="filter" size={16} />
                    <span className="filter-btn-text">Filters</span>
                  </button>
                )}
                {showViewToggle && (
                  <ViewToggle
                    activeMode={viewMode}
                    onModeChange={setViewMode}
                  />
                )}
                <UserProfile
                  name={userName}
                  avatarChar={avatarChar}
                  isOpen={isUserDropdownOpen}
                  onToggleDropdown={handleToggleUserDropdown}
                  onOpenSettings={handleOpenSettings}
                  onLogout={handleLogout}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="header-selection-ui">
          <SelectionUI
            selectionCount={selectionCount}
            onClear={handleClearSelection}
            onSelectAll={handleSelectAll}
            onBulkAction={handleBulkAction}
          />
        </div>
      )}
    </header>
  );
}
