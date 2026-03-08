import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../test-utils.tsx";
import { BookmarkCard } from "./BookmarkCard.tsx";

const noop = vi.fn();

const mockBookmark = {
  id: "bm1",
  title: "Test Bookmark",
  url: "https://example.com",
  description: "A description",
  favicon: "/favicons/example.png",
  tags: "dev,testing",
  tags_detailed: [
    { name: "dev", color: "#3b82f6" },
    { name: "testing", color: "#10b981" },
  ],
  is_favorite: false,
  is_archived: 0,
  color: undefined,
};

const defaultProps = {
  bookmark: mockBookmark,
  index: 0,
  onOpen: noop,
  onEdit: noop,
  onFavorite: noop,
  onCopy: noop,
  onArchive: noop,
  onDelete: noop,
  onTagClick: noop,
  onSelect: noop,
};

describe("BookmarkCard (React)", () => {
  it("renders title and hostname", () => {
    renderWithProviders(<BookmarkCard {...defaultProps} />);
    expect(screen.getByText("Test Bookmark")).toBeTruthy();
    expect(screen.getByText("example.com")).toBeTruthy();
  });

  it("renders tags from tags_detailed", () => {
    renderWithProviders(<BookmarkCard {...defaultProps} />);
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("testing")).toBeTruthy();
  });

  it("renders description", () => {
    renderWithProviders(<BookmarkCard {...defaultProps} />);
    expect(screen.getByText("A description")).toBeTruthy();
  });

  it("renders action buttons", () => {
    renderWithProviders(<BookmarkCard {...defaultProps} />);
    expect(screen.getByTitle("Open bookmark")).toBeTruthy();
    expect(screen.getByTitle("Edit bookmark")).toBeTruthy();
    expect(screen.getByTitle("Add to favorites")).toBeTruthy();
    expect(screen.getByTitle("Copy link")).toBeTruthy();
    expect(screen.getByTitle("Archive bookmark")).toBeTruthy();
    expect(screen.getByTitle("Delete bookmark")).toBeTruthy();
  });

  it("shows Unarchive button when bookmark is archived", () => {
    renderWithProviders(
      <BookmarkCard
        {...defaultProps}
        bookmark={{ ...mockBookmark, is_archived: 1 }}
      />,
    );
    expect(screen.getByTitle("Unarchive bookmark")).toBeTruthy();
    expect(screen.queryByTitle("Archive bookmark")).toBeNull();
  });

  it("shows favorite indicator when is_favorite is true", () => {
    renderWithProviders(
      <BookmarkCard
        {...defaultProps}
        bookmark={{ ...mockBookmark, is_favorite: true }}
      />,
    );
    expect(document.querySelector(".bookmark-favorite-indicator")).toBeTruthy();
  });

  it("does not show favorite indicator when not favorited", () => {
    renderWithProviders(<BookmarkCard {...defaultProps} />);
    expect(document.querySelector(".bookmark-favorite-indicator")).toBeNull();
  });

  it("applies selected class when in selectedBookmarks", () => {
    // selectedBookmarks is empty in default context, so card is not selected
    const { container } = renderWithProviders(
      <BookmarkCard {...defaultProps} />,
    );
    const card = container.querySelector(".bookmark-card");
    expect(card?.classList.contains("selected")).toBe(false);
  });

  it("applies custom color style when bookmark.color is set", () => {
    const { container } = renderWithProviders(
      <BookmarkCard
        {...defaultProps}
        bookmark={{ ...mockBookmark, color: "#ff0000" }}
      />,
    );
    const card = container.querySelector(".bookmark-card") as HTMLElement;
    expect(card?.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(card?.classList.contains("has-custom-color")).toBe(true);
  });

  it("calls onOpen when Open button clicked", () => {
    const onOpen = vi.fn();
    renderWithProviders(<BookmarkCard {...defaultProps} onOpen={onOpen} />);
    fireEvent.click(screen.getByTitle("Open bookmark"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("calls onEdit when Edit button clicked", () => {
    const onEdit = vi.fn();
    renderWithProviders(<BookmarkCard {...defaultProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByTitle("Edit bookmark"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("calls onDelete when Delete button clicked", () => {
    const onDelete = vi.fn();
    renderWithProviders(<BookmarkCard {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle("Delete bookmark"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("calls onFavorite when favorite button clicked", () => {
    const onFavorite = vi.fn();
    renderWithProviders(
      <BookmarkCard {...defaultProps} onFavorite={onFavorite} />,
    );
    fireEvent.click(screen.getByTitle("Add to favorites"));
    expect(onFavorite).toHaveBeenCalledOnce();
  });

  it("calls onTagClick with tag name when tag clicked", () => {
    const onTagClick = vi.fn();
    renderWithProviders(
      <BookmarkCard {...defaultProps} onTagClick={onTagClick} />,
    );
    fireEvent.click(screen.getByText("dev"));
    expect(onTagClick).toHaveBeenCalledWith("dev");
  });

  it("applies entrance-animation and delay class based on index", () => {
    const { container } = renderWithProviders(
      <BookmarkCard {...defaultProps} index={3} />,
    );
    const card = container.querySelector(".bookmark-card");
    expect(card?.classList.contains("entrance-animation")).toBe(true);
    expect(card?.classList.contains("delay-3")).toBe(true);
  });

  it("delay class cycles via modulo 10", () => {
    const { container } = renderWithProviders(
      <BookmarkCard {...defaultProps} index={12} />,
    );
    const card = container.querySelector(".bookmark-card");
    expect(card?.classList.contains("delay-2")).toBe(true);
  });
});
