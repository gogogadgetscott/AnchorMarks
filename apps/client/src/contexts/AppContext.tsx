import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Bookmark, Folder, Tag, User, FilterConfig, DashboardWidget } from '../types';

interface AppState {
  bookmarks: Bookmark[];
  folders: Folder[];
  tags: Tag[];
  currentUser: User | null;
  currentView: string;
  currentFolder: string | null;
  currentTag: string | null;
  currentCollection: string | null;
  filterConfig: FilterConfig;
  selectedBookmarks: Set<string>;
  viewMode: 'grid' | 'list' | 'compact';
  hideFavicons: boolean;
  aiSuggestionsEnabled: boolean;
  dashboardConfig: DashboardWidget[];
  tagMetadata: Record<string, any>;
  isAuthenticated: boolean;
  searchQuery: string;
}

interface AppContextValue extends AppState {
  setBookmarks: (bookmarks: Bookmark[]) => void;
  setFolders: (folders: Folder[]) => void;
  setTags: (tags: Tag[]) => void;
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: string) => void;
  setCurrentFolder: (folderId: string | null) => void;
  setCurrentTag: (tagName: string | null) => void;
  setCurrentCollection: (collection: string | null) => void;
  setFilterConfig: (config: Partial<FilterConfig>) => void;
  setSelectedBookmarks: (bookmarks: Set<string>) => void;
  setViewMode: (mode: 'grid' | 'list' | 'compact') => void;
  setHideFavicons: (hide: boolean) => void;
  setAiSuggestionsEnabled: (enabled: boolean) => void;
  setDashboardConfig: (config: DashboardWidget[]) => void;
  setTagMetadata: (metadata: Record<string, any>) => void;
  setIsAuthenticated: (isAuth: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleBookmarkSelection: (bookmarkId: string) => void;
  clearSelection: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
  initialState?: Partial<AppState>;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, initialState }) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialState?.bookmarks || []);
  const [folders, setFolders] = useState<Folder[]>(initialState?.folders || []);
  const [tags, setTags] = useState<Tag[]>(initialState?.tags || []);
  const [currentUser, setCurrentUser] = useState<User | null>(initialState?.currentUser || null);
  const [currentView, setCurrentView] = useState<string>(initialState?.currentView || 'bookmarks');
  const [currentFolder, setCurrentFolder] = useState<string | null>(initialState?.currentFolder || null);
  const [currentTag, setCurrentTag] = useState<string | null>(initialState?.currentTag || null);
  const [currentCollection, setCurrentCollection] = useState<string | null>(initialState?.currentCollection || null);
  const [searchQuery, setSearchQuery] = useState<string>(initialState?.searchQuery || '');
  const [filterConfig, setFilterConfigState] = useState<FilterConfig>(initialState?.filterConfig || {
    tags: [],
    sort: 'recently_added',
    tagSort: 'count_desc',
    tagMode: 'AND',
  });
  const [selectedBookmarks, setSelectedBookmarks] = useState<Set<string>>(initialState?.selectedBookmarks || new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>(initialState?.viewMode || 'grid');
  const [hideFavicons, setHideFavicons] = useState(initialState?.hideFavicons || false);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(initialState?.aiSuggestionsEnabled || false);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardWidget[]>(initialState?.dashboardConfig || []);
  const [tagMetadata, setTagMetadata] = useState<Record<string, any>>(initialState?.tagMetadata || {});
  const [isAuthenticated, setIsAuthenticated] = useState(initialState?.isAuthenticated || false);

  const setFilterConfig = useCallback((config: Partial<FilterConfig>) => {
    setFilterConfigState(prev => ({ ...prev, ...config }));
  }, []);

  const toggleBookmarkSelection = useCallback((bookmarkId: string) => {
    setSelectedBookmarks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookmarkId)) {
        newSet.delete(bookmarkId);
      } else {
        newSet.add(bookmarkId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBookmarks(new Set());
  }, []);

  const value: AppContextValue = {
    bookmarks,
    folders,
    tags,
    currentUser,
    currentView,
    currentFolder,
    currentTag,
    currentCollection,
    searchQuery,
    filterConfig,
    selectedBookmarks,
    viewMode,
    hideFavicons,
    aiSuggestionsEnabled,
    dashboardConfig,
    tagMetadata,
    isAuthenticated,
    setBookmarks,
    setFolders,
    setTags,
    setCurrentUser,
    setCurrentView,
    setCurrentFolder,
    setCurrentTag,
    setCurrentCollection,
    setSearchQuery,
    setFilterConfig,
    setSelectedBookmarks,
    setViewMode,
    setHideFavicons,
    setAiSuggestionsEnabled,
    setDashboardConfig,
    setTagMetadata,
    setIsAuthenticated,
    toggleBookmarkSelection,
    clearSelection,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
