import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, fireEvent } from "../test-utils";
import { PreviewWidgetContent } from "./PreviewWidgetContent.tsx";
import type { Bookmark } from "../types/index";

const bookmarks: Bookmark[] = [
  {
    id: "1",
    title: "One",
    url: "https://one.example",
    tags: "alpha,beta",
    favicon: "https://one.example/favicon.ico",
  },
  {
    id: "2",
    title: "Two",
    url: "https://two.example",
    tags: "beta",
    favicon: "https://two.example/favicon.ico",
  },
  {
    id: "3",
    title: "Three",
    url: "https://three.example",
    tags: "gamma",
    favicon: "https://three.example/favicon.ico",
  },
  {
    id: "4",
    title: "Four",
    url: "https://four.example",
    tags: "delta",
    favicon: "https://four.example/favicon.ico",
  },
];

describe("PreviewWidgetContent", () => {
  beforeEach(() => {
    vi.stubGlobal("open", vi.fn());
  });

  it("renders at most three bookmarks", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={bookmarks} />);

    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
    expect(screen.getByText("Three")).toBeTruthy();
    expect(screen.queryByText("Four")).toBeNull();
  });

  it("opens a bookmark when the Open action is clicked", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={bookmarks} />);

    const openButtons = screen.getAllByRole("button", { name: "Open" });
    fireEvent.click(openButtons[0]);

    expect(window.open).toHaveBeenCalledWith(
      "https://one.example",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("shows empty state when no bookmarks are provided", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={[]} />);

    expect(screen.getByText("No bookmarks in this widget yet.")).toBeTruthy();
  });
});
