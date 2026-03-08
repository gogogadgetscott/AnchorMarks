import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import { renderWithProviders } from "../test-utils.tsx";
import { RichBookmarkCard } from "./RichBookmarkCard.tsx";

afterEach(cleanup);

const noop = vi.fn();

const mockBookmark = {
  id: "rb1",
  title: "Rich Bookmark",
  url: "https://example.com/article",
  description: "An interesting article",
  favicon: "/favicons/example.png",
  og_image: "https://example.com/og.jpg",
  thumbnail_local: undefined,
  tags: "dev,react",
  tags_detailed: [
    { name: "dev", color: "#3b82f6" },
    { name: "react", color: "#61dafb" },
  ],
  is_favorite: false,
  is_archived: 0,
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

describe("RichBookmarkCard (React)", () => {
  it("renders title and hostname", () => {
    renderWithProviders(<RichBookmarkCard {...defaultProps} />);
    expect(screen.getByText("Rich Bookmark")).toBeTruthy();
    expect(screen.getByText("example.com")).toBeTruthy();
  });

  it("renders description", () => {
    renderWithProviders(<RichBookmarkCard {...defaultProps} />);
    expect(screen.getByText("An interesting article")).toBeTruthy();
  });

  it("renders tags from tags_detailed", () => {
    renderWithProviders(<RichBookmarkCard {...defaultProps} />);
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("react")).toBeTruthy();
  });

  it("renders og_image when available", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard {...defaultProps} />,
    );
    const img = container.querySelector(
      ".rich-card-image img",
    ) as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain("og.jpg");
  });

  it("renders image placeholder when no og_image or thumbnail_local", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard
        {...defaultProps}
        bookmark={{
          ...mockBookmark,
          og_image: undefined,
          thumbnail_local: undefined,
        }}
      />,
    );
    expect(
      container.querySelector(".rich-card-image-placeholder"),
    ).toBeTruthy();
    expect(container.querySelector(".rich-card-image img")).toBeNull();
  });

  it("renders action buttons", () => {
    renderWithProviders(<RichBookmarkCard {...defaultProps} />);
    expect(screen.getByTitle("Open bookmark")).toBeTruthy();
    expect(screen.getByTitle("Edit bookmark")).toBeTruthy();
    expect(screen.getByTitle("Add to favorites")).toBeTruthy();
    expect(screen.getByTitle("Copy link")).toBeTruthy();
    expect(screen.getByTitle("Archive bookmark")).toBeTruthy();
    expect(screen.getByTitle("Delete bookmark")).toBeTruthy();
  });

  it("shows Unarchive button when bookmark is archived", () => {
    renderWithProviders(
      <RichBookmarkCard
        {...defaultProps}
        bookmark={{ ...mockBookmark, is_archived: 1 }}
      />,
    );
    expect(screen.getByTitle("Unarchive bookmark")).toBeTruthy();
    expect(screen.queryByTitle("Archive bookmark")).toBeNull();
  });

  it("shows favorite indicator when is_favorite is true", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard
        {...defaultProps}
        bookmark={{ ...mockBookmark, is_favorite: true }}
      />,
    );
    expect(
      container.querySelector(".bookmark-favorite-indicator"),
    ).toBeTruthy();
  });

  it("does not show favorite indicator when not favorited", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard {...defaultProps} />,
    );
    expect(container.querySelector(".bookmark-favorite-indicator")).toBeNull();
  });

  it("does not apply selected class by default", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard {...defaultProps} />,
    );
    const card = container.querySelector(".rich-bookmark-card");
    expect(card?.classList.contains("selected")).toBe(false);
  });

  it("calls onOpen when Open button clicked", () => {
    const onOpen = vi.fn();
    renderWithProviders(<RichBookmarkCard {...defaultProps} onOpen={onOpen} />);
    fireEvent.click(screen.getByTitle("Open bookmark"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("calls onEdit when Edit button clicked", () => {
    const onEdit = vi.fn();
    renderWithProviders(<RichBookmarkCard {...defaultProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByTitle("Edit bookmark"));
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("calls onDelete when Delete button clicked", () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <RichBookmarkCard {...defaultProps} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByTitle("Delete bookmark"));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("calls onFavorite when favorite button clicked", () => {
    const onFavorite = vi.fn();
    renderWithProviders(
      <RichBookmarkCard {...defaultProps} onFavorite={onFavorite} />,
    );
    fireEvent.click(screen.getByTitle("Add to favorites"));
    expect(onFavorite).toHaveBeenCalledOnce();
  });

  it("calls onTagClick with tag name when tag clicked", () => {
    const onTagClick = vi.fn();
    renderWithProviders(
      <RichBookmarkCard {...defaultProps} onTagClick={onTagClick} />,
    );
    fireEvent.click(screen.getByText("dev"));
    expect(onTagClick).toHaveBeenCalledWith("dev");
  });

  it("applies delay class based on index % 10", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard {...defaultProps} index={3} />,
    );
    const card = container.querySelector(".rich-bookmark-card");
    expect(card?.classList.contains("entrance-animation")).toBe(true);
    expect(card?.classList.contains("delay-3")).toBe(true);
  });

  it("delay class cycles via modulo 10", () => {
    const { container } = renderWithProviders(
      <RichBookmarkCard {...defaultProps} index={12} />,
    );
    const card = container.querySelector(".rich-bookmark-card");
    expect(card?.classList.contains("delay-2")).toBe(true);
  });
});
