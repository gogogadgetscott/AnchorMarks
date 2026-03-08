import React, { useState, useMemo, useEffect } from "react";
import { useUI } from "../contexts/UIContext";
import { useBookmarks } from "../contexts/BookmarksContext";
import { useFolders } from "../contexts/FoldersContext";
import { Icon } from "./Icon.tsx";
import { showToast } from "@utils/ui-helpers.ts";
import { useDashboard } from "../contexts/DashboardContext";
import type { Folder, DashboardWidget } from "../types/index";

interface PickerItemProps {
  type: "folder" | "tag" | "tag-analytics";
  id: string;
  name: string;
  count?: number;
  color?: string;
  isAdded: boolean;
  indentation?: number;
  onAdd: (type: "folder" | "tag" | "tag-analytics", id: string) => void;
  onDragStart?: (item: { type: string; id: string; name: string }) => void;
}

function PickerItem({
  type,
  id,
  name,
  count,
  color,
  isAdded,
  indentation = 0,
  onAdd,
  onDragStart: onDragStartProp,
}: PickerItemProps) {
  const handleDragStart = (e: React.DragEvent) => {
    if (isAdded) {
      e.preventDefault();
      return;
    }

    if ((type === "folder" || type === "tag") && onDragStartProp) {
      onDragStartProp({
        type,
        id,
        name: "",
      });
    }

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
    }
    document.body.classList.add("dragging-widget");
  };

  const handleDragEnd = () => {
    document.body.classList.remove("dragging-widget");
  };

  const style: React.CSSProperties = {
    marginLeft: `${indentation}px`,
    opacity: isAdded ? 0.5 : 1,
    cursor: isAdded ? "not-allowed" : "pointer",
    marginBottom: "4px",
  };

  return (
    <div
      className={`filter-item widget-picker-item ${isAdded ? "added" : "draggable"}`}
      style={style}
      draggable={!isAdded}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => !isAdded && onAdd(type, id)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flex: 1,
          minWidth: 0,
        }}
      >
        {type === "folder" && (
          <span
            className="folder-color"
            style={{ background: color || "#6366f1" }}
          ></span>
        )}
        <span className="filter-item-name">{name}</span>
      </div>
      {count !== undefined && (
        <span className="filter-item-count">{count}</span>
      )}
      {isAdded && (
        <span
          style={{
            fontSize: "0.65rem",
            color: "var(--text-tertiary)",
            marginLeft: "0.25rem",
          }}
        >
          ✓
        </span>
      )}
    </div>
  );
}

