import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { App } from "../App";

const appMocks = vi.hoisted(() => ({
  isAuthenticated: true,
  currentView: "all",
  checkAuth: vi.fn(),
  loadBookmarks: vi.fn().mockResolvedValue(undefined),
  loadFolders: vi.fn().mockResolvedValue(undefined),
  setIsInitialLoad: vi.fn(),
  loadSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: appMocks.isAuthenticated,
    checkAuth: appMocks.checkAuth,
  }),
}));

vi.mock("../contexts/BookmarksContext", () => ({
  useBookmarks: () => ({
    loadBookmarks: appMocks.loadBookmarks,
  }),
}));

vi.mock("../contexts/FoldersContext", () => ({
  useFolders: () => ({
    loadFolders: appMocks.loadFolders,
  }),
}));

vi.mock("../contexts/UIContext", () => ({
  useUI: () => ({
    setIsInitialLoad: appMocks.setIsInitialLoad,
    currentView: appMocks.currentView,
  }),
}));

vi.mock("../hooks/useSettings", () => ({
  useSettings: () => ({
    loadSettings: appMocks.loadSettings,
  }),
}));

vi.mock("../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => undefined,
}));

vi.mock("../AppShell", () => ({
  AppShell: () => <div>AppShell</div>,
}));

describe("App initialization loading behavior", () => {
  beforeEach(() => {
    appMocks.isAuthenticated = true;
    appMocks.currentView = "all";
    appMocks.checkAuth.mockClear();
    appMocks.loadBookmarks.mockClear();
    appMocks.loadFolders.mockClear();
    appMocks.setIsInitialLoad.mockClear();
    appMocks.loadSettings.mockClear();
  });

  it("loads bookmarks once after startup initialization", async () => {
    render(<App />);

    await waitFor(() => {
      expect(appMocks.checkAuth).toHaveBeenCalledTimes(1);
      expect(appMocks.loadSettings).toHaveBeenCalledTimes(1);
      expect(appMocks.loadFolders).toHaveBeenCalledTimes(1);
      expect(appMocks.loadBookmarks).toHaveBeenCalledTimes(1);
    });

    expect(appMocks.loadBookmarks).toHaveBeenCalledWith({ view: "all" });
  });

  it("reloads bookmarks when view changes after initialization", async () => {
    const { rerender } = render(<App />);

    await waitFor(() => {
      expect(appMocks.loadBookmarks).toHaveBeenCalledTimes(1);
    });

    appMocks.currentView = "favorites";
    rerender(<App />);

    await waitFor(() => {
      expect(appMocks.loadBookmarks).toHaveBeenCalledTimes(2);
    });

    expect(appMocks.loadBookmarks).toHaveBeenLastCalledWith({
      view: "favorites",
    });
  });
});
