import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { render } from "@testing-library/react";
import { BookmarksList } from "./BookmarksList.tsx";
import type { Bookmark } from "../types/index";

afterEach(cleanup);

// Hoisted mutable mock state — tests mutate these before render
const mockBookmarksState = vi.hoisted(() => ({
  bookmarks: [] as Bookmark[],
  filterConfig: {
    sort: "newest",
    tags: [] as string[],
    tagMode: "OR" as const,
    search: "",
  },
  displayedCount: 50,
  totalCount: 0,
  isLoading: false,
  isLoadingMore: false,
  selectedBookmarks: new Set<string>(),
  lastSelectedIndex: null as number | null,
  tagMetadata: {} as Record<string, { color?: string }>,
  setRenderedBookmarks: vi.fn(),
  setDisplayedCount: vi.fn(),
  setIsLoadingMore: vi.fn(),
  setBookmarks: vi.fn(),
  setTotalCount: vi.fn(),
  setSelectedBookmarks: vi.fn(),
  setLastSelectedIndex: vi.fn(),
  setBulkMode: vi.fn(),
  setFilterConfig: vi.fn(),
}));

const mockUIState = vi.hoisted(() => ({
  viewMode: "grid" as string,
  hideFavicons: false,
  richLinkPreviewsEnabled: false,
  currentView: "all" as string,
}));

vi.mock("@/contexts/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/index.ts")>();
  return {
    ...actual,
    useBookmarks: () => mockBookmarksState,
    useUI: () => mockUIState,
    BOOKMARKS_PER_PAGE: 50,
  };
});

vi.mock("@/contexts/useBookmarkActions", () => ({
  useBookmarkActions: () => ({
    archiveBookmark: vi.fn(),
    unarchiveBookmark: vi.fn(),
    deleteBookmark: vi.fn(),
    toggleFavorite: vi.fn(),
    editBookmark: vi.fn(),
  }),
}));

vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  deleteBookmark: vi.fn(),
  archiveBookmark: vi.fn(),
  unarchiveBookmark: vi.fn(),
  toggleFavorite: vi.fn(),
  editBookmark: vi.fn(),
}));

vi.mock("@services/api.ts", () => ({
  api: vi.fn().mockResolvedValue({ bookmarks: [], total: 0 }),
}));

const baseBookmark: Bookmark = {
  id: "b1",
  title: "Bookmark One",
  url: "https://example.com",
  tags: "",
  tags_detailed: [],
  is_favorite: false,
  is_archived: 0,
  favicon: "",
  description: "",
  created_at: "2024-01-01T00:00:00Z",
  click_count: 0,
};

function resetMocks() {
  mockBookmarksState.bookmarks = [];
  mockBookmarksState.filterConfig = {
    sort: "newest",
    tags: [],
    tagMode: "OR",
    search: "",
  };
  mockBookmarksState.displayedCount = 50;
  mockBookmarksState.totalCount = 0;
  mockBookmarksState.isLoading = false;
  mockBookmarksState.isLoadingMore = false;
  mockBookmarksState.selectedBookmarks = new Set();
  mockBookmarksState.lastSelectedIndex = null;
  mockUIState.viewMode = "grid";
  mockUIState.richLinkPreviewsEnabled = false;
  mockUIState.currentView = "all";
}

afterEach(() => {
  resetMocks();
  vi.clearAllMocks();
});

