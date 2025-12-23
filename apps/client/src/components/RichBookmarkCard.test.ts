// tests for RichBookmarkCard component
import { describe, it, expect } from "vitest";
import { RichBookmarkCard } from "./RichBookmarkCard";
import { setViewMode, setHideFavicons } from "@features/state.ts";
import * as state from "@features/state.ts";

setViewMode("grid");
setHideFavicons(false);
state.selectedBookmarks.clear();

const mockBookmark = {
  id: "rich1",
  title: "Rich Card Test",
  url: "https://example.com",
  description: "A rich description",
  favicon: "/favicons/example.png",
  og_image: "https://example.com/image.jpg",
  tags: "dev,testing",
  tags_detailed: [],
  folder_id: undefined,
  is_favorite: false,
  is_archived: false,
};

describe("RichBookmarkCard", () => {
  it("renders with og_image", () => {
    const html = RichBookmarkCard(mockBookmark, 0);
    expect(html).toContain("Rich Card Test");
    expect(html).toContain("rich-bookmark-card");
    expect(html).toContain(mockBookmark.og_image);
  });

  it("renders placeholder when no og_image", () => {
    const noImage = { ...mockBookmark, og_image: undefined };
    const html = RichBookmarkCard(noImage, 0);
    expect(html).toContain("rich-card-image-placeholder");
  });

  it("includes description when present", () => {
    const html = RichBookmarkCard(mockBookmark, 0);
    expect(html).toContain("A rich description");
  });
});
