import React, { useEffect, useState, memo } from 'react';
import { api } from './services/api';
import { AppProvider, useAppState } from './contexts/AppContext';
import { AuthScreen } from './layouts/AuthScreen';
import { Sidebar } from './layouts/Sidebar';
import { Dashboard } from './layouts/Dashboard';
import { BookmarksView } from './layouts/BookmarksView';
import { FoldersView } from './layouts/FoldersView';
import { TagsView } from './layouts/TagsView';
import { SettingsView } from './layouts/SettingsView';
import { ToastContainer } from './layouts/Toast';
import { ShortcutsPopup } from './layouts/ShortcutsPopup';
import { OnboardingTour } from './layouts/OnboardingTour';

/**
 * Main app component that renders the appropriate view based on state
 */
const MainApp = memo(() => {
  const { currentView, isAuthenticated } = useAppState();

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (response.success) {
        window.location.reload();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login failed:', err);
      return false;
    }
  };

  const handleRegister = async (email: string, password: string) => {
    try {
      const response = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, username: email }),
      });
      if (response.success) {
        return handleLogin(email, password);
      }
      return false;
    } catch (err) {
      console.error('Registration failed:', err);
      return false;
    }
  };

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
     return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div id="main-app" className="main-app">
      <div className="sidebar-backdrop" id="sidebar-backdrop" />
      <Sidebar />
      <main className="main-content">
        {renderContent()}
      </main>
      <ToastContainer />
      <ShortcutsPopup />
      <OnboardingTour />
    </div>
  );
});

MainApp.displayName = 'MainApp';

/**
 * Root app component with initialization logic
 */
const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load theme from localStorage
        const savedTheme = localStorage.getItem('anchormarks_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Check authentication
        try {
          const response = await api('/auth/me');
          if (response.user) {
            setIsAuthenticated(true);
          }
        } catch (err) {
          console.log('Not authenticated');
        }

        setIsInitialized(true);

          console.log('App initialized');
      } catch (err) {
          console.error('Failed to initialize app', err);
      }
    };

    initializeApp();

  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const runTourCheck = async () => {
      try {
        const { checkWelcomeTour } = await import('@features/bookmarks/tour.ts');
        checkWelcomeTour();
      } catch (err) {
        console.error('Failed to run welcome tour check', err);
      }
    };

    runTourCheck();
  }, [isAuthenticated]);

  if (!isInitialized) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
      <AppProvider initialState={{ isAuthenticated }}>
      <MainApp />
    </AppProvider>
  );
};

export default App;
