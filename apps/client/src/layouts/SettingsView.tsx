import React, { memo, useState, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { useAppState } from '../contexts/AppContext';

export const SettingsView = memo(() => {
  const { currentUser, viewMode, setViewMode, hideFavicons, setHideFavicons } = useAppState();
  const [theme, setThemeState] = useState(localStorage.getItem('anchormarks_theme') || 'dark');

  const handleThemeChange = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem('anchormarks_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const handleExportData = useCallback(async () => {
    // TODO: Implement export
    console.log('Export data');
  }, []);

  const handleImportData = useCallback(() => {
    // TODO: Implement import
    console.log('Import data');
  }, []);

  return (
    <div id="settings-view" className="settings-view">
      <div className="settings-container">
        <h1>Settings</h1>

        <section className="settings-section">
          <h2>Appearance</h2>
          
          <div className="setting-item">
            <label htmlFor="theme-select">Theme</label>
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="form-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>

          <div className="setting-item">
            <label htmlFor="view-mode-select">Default View Mode</label>
            <select
              id="view-mode-select"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="form-select"
            >
              <option value="grid">Grid</option>
              <option value="list">List</option>
              <option value="compact">Compact</option>
            </select>
          </div>

          <div className="setting-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hideFavicons}
                onChange={(e) => setHideFavicons(e.target.checked)}
              />
              <span>Hide favicons</span>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2>Account</h2>
          
          <div className="setting-item">
            <label>Email</label>
            <p className="setting-value">{currentUser?.email || 'Not logged in'}</p>
          </div>

          <div className="setting-item">
            <label>API Key</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <code id="api-key-value" className="api-key-display">
                {currentUser?.api_key || 'No API key'}
              </code>
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(currentUser?.api_key || '')}>
                Copy
              </Button>
              <Button variant="secondary" onClick={() => console.log('Regenerate API key')}>
                Regenerate
              </Button>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>Data Management</h2>
          
          <div className="setting-item">
            <label>Import / Export</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="secondary"
                icon={<Icon name="upload" size={16} />}
                onClick={handleImportData}
              >
                Import
              </Button>
              <Button
                variant="secondary"
                icon={<Icon name="download" size={16} />}
                onClick={handleExportData}
              >
                Export
              </Button>
            </div>
          </div>

          <div className="setting-item">
            <label>Danger Zone</label>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Reset all bookmarks? This cannot be undone!')) {
                  console.log('Reset bookmarks');
                }
              }}
            >
              Reset All Bookmarks
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
});

SettingsView.displayName = 'SettingsView';
