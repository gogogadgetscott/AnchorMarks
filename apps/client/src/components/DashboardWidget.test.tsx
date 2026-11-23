import { describe, it, expect, vi } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test-utils";
import { DashboardWidget } from "./DashboardWidget.tsx";
import type { DashboardWidget as DashboardWidgetType } from "../types/index";

const dndMocks = vi.hoisted(() => ({
  dragPointerDown: vi.fn(),
  setNodeRef: vi.fn(),
}));

vi.mock("@dnd-kit/core", async () => {
  const actual =
    await vi.importActual<typeof import("@dnd-kit/core")>("@dnd-kit/core");

  return {
    ...actual,
    useDraggable: vi.fn(() => ({
      attributes: {},
      listeners: {
        onPointerDown: dndMocks.dragPointerDown,
      },
      setNodeRef: dndMocks.setNodeRef,
      transform: null,
    })),
  };
});

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
  it("starts drag from header text but not from action buttons", () => {
    dndMocks.dragPointerDown.mockClear();

    renderWithProviders(
      <DashboardWidget
        widget={baseWidget}
        widgetIndex={0}
        isEditing={true}
        linkedWidgetId="widget-1"
        metrics={{ Bookmarks: 10 }}
      />,
    );

    fireEvent.pointerDown(screen.getByText("Overview"));
    expect(dndMocks.dragPointerDown).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Remove widget" }),
    );
    expect(dndMocks.dragPointerDown).toHaveBeenCalledTimes(1);
  });

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

  it("forwards edit and favorite actions from bookmark previews", () => {
    const onEditBookmark = vi.fn();
    const onToggleFavoriteBookmark = vi.fn();
    const bookmark = {
      id: "bookmark-1",
      title: "Saved article",
      url: "https://example.com/article",
      is_favorite: false,
    };

    renderWithProviders(
      <DashboardWidget
        widget={{ ...baseWidget, type: "folder", title: "Reading" }}
        widgetIndex={0}
        isEditing={true}
        linkedWidgetId="folder-1"
        previewBookmarks={[bookmark]}
        onEditBookmark={onEditBookmark}
        onToggleFavoriteBookmark={onToggleFavoriteBookmark}
      />,
    );

    fireEvent.click(screen.getByTitle("Edit bookmark"));
    expect(onEditBookmark).toHaveBeenCalledWith(bookmark);

    fireEvent.click(screen.getByTitle("Add to favorites"));
    expect(onToggleFavoriteBookmark).toHaveBeenCalledWith(bookmark);
  });

  it("calls onRemove callback in edit mode", () => {
    const onRemove = vi.fn();

    renderWithProviders(
      <DashboardWidget
        widget={baseWidget}
        widgetIndex={0}
        isEditing={true}
        linkedWidgetId="widget-1"
        onRemove={onRemove}
        metrics={{ Bookmarks: 10 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove widget" }));

    expect(onRemove).toHaveBeenCalledWith("widget-1");
  });

  it("snaps resize operations to the dashboard grid", () => {
    const onResizeWidget = vi.fn();

    renderWithProviders(
      <DashboardWidget
        widget={baseWidget}
        widgetIndex={0}
        isEditing={true}
        linkedWidgetId="widget-1"
        onResizeWidget={onResizeWidget}
        metrics={{ Bookmarks: 10 }}
      />,
    );

    const resizeHandle = document.querySelector(
      ".widget-resize-handle",
    ) as HTMLDivElement | null;

    expect(resizeHandle).toBeTruthy();

    fireEvent.mouseDown(resizeHandle!, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(document, { clientX: 117, clientY: 133 });
    fireEvent.mouseUp(document);

    expect(onResizeWidget).toHaveBeenCalledWith("widget-1", 380, 320);
  });
});
