import React, { memo, useEffect, useRef, useCallback } from "react";
import { Icon } from "../components/Icon";

export const ShortcutsPopup = memo(() => {
  const popupRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    popupRef.current?.classList.add("hidden");
  }, []);

  useEffect(() => {
    (window as any).openShortcutsPopup = () => {
      popupRef.current?.classList.remove("hidden");
    };
    (window as any).closeShortcutsPopup = () => {
      popupRef.current?.classList.add("hidden");
    };

    return () => {
      delete (window as any).openShortcutsPopup;
      delete (window as any).closeShortcutsPopup;
    };
  }, []);

  return (
    <div id="shortcuts-popup" className="shortcuts-popup hidden" ref={popupRef}>
      <div className="shortcuts-popup-backdrop" onClick={close}></div>
      <div className="shortcuts-popup-panel">
        <div className="shortcuts-popup-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="btn-icon shortcuts-popup-close" id="shortcuts-popup-close" onClick={close}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="shortcuts-popup-content">
          <div className="shortcuts-group">
            <h3>Navigation</h3>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+Shift+D</kbd></div>
              <div className="shortcut-label">Dashboard</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+Shift+F</kbd></div>
              <div className="shortcut-label">Favorites</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+Shift+A</kbd></div>
              <div className="shortcut-label">All Bookmarks</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+1</kbd>–<kbd>9</kbd></div>
              <div className="shortcut-label">Jump to Folder</div>
            </div>
          </div>

          <div className="shortcuts-group">
            <h3>Bookmarks</h3>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+N</kbd></div>
              <div className="shortcut-label">Add Bookmark</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+F</kbd></div>
              <div className="shortcut-label">Search</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+A</kbd></div>
              <div className="shortcut-label">Select All</div>
            </div>
          </div>

          <div className="shortcuts-group">
            <h3>General</h3>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Ctrl+Shift+P</kbd></div>
              <div className="shortcut-label">Command Palette</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>F11</kbd></div>
              <div className="shortcut-label">Fullscreen (Dashboard)</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Shift+/</kbd> or <kbd>?</kbd></div>
              <div className="shortcut-label">Help (this menu)</div>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys"><kbd>Esc</kbd></div>
              <div className="shortcut-label">Close/Cancel</div>
            </div>
          </div>

          <div className="shortcuts-info">
            <p>💡 On Mac, use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd></p>
            <a href="/help.html#shortcuts" target="_blank" className="shortcuts-help-link" rel="noreferrer">
              📚 View Full Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

ShortcutsPopup.displayName = "ShortcutsPopup";
