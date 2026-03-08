import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test-utils";
import { DashboardGrid } from "./DashboardGrid.tsx";
import type { DashboardWidget, Bookmark } from "../types/index";

const widgets: DashboardWidget[] = [
  {
    id: "w-1",
    type: "folder",
    title: "Frontend",
    config: {},
    x: 0,
    y: 0,
    w: 320,
    h: 260,
  },
  {
    id: "w-2",
    type: "tag",
    title: "Urgent",
    config: {},
    x: 330,
    y: 0,
    w: 320,
    h: 260,
  },
  {
    id: "w-3",
    type: "stats",
    title: "Stats",
    config: {},
    x: 660,
    y: 0,
    w: 320,
    h: 260,
  },
];

const sampleBookmarks: Bookmark[] = [
  {
    id: "b-1",
    title: "AnchorMarks",
    url: "https://anchormarks.com",
    tags: "productivity",
  },
];

describe("DashboardGrid", () => {
  it("renders empty state when no widgets exist", () => {
    renderWithProviders(<DashboardGrid widgets={[]} />);
    expect(screen.getByTestId("dashboard-empty-state")).toBeTruthy();
  });

  it("maps widgets into DashboardWidget components", () => {
    renderWithProviders(
      <DashboardGrid
        widgets={widgets}
        previewBookmarksByWidgetId={{
          "w-1": sampleBookmarks,
          "w-2": sampleBookmarks,
        }}
        metricsByWidgetId={{ "w-3": { Bookmarks: 99, Favorites: 7 } }}
      />,
    );

    expect(screen.getByTestId("dashboard-grid")).toBeTruthy();
    expect(screen.getAllByTestId("dashboard-widget")).toHaveLength(3);
    expect(screen.getByText("Frontend")).toBeTruthy();
    expect(screen.getByText("Urgent")).toBeTruthy();
    expect(screen.getByText("Stats")).toBeTruthy();
    expect(screen.getByText("Bookmarks")).toBeTruthy();
    expect(screen.getAllByText("99").length).toBeGreaterThan(0);
  });

  it("forwards edit/remove events from child widgets", () => {
    const onEditWidget = vi.fn();
    const onRemoveWidget = vi.fn();

    renderWithProviders(
      <DashboardGrid
        widgets={widgets}
        isEditMode={true}
        onEditWidget={onEditWidget}
        onRemoveWidget={onRemoveWidget}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit widget" })[0]);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Remove widget" })[0],
    );

    expect(onEditWidget).toHaveBeenCalledWith("w-1");
    expect(onRemoveWidget).toHaveBeenCalledWith("w-1");
  });
});
