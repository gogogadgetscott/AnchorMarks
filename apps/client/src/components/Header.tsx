import React, { useCallback } from "react";
import { useUI } from "../contexts/UIContext";
import { useAuth } from "../contexts/AuthContext";
import { useBookmarks } from "../contexts/BookmarksContext";
import { Icon } from "./Icon.tsx";
import { Omnibar } from "./Omnibar.tsx";
import { ViewToggle } from "./ViewToggle.tsx";
import { UserProfile } from "./UserProfile.tsx";
import { SelectionUI, BulkAction } from "./SelectionUI.tsx";

export function Header() {
  const {
    currentView,
    viewMode,
    hideSidebar,
    viewToolbarConfig,
    isWidgetPickerOpen,
    setViewMode,
    setIsWidgetPickerOpen,
  } = useUI();
  const { currentUser } = useAuth();
  const { selectedBookmarks } = useBookmarks();

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
    const m = await import("@features/bookmarks/bookmarks.ts");
    switch (action) {
      case "archive":
        (m as Record<string, unknown>).bulkArchive?.();
        break;
      case "unarchive":
        (m as Record<string, unknown>).bulkUnarchive?.();
        break;
      case "delete":
        (m as Record<string, unknown>).bulkDelete?.();
        break;
      case "move":
        (m as Record<string, unknown>).bulkMove?.();
        break;
      case "tag":
        (m as Record<string, unknown>).bulkTag?.();
        break;
      case "auto-tag":
        (m as Record<string, unknown>).bulkAutoTag?.();
        break;
    }
  }, []);

  const avatarChar = currentUser?.username?.[0]?.toUpperCase() ?? "U";
  const userName = currentUser?.username ?? "User";

  return (
    <header
      className="content-header"
      id={`${currentView}-header`}
      role="banner"
    >
      {!isBulkMode ? (
        <div className="header-normal-ui">
          <div className="header-left">
            <button
              className="btn-icon"
              id={`toggle-sidebar-btn-${currentView}`}
              title="Toggle Sidebar"
              aria-label="Toggle sidebar"
              aria-expanded={!hideSidebar}
              onClick={handleSidebarToggle}
            >
              <Icon name="menu" />
            </button>
            <h1>{title}</h1>
          </div>

          <div className="header-center">
            <Omnibar />
          </div>

          <div className="header-right">
            {currentView === "dashboard" && (
              <button
                id="dashboard-add-widget-btn"
                className={`btn btn-primary ${isWidgetPickerOpen ? "active" : ""}`}
                onClick={() => setIsWidgetPickerOpen(!isWidgetPickerOpen)}
              >
                <Icon name="plus" size={16} />
                <span>Add Widget</span>
              </button>
            )}
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
              <ViewToggle activeMode={viewMode} onModeChange={setViewMode} />
            )}
            <UserProfile
              name={userName}
              avatarChar={avatarChar}
              onOpenSettings={handleOpenSettings}
              onLogout={handleLogout}
            />
          </div>
        </div>
      ) : (
        <SelectionUI
          selectionCount={selectionCount}
          onClear={handleClearSelection}
          onSelectAll={handleSelectAll}
          onBulkAction={handleBulkAction}
        />
      )}
    </header>
  );
}
