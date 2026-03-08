import { useCallback } from "react";
import { useUI } from "../contexts/UIContext";
import { useAuth } from "../contexts/AuthContext";
import { useBookmarks } from "../contexts/BookmarksContext";
import { Icon } from "./Icon.tsx";
import { ViewToggle } from "./ViewToggle.tsx";
import { UserProfile } from "./UserProfile.tsx";
import { SelectionUI, BulkAction } from "./SelectionUI.tsx";
import { DashboardToolbar } from "./DashboardToolbar.tsx";
import { Omnibar } from "./Omnibar.tsx";
import { useDashboard } from "../contexts/DashboardContext";

export function Header() {
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
  }, []);

  const handleLogout = useCallback(async () => {
    const { logout } = await import("@features/auth/auth.ts");
    logout();
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

  const handleShowViews = useCallback(async () => {
    const dashboard = await import("@features/bookmarks/dashboard.ts");
    const initViews = (dashboard as Record<string, unknown>).initDashboardViews;
    if (typeof initViews === "function") {
      await initViews();
      const viewsBtn = document.getElementById("views-btn");
      viewsBtn?.click();
    }
  }, []);

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

  const avatarChar = currentUser?.username?.[0]?.toUpperCase() ?? "U";
  const userName = currentUser?.username ?? "User";

  return (
    <header className="header" id={`${currentView}-header`} role="banner">
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
                <DashboardToolbar
                  hasUnsavedChanges={dashboardHasUnsavedChanges}
                  viewName={currentDashboardViewName}
                  onSaveClick={handleSaveDashboard}
                  onViewsClick={handleShowViews}
                  onAddWidgetClick={() =>
                    setIsWidgetPickerOpen(!isWidgetPickerOpen)
                  }
                  onFullscreenClick={handleToggleFullscreen}
                  onLayoutSettingsClick={handleLayoutSettings}
                />
                <UserProfile
                  name={userName}
                  avatarChar={avatarChar}
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
