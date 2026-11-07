/**
 * BookmarksContext rate-limit (429) handling.
 *
 * Previously a 429 either surfaced as a generic "Failed to load bookmarks"
 * console error (loadBookmarks) or as a silent stop with a hardcoded 60s
 * string-matched backoff (loadMore). The context now raises a visible toast
 * and honors the server's Retry-After hint.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { BookmarksProvider, useBookmarks } from "./BookmarksContext.tsx";
import { syncUIBridge } from "./context-bridge";
import { api, ApiError } from "../services/api.ts";
import { showToast } from "./ToastContext";
import type { Bookmark } from "../types/index";

vi.mock("./ToastContext", () => ({
  showToast: vi.fn(),
}));

vi.mock("../services/api.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api.ts")>();
  return { ...actual, api: vi.fn() };
});

const apiMock = vi.mocked(api);
const toastMock = vi.mocked(showToast);

const bookmark = (id: string): Bookmark =>
  ({
    id,
    title: `Bookmark ${id}`,
    url: `https://example.com/${id}`,
    description: "",
    tags: [],
    is_favorite: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    click_count: 0,
  }) as unknown as Bookmark;

let ctx: ReturnType<typeof useBookmarks>;

function Capture() {
  ctx = useBookmarks();
  return null;
}

async function renderContext() {
  render(
    <BookmarksProvider>
      <Capture />
    </BookmarksProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  syncUIBridge({
    setCurrentView: () => {},
    currentView: "all",
    currentFolder: null,
    includeChildBookmarks: false,
    getCurrentView: () => "all",
  } as never);
});

describe("BookmarksContext 429 handling", () => {
  it("shows a toast when loadBookmarks is rate limited", async () => {
    apiMock.mockRejectedValue(new ApiError("Rate limit exceeded", 429, "17"));
    await renderContext();

    await act(async () => {
      await ctx.loadBookmarks();
    });

    expect(toastMock).toHaveBeenCalledWith(
      "Rate limited — retrying in a moment",
      "error",
    );
  });

  it("does not toast for ordinary load failures", async () => {
    apiMock.mockRejectedValue(new Error("network down"));
    await renderContext();

    await act(async () => {
      await ctx.loadBookmarks();
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("does not toast for non-429 ApiErrors", async () => {
    apiMock.mockRejectedValue(new ApiError("Server error", 500));
    await renderContext();

    await act(async () => {
      await ctx.loadBookmarks();
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("sends the search term to the server in the query string", async () => {
    // Regression: typing in the search box used to update filter state only,
    // so the server never ran the FTS query and the grid stayed unchanged.
    apiMock.mockResolvedValue({ bookmarks: [bookmark("b1")], total: 1 });
    await renderContext();

    await act(async () => {
      await ctx.loadBookmarks({
        filterOverride: {
          tags: [],
          tagMode: "OR",
          search: "google",
        } as never,
      });
    });

    const url = String(apiMock.mock.calls[0][0]);
    expect(url).toContain("search=google");
  });

  it("pauses loadMore on 429 and refuses to retry during the backoff window", async () => {
    apiMock.mockResolvedValue({
      bookmarks: [bookmark("b1")],
      total: 200,
    });
    await renderContext();

    await act(async () => {
      await ctx.loadBookmarks();
    });
    expect(ctx.totalCount).toBe(200);
    toastMock.mockClear();

    // Now the server starts rate limiting, hinting 17 seconds
    apiMock.mockRejectedValue(new ApiError("Rate limit exceeded", 429, "17"));

    await act(async () => {
      await ctx.loadMoreBookmarks();
    });

    expect(toastMock).toHaveBeenCalledWith(
      "Rate limited — scroll paused briefly",
      "error",
    );

    // Within the backoff window loadMore must not hit the server again,
    // otherwise the client would keep burning its rate-limit budget.
    const callsAfter429 = apiMock.mock.calls.length;
    await act(async () => {
      await ctx.loadMoreBookmarks();
    });
    expect(apiMock.mock.calls.length).toBe(callsAfter429);
  });

  it("still retries loadMore after a non-429 failure (no backoff armed)", async () => {
    apiMock.mockResolvedValue({
      bookmarks: [bookmark("b1")],
      total: 200,
    });
    await renderContext();

    await act(async () => {
      await ctx.loadBookmarks();
    });

    apiMock.mockRejectedValue(new Error("boom"));
    await act(async () => {
      await ctx.loadMoreBookmarks();
    });

    // The failure must not block the next attempt
    apiMock.mockResolvedValue({
      bookmarks: [bookmark("b2")],
      total: 200,
    });
    await act(async () => {
      await ctx.loadMoreBookmarks();
    });

    expect(apiMock.mock.calls.length).toBe(3);
  });
});
