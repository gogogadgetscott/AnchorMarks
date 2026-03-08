import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderWithProviders } from "../test-utils.tsx";
import { Header } from "./Header.tsx";
import { AppProviders } from "../contexts/AppProviders";
import { useUI } from "../contexts/UIContext";

// Mock dynamic imports used by Header and Omnibar
vi.mock("@features/bookmarks/settings.ts", () => ({
  toggleSidebar: vi.fn(),
  saveSettings: vi.fn(),
  toggleSection: vi.fn(),
}));
vi.mock("@utils/ui-helpers.ts", () => ({
  openModal: vi.fn(),
  updateActiveNav: vi.fn(),
  closeModals: vi.fn(),
}));
vi.mock("@features/auth/auth.ts", () => ({ logout: vi.fn() }));
vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  clearSelection: vi.fn(),
  selectAllBookmarks: vi.fn(),
  renderBookmarks: vi.fn(),
  renderSkeletons: vi.fn(),
  loadBookmarks: vi.fn(),
}));
vi.mock("@features/bookmarks/commands.ts", () => ({
  getOmnibarCommands: vi.fn(() => []),
  getAllBookmarks: vi.fn(() => []),
}));
vi.mock("@features/bookmarks/search.ts", () => ({
  sidebarFilterTag: vi.fn(),
  renderActiveFilters: vi.fn(),
}));
vi.mock("@features/bookmarks/filters.ts", () => ({
  applyFilters: vi.fn(),
  updateFilterButtonText: vi.fn(),
}));
vi.mock("@utils/index.ts", () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));
vi.mock("@features/state.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@features/state.ts")>();
  return {
    ...actual,
    currentView: "all",
    filterConfig: {
      sort: "recently_added",
      tags: [],
      tagSort: "count_desc",
      tagMode: "OR",
    },
    setFilterConfig: vi.fn(),
    setCurrentView: vi.fn(),
    setCurrentFolder: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };
});

/** Helper that sets currentView in context then renders Header */
function HeaderInView({ view }: { view: string }) {
  const { setCurrentView } = useUI();
  React.useEffect(() => {
    setCurrentView(view);
  }, [view, setCurrentView]);
  return <Header />;
}

function renderWithView(view: string) {
  return render(
    <AppProviders>
      <HeaderInView view={view} />
    </AppProviders>,
  );
}

describe("Header (React)", () => {
  it("renders a banner landmark", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("banner")).toBeTruthy();
  });

  it("renders the view title from viewToolbarConfig (dashboard)", () => {
    renderWithProviders(<Header />);
    // Default UIContext view is "dashboard" → title "Dashboard"
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Dashboard",
    );
  });

  it("renders the sidebar toggle button with accessible attributes", () => {
    renderWithProviders(<Header />);
    const btn = screen.getByTitle("Toggle Sidebar");
    expect(btn.getAttribute("aria-label")).toBe("Toggle sidebar");
    expect(btn.hasAttribute("aria-expanded")).toBe(true);
  });

  it("renders UserProfile avatar button", () => {
    renderWithProviders(<Header />);
    expect(document.querySelector(".header-user-avatar-btn")).toBeTruthy();
  });

  it("renders Omnibar in the header center", () => {
    renderWithProviders(<Header />);
    expect(document.querySelector(".omnibar-container")).toBeTruthy();
  });

  it("hides ViewToggle when showViewToggle is false (dashboard view)", () => {
    renderWithProviders(<Header />);
    expect(document.querySelector(".view-toggle")).toBeNull();
  });

  it("shows ViewToggle when showViewToggle is true (all view)", async () => {
    const { container } = renderWithView("all");
    // Wait for useEffect to set the view
    await act(async () => {});
    expect(container.querySelector(".view-toggle")).toBeTruthy();
  });

  it("shows filter button for all view (showFilters: true)", async () => {
    renderWithView("all");
    await act(async () => {});
    expect(document.querySelector("#filter-dropdown-btn")).toBeTruthy();
  });

  it("hides filter button for dashboard view (showFilters falsy)", () => {
    renderWithProviders(<Header />);
    expect(document.querySelector("#filter-dropdown-btn")).toBeNull();
  });

  it("shows ViewTitle for favorites view", async () => {
    renderWithView("favorites");
    await act(async () => {});
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Favorites",
    );
  });

  it("shows normal UI (no selection) by default", () => {
    const { container } = renderWithProviders(<Header />);
    expect(container.querySelector(".header-normal-ui")).toBeTruthy();
    expect(container.querySelector(".header-selection-ui")).toBeNull();
  });

  it("renders header id based on current view", () => {
    renderWithProviders(<Header />);
    expect(document.querySelector("#dashboard-header")).toBeTruthy();
  });
});