export function WidgetPicker() {
  const { isWidgetPickerOpen, setIsWidgetPickerOpen } = useUI();
  const { folders, dashboardWidgets, setDashboardWidgets, tagMetadata } =
    useBookmarks();
  const { setDashboardHasUnsavedChanges } = useDashboard();
  const { getRecursiveBookmarkCount, setDraggedSidebarItem } = useFolders();
  const [isPinned, setIsPinned] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const [tagSearch, setTagSearch] = useState("");

  useEffect(() => {
    if (!isWidgetPickerOpen || isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      const dropdown = document.getElementById("widget-dropdown");
      const btn = document.getElementById("dashboard-add-widget-btn");
      const target = e.target as Node;

      if (
        dropdown &&
        !dropdown.contains(target) &&
        e.target !== btn &&
        !btn?.contains(target)
      ) {
        setIsWidgetPickerOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isWidgetPickerOpen, isPinned, setIsWidgetPickerOpen]);

  const handleAddWidget = (
    type: "folder" | "tag" | "tag-analytics",
    id: string,
  ) => {
    const dropZone = document.getElementById("dashboard-drop-zone");
    const rect = dropZone?.getBoundingClientRect();
    const x = rect ? rect.width / 2 - 160 : 100;
    const y = dropZone ? 50 + dropZone.scrollTop : 50;

    let title = `${type} Widget`;
    if (type === "folder") {
      const folder = folders.find((f) => f.id === id);
      if (folder) title = folder.name;
    } else if (type === "tag") {
      title = id;
    } else if (type === "tag-analytics") {
      title = "Tag Analytics";
    }

    const snap = (v: number) => Math.round(v / 20) * 20;
    const widget: DashboardWidget = {
      id: `${type}-${id}-${Date.now()}`,
      type,
      config: { linkedId: id },
      x: snap(x),
      y: snap(y),
      w: 320,
      h: 400,
      title,
    };

    setDashboardWidgets([...dashboardWidgets, widget]);
    setDashboardHasUnsavedChanges(true);

    if (!isPinned) {
      setIsWidgetPickerOpen(false);
    }
  };

  const filteredFolders = useMemo(() => {
    const term = folderSearch.toLowerCase().trim();
    const hasBookmarks = (f: Folder) => getRecursiveBookmarkCount(f.id) > 0;
    const baseFolders = folders.filter(hasBookmarks);

    if (!term) return baseFolders;
    return baseFolders.filter((f: Folder) =>
      f.name.toLowerCase().includes(term),
    );
  }, [folders, folderSearch]);

  const folderTree = useMemo(() => {
    const rootFolders = filteredFolders.filter((f: Folder) => !f.parent_id);
    const renderLevel = (list: Folder[], level = 0): React.ReactNode[] => {
      return list
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((folder) => {
          const children = filteredFolders.filter(
            (f: Folder) => f.parent_id === folder.id,
          );
          const isAdded = dashboardWidgets.some(
            (w: DashboardWidget) => w.type === "folder" && w.id === folder.id,
          );

          return [
            <PickerItem
              key={folder.id}
              type="folder"
              id={folder.id}
              name={folder.name}
              count={getRecursiveBookmarkCount(folder.id)}
              color={folder.color}
              isAdded={isAdded}
              indentation={level * 16}
              onAdd={handleAddWidget}
              onDragStart={(item) =>
                setDraggedSidebarItem(item as unknown as Folder)
              }
            />,
            ...renderLevel(children, level + 1),
          ];
        });
    };
    return renderLevel(rootFolders);
  }, [filteredFolders, dashboardWidgets]);

  const filteredTags = useMemo(() => {
    const term = tagSearch.toLowerCase().trim();
    const allTags = Object.keys(tagMetadata)
      .filter((t) => (tagMetadata[t].count || 0) > 0)
      .sort(
        (a, b) => (tagMetadata[b].count || 0) - (tagMetadata[a].count || 0),
      );

    const tags = allTags.map((name) => ({
      name,
      count: tagMetadata[name].count || 0,
    }));

    if (!term) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(term));
  }, [tagMetadata, tagSearch]);

  if (!isWidgetPickerOpen) return null;

  const isAnalyticsAdded = dashboardWidgets.some(
    (w: DashboardWidget) =>
      w.type === "tag-analytics" && w.id === "tag-analytics",
  );

  return (
    <div
      id="widget-dropdown"
      className="filter-dropdown"
      style={{
        zIndex: 1000,
        width: "600px",
        maxHeight: "80vh",
        overflowY: "auto",
        position: "absolute",
        top: "60px", // Adjust based on header height
        right: "20px",
      }}
    >
      <div className="filter-dropdown-header">
        <span className="filter-dropdown-title">Add Widgets to Dashboard</span>
        <div className="filter-dropdown-actions">
          <button
            className="btn-icon"
            title={isPinned ? "Unpin" : "Pin"}
            onClick={() => {
              setIsPinned(!isPinned);
              showToast(
                `Widget picker ${!isPinned ? "pinned" : "unpinned"}`,
                "success",
              );
            }}
          >
            <svg
              viewBox="0 0 512 512"
              fill={isPinned ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="16"
              style={{
                width: 14,
                height: 14,
                transform: isPinned ? "rotate(45deg)" : "none",
              }}
            >
              <polygon points="419.286,301.002 416.907,248.852 357.473,219.867 337.487,55.355 369.774,38.438 369.774,0 286.751,0 225.249,0 142.219,0 142.219,38.438 174.509,55.355 154.52,219.867 95.096,248.852 92.714,301.002 256.001,301.002" />
              <polygon points="231.399,465.871 254.464,512 277.522,465.871 277.522,315.194 231.399,315.194" />
            </svg>
          </button>
          <button
            className="btn-icon"
            title="Close"
            onClick={() => setIsWidgetPickerOpen(false)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>
      <div className="filter-dropdown-body">
        <div className="filter-row">
          <div className="filter-column">
            <h4>📁 Folders</h4>
            <input
              type="text"
              placeholder="Search folders…"
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              style={{
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                padding: "0.4rem 0.6rem",
              }}
            />
            <div
              className="filter-grid"
              style={{ display: "flex", flexDirection: "column" }}
            >
              {folderTree.length > 0 ? (
                folderTree
              ) : (
                <p
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.875rem",
                    padding: "1rem",
                  }}
                >
                  No folders found
                </p>
              )}
            </div>
          </div>

          <div className="filter-column">
            <h4>🏷️ Tags</h4>
            <input
              type="text"
              placeholder="Search tags…"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              style={{
                marginBottom: "0.5rem",
                fontSize: "0.875rem",
                padding: "0.4rem 0.6rem",
              }}
            />
            <div className="filter-grid">
              {!tagSearch && (
                <PickerItem
                  type="tag-analytics"
                  id="tag-analytics"
                  name="Tag Analytics"
                  isAdded={isAnalyticsAdded}
                  onAdd={handleAddWidget}
                />
              )}
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => (
                  <PickerItem
                    key={tag.name}
                    type="tag"
                    id={tag.name}
                    name={tag.name}
                    count={tag.count}
                    isAdded={dashboardWidgets.some(
                      (w: DashboardWidget) =>
                        w.type === "tag" && w.id === tag.name,
                    )}
                    onAdd={handleAddWidget}
                    onDragStart={(item) =>
                      setDraggedSidebarItem(item as unknown as Folder)
                    }
                  />
                ))
              ) : (
                <p
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.875rem",
                    padding: "1rem",
                  }}
                >
                  No tags found
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
