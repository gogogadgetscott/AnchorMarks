export function ShortcutSettings() {
  const shortcuts = [
    {
      category: "Navigation",
      items: [
        { action: "Go to Dashboard", keys: ["Ctrl", "Shift", "D"] },
        { action: "Go to Favorites", keys: ["Ctrl", "Shift", "F"] },
        { action: "Go to All Bookmarks", keys: ["Ctrl", "Shift", "A"] },
        { action: "Toggle Sidebar", keys: ["B"] },
      ],
    },
    {
      category: "Actions",
      items: [
        { action: "Add New Bookmark", keys: ["Ctrl", "N"] },
        { action: "Focus Search", keys: ["K"] },
        { action: "Toggle Bulk Select", keys: ["X"] },
        { action: "Close Modals", keys: ["Esc"] },
      ],
    },
    {
      category: "Views",
      items: [
        { action: "Grid View", keys: ["1"] },
        { action: "List View", keys: ["2"] },
        { action: "Compact View", keys: ["3"] },
      ],
    },
  ];

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <div className="shortcut-settings">
      <div className="settings-section">
        <h4>Keyboard Shortcuts</h4>
        <p
          className="text-tertiary"
          style={{ fontSize: "0.85rem", marginBottom: "2rem" }}
        >
          Master AnchorMarks with these keyboard shortcuts.
          {isMac && (
            <span style={{ marginLeft: "0.5rem" }}>
              (Use Cmd instead of Ctrl)
            </span>
          )}
        </p>

        {shortcuts.map((cat) => (
          <div
            key={cat.category}
            className="shortcut-category"
            style={{ marginBottom: "2rem" }}
          >
            <h5
              style={{
                borderBottom: "1px solid var(--border-color)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              {cat.category}
            </h5>
            <div className="shortcut-list">
              {cat.items.map((item) => (
                <div
                  key={item.action}
                  className="shortcut-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.4rem 0",
                  }}
                >
                  <span className="shortcut-action">{item.action}</span>
                  <div
                    className="shortcut-keys"
                    style={{ display: "flex", gap: "0.3rem" }}
                  >
                    {item.keys.map((key) => (
                      <kbd
                        key={key}
                        style={{
                          background: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "4px",
                          padding: "2px 6px",
                          fontSize: "0.75rem",
                          boxShadow: "0 2px 0 var(--border-color)",
                        }}
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
