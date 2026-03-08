import { describe, it, expect, vi, afterEach } from "vitest";
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

// ─── Module mocks ─────────────────────────────────────────────────────────────

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
    {
      label: "Add bookmark",
      description: "Create a new bookmark",
      icon: "➕",
      category: "command",
      action: vi.fn(),
    },
  ];
}

vi.mock("@features/bookmarks/commands.ts", () => ({
  getOmnibarCommands: vi.fn(defaultCommandsForQuery),
  getAllBookmarks: vi.fn(() => [
    { id: "1", title: "One", url: "https://a.com", tags: "react,dev" },
    { id: "2", title: "Two", url: "https://b.com", tags: "react,test" },
  ]),
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

describe("Omnibar (React)", () => {
  it("renders input with default id and placeholder", () => {
    render(<Omnibar />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.id).toBe("search-input");
    expect(input.placeholder).toBe("Search or type > for commands...");
  });

  it("renders custom id, placeholder, and shortcut", () => {
    render(<Omnibar id="cmdk" placeholder="Type here..." shortcut="Ctrl+P" />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.id).toBe("cmdk");
    expect(input.placeholder).toBe("Type here...");
    expect(screen.getByText("Ctrl+P")).toBeTruthy();
  });

  it("omits dropdown panel when showDropdown=false", () => {
    render(<Omnibar showDropdown={false} />);
    expect(document.getElementById("omnibar-panel")).toBeNull();
  });

  it("panel is hidden by default", () => {
    render(<Omnibar />);
    expect(
      document.getElementById("omnibar-panel")?.classList.contains("hidden"),
    ).toBe(true);
  });

  it("opens panel on focus", async () => {
    render(<Omnibar />);
    const input = await openOmnibar();
    expect(
      document.getElementById("omnibar-panel")?.classList.contains("hidden"),
    ).toBe(false);
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes panel on blur after delay", async () => {
    render(<Omnibar />);
    await openOmnibar();

    await act(async () => {
      fireEvent.blur(screen.getByRole("combobox"));
    });

    await waitFor(
      () => {
        expect(
          document
            .getElementById("omnibar-panel")
            ?.classList.contains("hidden"),
        ).toBe(true);
      },
      { timeout: 500 },
    );
  });

  it("shows quick actions when open with no query", async () => {
    render(<Omnibar />);
    await openOmnibar();
    expect(screen.getByText("Quick Actions")).toBeTruthy();
    expect(screen.getByText("Add bookmark")).toBeTruthy();
    expect(screen.getByText("View favorites")).toBeTruthy();
  });

  it("shows suggested tags from bookmarks when open", async () => {
    render(<Omnibar />);
    await openOmnibar();
    await waitFor(() => {
      expect(screen.getByText("Suggested Tags")).toBeTruthy();
      // "react" appears in both mock bookmarks — top suggested tag
      expect(screen.getByText("react")).toBeTruthy();
    });
  });

  it("shows results when query is typed", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);
    const input = await openOmnibar();

    await user.type(input, "react");

    await waitFor(() => {
      expect(screen.getByText("Test Bookmark")).toBeTruthy();
      expect(screen.queryByText("Quick Actions")).toBeNull();
    });
  });

  it("shows empty state when no results match", async () => {
    const { getOmnibarCommands } =
      await import("@features/bookmarks/commands.ts");
    vi.mocked(getOmnibarCommands).mockImplementation(() => []);

    const user = userEvent.setup();
    render(<Omnibar />);
    const input = await openOmnibar();

    await user.type(input, "zzznomatch");

    await waitFor(() => {
      expect(screen.getByText("No results found")).toBeTruthy();
    });

    vi.mocked(getOmnibarCommands).mockImplementation(defaultCommandsForQuery);
  });

  it("navigates results with arrow keys", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);
    const input = await openOmnibar();

    await user.type(input, "test");

    await waitFor(() =>
      expect(screen.queryByText("Test Bookmark")).toBeTruthy(),
    );

    const items = () => document.querySelectorAll(".omnibar-item:not(.empty)");

    expect(items()[0]?.classList.contains("active")).toBe(true);

    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(items()[1]?.classList.contains("active")).toBe(true),
    );

    await user.keyboard("{ArrowUp}");
    await waitFor(() =>
      expect(items()[0]?.classList.contains("active")).toBe(true),
    );
  });

  it("does not navigate above index 0", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);
    const input = await openOmnibar();
    await user.type(input, "test");
    await waitFor(() =>
      expect(screen.queryByText("Test Bookmark")).toBeTruthy(),
    );

    await user.keyboard("{ArrowUp}");
    await waitFor(() =>
      expect(
        document
          .querySelectorAll(".omnibar-item:not(.empty)")[0]
          ?.classList.contains("active"),
      ).toBe(true),
    );
  });

  it("executes active item and closes on Enter", async () => {
    const { getOmnibarCommands } =
      await import("@features/bookmarks/commands.ts");
    const mockAction = vi.fn();
    vi.mocked(getOmnibarCommands).mockReturnValue([
      { label: "Go somewhere", category: "command", action: mockAction },
    ]);

    const user = userEvent.setup();
    render(<Omnibar />);
    const input = await openOmnibar();

    await user.type(input, "go");
    await waitFor(() =>
      expect(screen.queryByText("Go somewhere")).toBeTruthy(),
    );

    await user.keyboard("{Enter}");

    expect(mockAction).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        document.getElementById("omnibar-panel")?.classList.contains("hidden"),
      ).toBe(true),
    );
  });

  it("clears query and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Omnibar />);
    const input = (await openOmnibar()) as HTMLInputElement;

    await user.type(input, "hello");
    await user.keyboard("{Escape}");

    expect(input.value).toBe("");
    await waitFor(() =>
      expect(
        document.getElementById("omnibar-panel")?.classList.contains("hidden"),
      ).toBe(true),
    );
  });

  it("renders keyboard tips footer when open", async () => {
    render(<Omnibar />);
    await openOmnibar();
    expect(screen.getByText("commands")).toBeTruthy();
    expect(screen.getByText("navigate")).toBeTruthy();
    expect(screen.getByText("select")).toBeTruthy();
  });
});
