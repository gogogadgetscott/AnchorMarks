import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Omnibar } from "./Omnibar.tsx";
import type { Command } from "../types/index";

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// ─── Context mocks ────────────────────────────────────────────────────────────

const filterConfigMock = {
  sort: "recently_added",
  tags: [],
  tagSort: "count_desc",
  tagMode: "OR" as const,
  search: undefined as string | undefined,
};

const loadBookmarksMock = vi.fn(() => Promise.resolve());
const setFilterConfigMock = vi.fn();

vi.mock("@contexts/BookmarksContext", () => ({
  useBookmarks: () => ({
    filterConfig: filterConfigMock,
    setFilterConfig: setFilterConfigMock,
    loadBookmarks: loadBookmarksMock,
  }),
}));

vi.mock("@contexts/UIContext", () => ({
  useUI: () => ({
    currentView: "all",
    setCurrentView: vi.fn(() => Promise.resolve()),
    setCurrentFolder: vi.fn(),
  }),
}));

// ─── Other module mocks ───────────────────────────────────────────────────────

function defaultCommandsForQuery(query?: string): Command[] {
  if (!query) return [];
  return [
    {
      label: "Test Bookmark",
      description: "https://example.com",
      icon: "🔗",
      favicon: "/favicon.png",
      category: "bookmark",
      action: vi.fn(),
    },
  ];
}

vi.mock("@features/bookmarks/commands.ts", () => ({
  getOmnibarCommands: vi.fn(defaultCommandsForQuery),
  getAllBookmarks: vi.fn(() => []),
  refreshOmnibarBookmarks: vi.fn(),
}));

vi.mock("@features/state.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@features/state.ts")>();
  return {
    ...actual,
    currentView: "all",
    setFilterConfig: vi.fn(),
    setCurrentView: vi.fn(),
    setCurrentFolder: vi.fn(),
  };
});

vi.mock("@utils/index.ts", () => ({
  safeLocalStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  escapeHtml: (s: string) => s,
  escapeHtmlAttr: (s: string) => s,
  getHostname: (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  },
  getBaseUrl: (url: string) => url,
  parseTagInput: vi.fn(),
}));

vi.mock("@features/bookmarks/filters.ts", () => ({
  applyFilters: vi.fn(() => Promise.resolve()),
  updateFilterButtonText: vi.fn(),
}));

vi.mock("@features/bookmarks/search.ts", () => ({
  renderActiveFilters: vi.fn(),
  sidebarFilterTag: vi.fn(() => Promise.resolve()),
}));

vi.mock("@features/bookmarks/bookmarks.ts", () => ({
  loadBookmarks: vi.fn(),
}));

vi.mock("@utils/ui-helpers.ts", () => ({
  openModal: vi.fn(),
  updateActiveNav: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  loadBookmarksMock.mockClear();
  setFilterConfigMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openOmnibar() {
  const input = screen.getByRole("combobox");
  await act(async () => {
    fireEvent.focus(input);
  });
  return input;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Omnibar (search reload)", () => {
  it("reloads bookmarks with the search filter after typing", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);
    const input = await openOmnibar();

    await user.type(input, "react");

    // The debounced reload should fire and carry the search term so the
    // server-side FTS search actually updates the bookmark grid.
    await waitFor(
      () => {
        const withSearch = loadBookmarksMock.mock.calls.filter(
          (c) =>
            (c[0] as { filterOverride?: { search?: string } })?.filterOverride
              ?.search === "react",
        );
        expect(withSearch.length).toBeGreaterThan(0);
      },
      { timeout: 2000 },
    );

    const arg = loadBookmarksMock.mock.calls[0][0] as {
      view?: string;
      filterOverride?: { search?: string };
    };
    expect(arg?.view).toBe("all");
  });

  it("reloads bookmarks with no search when the query is cleared", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);
    const input = (await openOmnibar()) as HTMLInputElement;

    await user.type(input, "react");
    await waitFor(
      () => {
        const withSearch = loadBookmarksMock.mock.calls.filter(
          (c) =>
            (c[0] as { filterOverride?: { search?: string } })?.filterOverride
              ?.search === "react",
        );
        expect(withSearch.length).toBeGreaterThan(0);
      },
      { timeout: 2000 },
    );
    loadBookmarksMock.mockClear();

    await user.clear(input);
    await waitFor(
      () => {
        const cleared = loadBookmarksMock.mock.calls.filter(
          (c) =>
            (c[0] as { filterOverride?: { search?: string } })?.filterOverride
              ?.search === undefined,
        );
        expect(cleared.length).toBeGreaterThan(0);
      },
      { timeout: 2000 },
    );
  });
});
