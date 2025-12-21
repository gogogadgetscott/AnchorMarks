import React, { memo, ReactNode } from "react";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { useAppState } from "../contexts/AppContext";

interface HeaderProps {
  title: string;
  count?: number;
  countSuffix?: string;
  rightContent?: ReactNode;
  showViewToggle?: boolean;
  onToggleSidebar?: () => void;
}

export const Header = memo<HeaderProps>(
  ({
    title,
    count = 0,
    countSuffix = "bookmarks",
    rightContent,
    showViewToggle = true,
    onToggleSidebar,
  }) => {
    const { viewMode, setViewMode, selectedBookmarks, clearSelection } =
      useAppState();

    const handleViewModeChange = (mode: "grid" | "list" | "compact") => {
      setViewMode(mode);
    };

    const hasSelection = selectedBookmarks.size > 0;

    return (
      <header className="content-header">
        {hasSelection ? (
          <div className="header-selection-ui">
            <div className="selection-info">
              <span className="selection-count">
                {selectedBookmarks.size} selected
              </span>
            </div>
            <div className="selection-actions">
              <Button
                variant="secondary"
                icon={<Icon name="archive" size={16} />}
              >
                Archive
              </Button>
              <Button
                variant="secondary"
                icon={<Icon name="folder" size={16} />}
              >
                Move
              </Button>
              <Button variant="secondary" icon={<Icon name="tag" size={16} />}>
                Tag
              </Button>
              <Button variant="danger" icon={<Icon name="delete" size={16} />}>
                Delete
              </Button>
              <Button variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="header-normal-ui">
            <div className="header-left">
              <Button
                variant="icon"
                onClick={onToggleSidebar}
                title="Toggle Sidebar"
                aria-label="Toggle Sidebar"
              >
                <Icon name="menu" />
              </Button>
              <h1>{title}</h1>
              <span className="bookmark-count">
                {count} {countSuffix}
              </span>
            </div>
            <div className="header-right">
              {rightContent}
              {showViewToggle && (
                <div className="view-toggle">
                  <Button
                    variant="icon"
                    className={viewMode === "grid" ? "active" : ""}
                    onClick={() => handleViewModeChange("grid")}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <Icon name="grid" size={20} />
                  </Button>
                  <Button
                    variant="icon"
                    className={viewMode === "list" ? "active" : ""}
                    onClick={() => handleViewModeChange("list")}
                    title="List view"
                    aria-label="List view"
                  >
                    <Icon name="list" size={20} />
                  </Button>
                  <Button
                    variant="icon"
                    className={viewMode === "compact" ? "active" : ""}
                    onClick={() => handleViewModeChange("compact")}
                    title="Compact view"
                    aria-label="Compact view"
                  >
                    <Icon name="list" size={20} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    );
  },
);

Header.displayName = "Header";
