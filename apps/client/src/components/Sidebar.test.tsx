import React from "react";
import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { renderWithProviders } from "../test-utils.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { AppProviders } from "../contexts/AppProviders";
import { useUI } from "../contexts/UIContext";

vi.mock("@features/bookmarks/settings.ts", () => ({
  toggleSidebar: vi.fn(),
  saveSettings: vi.fn(),
  toggleSection: vi.fn(),
}));
vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  renderSkeletons: vi.fn(),
  loadBookmarks: vi.fn(() => Promise.resolve()),
}));
vi.mock("@features/bookmarks/dashboard.ts", () => ({
  renderDashboard: vi.fn(),
}));
vi.mock("@features/analytics.ts", () => ({
  renderAnalytics: vi.fn(() => Promise.resolve()),
}));
vi.mock("@utils/ui-helpers.ts", () => ({
  openModal: vi.fn(),
  updateActiveNav: vi.fn(),
  closeModals: vi.fn(),
}));

/** Renders Sidebar and exposes the currentView from context */
function SidebarWithViewReader({
  onViewChange,
}: {
  onViewChange?: (view: string) => void;
}) {
  const { currentView } = useUI();
  React.useEffect(() => {
    onViewChange?.(currentView);
  }, [currentView, onViewChange]);
  return <Sidebar />;
}

describe("Sidebar (React)", () => {
  it("renders the logo", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByAltText("AnchorMarks Logo")).toBeTruthy();
  });

  it("renders the Add Bookmark button", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByTitle("Add Bookmark")).toBeTruthy();
  });

  it("renders all nav items", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Bookmarks")).toBeTruthy();
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.getByText("Recent")).toBeTruthy();
    expect(screen.getByText("Most Used")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
    expect(screen.getByText("Tag Cloud")).toBeTruthy();
    expect(screen.getByText("Analytics")).toBeTruthy();
  });

  it("marks the active nav item based on currentView (default: dashboard)", () => {
    const { container } = renderWithProviders(<Sidebar />);
    const activeItems = container.querySelectorAll(".nav-item.active");
    expect(activeItems.length).toBe(1);
    const activeItem = activeItems[0] as HTMLElement;
    expect(activeItem.dataset.view).toBe("dashboard");
  });

  it("updates active item when currentView changes", async () => {
    function SetViewWrapper() {
      const { setCurrentView } = useUI();
      React.useEffect(() => {
        setCurrentView("favorites");
      }, [setCurrentView]);
      return <Sidebar />;
    }

    const { container } = render(
      <AppProviders>
        <SetViewWrapper />
      </AppProviders>,
    );

    // Wait for context update to propagate
    await waitFor(() => {
      const activeItem = container.querySelector(
        ".nav-item.active",
      ) as HTMLElement;
      expect(activeItem?.dataset.view).toBe("favorites");
    });
  });

  it("calls setCurrentView when a nav item is clicked", async () => {
    let capturedView = "dashboard";

    const { container } = render(
      <AppProviders>
        <SidebarWithViewReader
          onViewChange={(v) => {
            capturedView = v;
          }}
        />
      </AppProviders>,
    );

    const bookmarksItem = container.querySelector(
      '[data-view="all"]',
    ) as HTMLElement;
    await act(async () => {
      fireEvent.click(bookmarksItem);
    });

    expect(capturedView).toBe("all");
  });

  it("renders Help & Docs footer link", () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByTitle("Help & Documentation")).toBeTruthy();
  });

  it("renders stats bar", () => {
    const { container } = renderWithProviders(<Sidebar />);
    expect(container.querySelector(".stats-bar")).toBeTruthy();
    expect(container.querySelector("#stat-bookmarks")).toBeTruthy();
    expect(container.querySelector("#stat-folders")).toBeTruthy();
    expect(container.querySelector("#stat-tags")).toBeTruthy();
  });

  it("renders badge count placeholders for nav items that have them", () => {
    const { container } = renderWithProviders(<Sidebar />);
    expect(container.querySelector("#bookmark-count")).toBeTruthy();
    expect(container.querySelector("#fav-count")).toBeTruthy();
    expect(container.querySelector("#count-recent")).toBeTruthy();
    expect(container.querySelector("#count-archived")).toBeTruthy();
  });
});
