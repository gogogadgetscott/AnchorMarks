import { useUI } from "@/contexts/UIContext";
import { setTheme, saveSettings } from "@features/bookmarks/settings.ts";

export function GeneralSettings() {
  const {
    hideFavicons,
    setHideFavicons,
    aiSuggestionsEnabled,
    setAiSuggestionsEnabled,
    richLinkPreviewsEnabled,
    setRichLinkPreviewsEnabled,
    includeChildBookmarks,
    setIncludeChildBookmarks,
    snapToGrid,
    setSnapToGrid,
  } = useUI();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value);
  };

  const handleToggle = (
    _key: string,
    value: boolean,
    setter: (val: boolean) => void,
    serverKey: string,
  ) => {
    setter(value);
    saveSettings({ [serverKey]: value ? 1 : 0 });
  };

  return (
    <div className="general-settings">
      <div className="settings-section">
        <h4>Appearance</h4>
        <div className="form-group">
          <label htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            className="form-input"
            onChange={handleThemeChange}
            defaultValue={
              document.documentElement.getAttribute("data-theme") || "dark"
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className="settings-toggles" style={{ marginTop: "1.5rem" }}>
          <label className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Show Favicons</span>
              <span className="toggle-description">
                Display website icons next to bookmarks
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-input"
              checked={!hideFavicons}
              onChange={(e) =>
                handleToggle(
                  "hideFavicons",
                  !e.target.checked,
                  setHideFavicons,
                  "hide_favicons",
                )
              }
            />
            <div className="toggle-slider"></div>
          </label>

          <label className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Rich Link Previews</span>
              <span className="toggle-description">
                Show images and detailed info for bookmarks
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-input"
              checked={richLinkPreviewsEnabled}
              onChange={(e) =>
                handleToggle(
                  "richLinkPreviewsEnabled",
                  e.target.checked,
                  setRichLinkPreviewsEnabled,
                  "rich_link_previews_enabled",
                )
              }
            />
            <div className="toggle-slider"></div>
          </label>
        </div>
      </div>

      <div className="settings-section" style={{ marginTop: "2rem" }}>
        <h4>Features</h4>
        <div className="settings-toggles">
          <label className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">AI Suggestions</span>
              <span className="toggle-description">
                Use AI to group bookmarks and suggest tags
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-input"
              checked={aiSuggestionsEnabled}
              onChange={(e) =>
                handleToggle(
                  "aiSuggestionsEnabled",
                  e.target.checked,
                  setAiSuggestionsEnabled,
                  "ai_suggestions_enabled",
                )
              }
            />
            <div className="toggle-slider"></div>
          </label>

          <label className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Include Child Bookmarks</span>
              <span className="toggle-description">
                Show bookmarks from subfolders in parent folders
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-input"
              checked={includeChildBookmarks}
              onChange={(e) =>
                handleToggle(
                  "includeChildBookmarks",
                  e.target.checked,
                  setIncludeChildBookmarks,
                  "include_child_bookmarks",
                )
              }
            />
            <div className="toggle-slider"></div>
          </label>

          <label className="toggle-item">
            <div className="toggle-info">
              <span className="toggle-label">Snap to Grid</span>
              <span className="toggle-description">
                Align dashboard widgets to a grid when dragging
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-input"
              checked={snapToGrid}
              onChange={(e) =>
                handleToggle(
                  "snapToGrid",
                  e.target.checked,
                  setSnapToGrid,
                  "snap_to_grid",
                )
              }
            />
            <div className="toggle-slider"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
