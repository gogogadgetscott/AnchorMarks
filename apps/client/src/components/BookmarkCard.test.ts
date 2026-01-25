// tests for BookmarkCard component
import { describe, it, expect } from "vitest";
import { BookmarkCard } from "./BookmarkCard";
import * as state from "@features/state.ts";

// Mock state needed for rendering
import { setViewMode, setHideFavicons } from "@features/state.ts";
setViewMode("grid");
setHideFavicons(false);
// Ensure selectedBookmarks is empty (default)
state.selectedBookmarks.clear();
// tagMetadata is read‑only; no need to assign for this test

const mockBookmark = {
  id: "bm1",
  title: "Test Bookmark",
  url: "https://example.com",
  description: "A description",
  favicon: "/favicons/example.png",
  tags: "dev,testing",
  tags_detailed: [],
  folder_id: undefined,
  color: "#ff0000",
  is_favorite: false,
  is_archived: false,
};

describe("BookmarkCard", () => {
  it("renders basic structure with title and url", () => {
    const html = BookmarkCard(mockBookmark, 0);
    expect(html).toContain("Test Bookmark");
    expect(html).toContain("https://example.com");
    expect(html).toContain("bookmark-card");
  });

  it("includes favicon when not hidden", () => {
    const html = BookmarkCard(mockBookmark, 0);
    expect(html).toContain(mockBookmark.favicon);
  });

  it("applies custom background color", () => {
    const html = BookmarkCard(mockBookmark, 0);
    expect(html).toContain("background-color: #ff0000");
  });

  it("in list view: columns and order (title -> tags -> description -> url)", () => {
    setViewMode("list");
    const html = BookmarkCard(mockBookmark, 0);

    const titleIndex = html.indexOf('<div class=\"bookmark-title\">');
    const tagsIndex = html.indexOf('<div class=\"bookmark-tags\">');
    const descIndex = html.indexOf('<div class=\"bookmark-description\">');
    const urlIndex = html.indexOf('<div class=\"bookmark-url\"');

    expect(titleIndex).toBeGreaterThan(-1);
    expect(tagsIndex).toBeGreaterThan(titleIndex);
    expect(descIndex).toBeGreaterThan(tagsIndex);
    expect(urlIndex).toBeGreaterThan(descIndex);

    // wrappers should exist
    expect(html).toContain("bookmark-title-tags");
    expect(html).toContain("bookmark-desc-url");

    // restore viewMode for other tests
    setViewMode("grid");
  });
});
