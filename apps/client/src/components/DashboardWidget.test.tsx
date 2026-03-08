import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test-utils";
import { DashboardWidget } from "./DashboardWidget.tsx";
import type { DashboardWidget as DashboardWidgetType } from "../types/index";

const baseWidget: DashboardWidgetType = {
  id: "widget-1",
  type: "stats",
  title: "Overview",
  config: {},
  x: 12,
  y: 24,
  w: 360,
  h: 280,
};

describe("DashboardWidget", () => {
  it("renders widget metadata and style attributes", () => {
    renderWithProviders(
      <DashboardWidget
        widget={baseWidget}
        widgetIndex={0}
        isEditing={false}
        linkedWidgetId="widget-1"
        metrics={{ Bookmarks: 10 }}
      />,
    );

    const article = screen.getByTestId("dashboard-widget");
    expect(article.getAttribute("data-widget-id")).toBe("widget-1");
    expect(article.getAttribute("data-widget-type")).toBe("stats");
    expect((article as HTMLElement).style.left).toBe("12px");
    expect((article as HTMLElement).style.top).toBe("24px");
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Bookmarks")).toBeTruthy();
  });

  it("calls callbacks in edit mode", () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();

    renderWithProviders(
      <DashboardWidget
        widget={baseWidget}
        widgetIndex={0}
        isEditing={true}
        linkedWidgetId="widget-1"
        onEdit={onEdit}
        onRemove={onRemove}
        metrics={{ Bookmarks: 10 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit widget" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove widget" }));

    expect(onEdit).toHaveBeenCalledWith("widget-1");
    expect(onRemove).toHaveBeenCalledWith("widget-1");
  });
});