describe("BookmarksList (React)", () => {
  it("shows skeleton cards when isLoading is true", () => {
    mockBookmarksState.isLoading = true;
    const { container } = render(<BookmarksList />);
    const skeletons = container.querySelectorAll(".skeleton-card");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders nothing when no bookmarks and no active filters", () => {
    mockBookmarksState.bookmarks = [];
    const { container } = render(<BookmarksList />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when tags filter active but no results", () => {
    mockBookmarksState.bookmarks = [];
    mockBookmarksState.filterConfig = {
      sort: "newest",
      tags: ["missing-tag"],
      tagMode: "OR",
      search: "",
    };
    const { container } = render(<BookmarksList />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when search active but no results", () => {
    mockBookmarksState.bookmarks = [];
    mockBookmarksState.filterConfig = {
      sort: "newest",
      tags: [],
      tagMode: "OR",
      search: "xyz-no-match",
    };
    const { container } = render(<BookmarksList />);
    expect(container.innerHTML).toBe("");
  });

  it("renders a BookmarkCard for each bookmark", () => {
    mockBookmarksState.bookmarks = [
      { ...baseBookmark, id: "b1", title: "Alpha" },
      { ...baseBookmark, id: "b2", title: "Beta" },
    ];
    mockBookmarksState.totalCount = 2;
    mockUIState.richLinkPreviewsEnabled = false;
    render(<BookmarksList />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("renders RichBookmarkCard when richLinkPreviewsEnabled and grid view", () => {
    mockBookmarksState.bookmarks = [
      { ...baseBookmark, id: "b1", title: "Rich Card" },
    ];
    mockBookmarksState.totalCount = 1;
    mockUIState.richLinkPreviewsEnabled = true;
    mockUIState.viewMode = "grid";
    const { container } = render(<BookmarksList />);
    expect(container.querySelector(".rich-bookmark-card")).toBeTruthy();
    expect(container.querySelector(".bookmark-card")).toBeNull();
  });

  it("renders BookmarkCard when richLinkPreviewsEnabled but list view", () => {
    mockBookmarksState.bookmarks = [
      { ...baseBookmark, id: "b1", title: "List Card" },
    ];
    mockBookmarksState.totalCount = 1;
    mockUIState.richLinkPreviewsEnabled = true;
    mockUIState.viewMode = "list";
    const { container } = render(<BookmarksList />);
    expect(container.querySelector(".bookmark-card")).toBeTruthy();
    expect(container.querySelector(".rich-bookmark-card")).toBeNull();
  });

  it("shows load-more skeletons when isLoadingMore is true", () => {
    mockBookmarksState.bookmarks = [
      { ...baseBookmark, id: "b1", title: "Card One" },
    ];
    mockBookmarksState.totalCount = 1;
    mockBookmarksState.isLoadingMore = true;
    const { container } = render(<BookmarksList />);
    const loadMoreSection = container.querySelector(".load-more-skeletons");
    expect(loadMoreSection).toBeTruthy();
  });

  it("renders the list container with correct viewMode class", () => {
    mockBookmarksState.bookmarks = [
      { ...baseBookmark, id: "b1", title: "Card" },
    ];
    mockBookmarksState.totalCount = 1;
    mockUIState.viewMode = "list";
    const { container } = render(<BookmarksList />);
    const list = container.querySelector(".bookmarks-list");
    expect(list).toBeTruthy();
  });

  it("adds rich-link-previews class to container when enabled in grid mode", () => {
    mockBookmarksState.bookmarks = [
      { ...baseBookmark, id: "b1", title: "Card" },
    ];
    mockBookmarksState.totalCount = 1;
    mockUIState.richLinkPreviewsEnabled = true;
    mockUIState.viewMode = "grid";
    const { container } = render(<BookmarksList />);
    const list = container.querySelector(".bookmarks-grid.rich-link-previews");
    expect(list).toBeTruthy();
  });

  it("filters bookmarks client-side by tag", () => {
    mockBookmarksState.bookmarks = [
      {
        ...baseBookmark,
        id: "b1",
        title: "Tagged",
        tags: "react",
        tags_detailed: [{ name: "react" }],
      },
      { ...baseBookmark, id: "b2", title: "Plain" },
    ];
    mockBookmarksState.totalCount = 2;
    mockBookmarksState.filterConfig = {
      sort: "newest",
      tags: ["react"],
      tagMode: "OR",
      search: "",
    };
    render(<BookmarksList />);
    expect(screen.getByText("Tagged")).toBeTruthy();
    expect(screen.queryByText("Plain")).toBeNull();
  });
});
