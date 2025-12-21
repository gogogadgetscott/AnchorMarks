import React, { useEffect, useState, memo } from 'react';
import { AppProvider, useAppState } from './contexts/AppContext';
import { AuthScreen } from './layouts/AuthScreen';
import { Sidebar } from './layouts/Sidebar';
import { Dashboard } from './layouts/Dashboard';
import { BookmarksView } from './layouts/BookmarksView';
import { FoldersView } from './layouts/FoldersView';
import { TagsView } from './layouts/TagsView';
import { SettingsView } from './layouts/SettingsView';
import { ToastContainer } from './layouts/Toast';
import { logger } from '@utils/logger.ts';

/**
 * Main app component that renders the appropriate view based on state
 */
const MainApp = memo(() => {
  const { currentView, isAuthenticated } = useAppState();

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'bookmarks':
      case 'favorites':
      case 'recent':
      case 'archived':
        return <BookmarksView />;
      case 'folders':
        return <FoldersView />;
      case 'tags':
        return <TagsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <BookmarksView />;
    }
  };

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div id="main-app" className="main-app">
      <div className="sidebar-backdrop" id="sidebar-backdrop" />
      <Sidebar />
      <main className="main-content">
        {renderContent()}
      </main>
      <ToastContainer />
    </div>
  );
});

MainApp.displayName = 'MainApp';

/**
 * Root app component with initialization logic
 */
const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load theme from localStorage
        const savedTheme = localStorage.getItem('anchormarks_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Initialize keyboard handlers
        const { handleKeyboard } = await import('@features/keyboard/handler.ts');
        document.addEventListener('keydown', handleKeyboard);

        setIsInitialized(true);

        logger.info('App initialized');
      } catch (err) {
        logger.error('Failed to initialize app', err);
      }
    };

    initializeApp();

    return () => {
      // Cleanup
      const { handleKeyboard } = require('@features/keyboard/handler.ts');
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, []);

  if (!isInitialized) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
};

export default App;
