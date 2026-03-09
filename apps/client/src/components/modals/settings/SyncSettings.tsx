import { useEffect } from "react";
import { installBookmarkShortcut } from "@features/bookmarks/settings.ts";

export function SyncSettings() {
  useEffect(() => {
    installBookmarkShortcut();
  }, []);

  return (
    <div className="sync-settings">
      <div className="setting-item">
        <div className="setting-info">
          <h4>Bookmark Button Shortcut</h4>
          <p>
            Drag the button below to your browser&apos;s Bookmarks Bar (
            <a
              href="#"
              id="bookmark-help-link"
              style={{
                color: "var(--link-color)",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              click here for Help
            </a>
            )
          </p>
          <div
            id="bookmark-buttons-container"
            style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" }}
          >
            <a
              id="add-bookmark-button"
              href="#"
              className="btn btn-secondary"
              draggable="true"
              title="Drag this button to your browser's bookmarks bar to add bookmarks quickly"
              style={{ cursor: "grab", userSelect: "none" }}
            >
              📌 Add to AnchorMarks
            </a>
          </div>
          <div
            id="bookmark-shortcut-status"
            style={{
              marginTop: "1rem",
              fontSize: "0.85rem",
              display: "none",
              padding: "0.5rem",
              background: "var(--bg-secondary)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span id="shortcut-status-text"></span>
          </div>
        </div>
      </div>
    </div>
  );
}
