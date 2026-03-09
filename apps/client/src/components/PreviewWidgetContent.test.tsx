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

  it("renders all bookmarks", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={bookmarks} />);

    expect(screen.getByText("One")).toBeTruthy();
    expect(screen.getByText("Two")).toBeTruthy();
    expect(screen.getByText("Three")).toBeTruthy();
    expect(screen.getByText("Four")).toBeTruthy();
  });

  it("renders bookmark links with compact styling", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={bookmarks} />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBe(4);
    expect(links[0].getAttribute("href")).toBe("https://one.example");
    expect(links[0].className).toContain("compact-item-link");
  });

  it("shows empty state when no bookmarks are provided", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={[]} />);

    expect(screen.getByText("No bookmarks")).toBeTruthy();
  });

  it("renders edit and favorite buttons for each bookmark", () => {
    renderWithProviders(<PreviewWidgetContent bookmarks={bookmarks.slice(0, 1)} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(2); // Edit and favorite buttons
    expect(buttons[0].getAttribute("title")).toBe("Edit bookmark");
    expect(buttons[1].getAttribute("title")).toBe("Add to favorites");
  });
});
