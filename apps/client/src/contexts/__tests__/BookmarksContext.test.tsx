import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { BookmarksProvider, useBookmarks } from "../BookmarksContext";
import { UIProvider, useUI } from "../UIContext";

vi.mock("@services/api.ts", () => ({
  api: vi.fn(async () => ({ bookmarks: [], total: 0, tags: [] })),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UIProvider>
    <BookmarksProvider>{children}</BookmarksProvider>
  </UIProvider>
);

describe("BookmarksContext folder filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes include_children for folder filter when setting is enabled", async () => {
    const { result } = renderHook(
      () => ({ ui: useUI(), bookmarks: useBookmarks() }),
      { wrapper },
    );

    await act(async () => {
      await result.current.ui.setCurrentView("all");
      result.current.ui.setCurrentFolder("parent-folder");
      result.current.ui.setIncludeChildBookmarks(true);
      result.current.bookmarks.setFilterConfig({
        ...result.current.bookmarks.filterConfig,
        tags: ["alpha"],
        search: "solar",
      });
    });

    const apiModule = await import("@services/api.ts");
    const api = apiModule.api as ReturnType<typeof vi.fn>;
    api.mockClear();

    await act(async () => {
      await result.current.bookmarks.loadBookmarks();
    });

    const calledEndpoint = api.mock.calls
      .map((args: any[]) => args[0] as string)
      .find((endpoint) => endpoint.startsWith("/bookmarks"));

    expect(calledEndpoint).toBeDefined();
    expect(calledEndpoint).toContain("folder_id=parent-folder");
    expect(calledEndpoint).toContain("include_children=true");
    expect(decodeURIComponent(calledEndpoint!)).toContain("tags=alpha");
    expect(decodeURIComponent(calledEndpoint!)).toContain("search=solar");
  });

  it("does not include include_children when setting is disabled", async () => {
    const { result } = renderHook(
      () => ({ ui: useUI(), bookmarks: useBookmarks() }),
      { wrapper },
    );

    await act(async () => {
      await result.current.ui.setCurrentView("all");
      result.current.ui.setCurrentFolder("parent-folder");
      result.current.ui.setIncludeChildBookmarks(false);
    });

    const apiModule = await import("@services/api.ts");
    const api = apiModule.api as ReturnType<typeof vi.fn>;
    api.mockClear();

    await act(async () => {
      await result.current.bookmarks.loadBookmarks();
    });

    const calledEndpoint = api.mock.calls
      .map((args: any[]) => args[0] as string)
      .find((endpoint) => endpoint.startsWith("/bookmarks"));

    expect(calledEndpoint).toBeDefined();
    expect(calledEndpoint).toContain("folder_id=parent-folder");
    expect(calledEndpoint).not.toContain("include_children=true");
  });
});
