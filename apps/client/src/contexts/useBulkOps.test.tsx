import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBulkOps } from "./useBulkOps";

const mocks = vi.hoisted(() => ({
  api: vi.fn(() => Promise.resolve()),
  showTagPicker: vi.fn(),
  loadBookmarks: vi.fn(() => Promise.resolve()),
  clearViewCache: vi.fn(),
  clearSelections: vi.fn(),
}));

vi.mock("@services/api.ts", () => ({
  api: mocks.api,
}));

vi.mock("./ConfirmContext", () => ({
  showConfirm: vi.fn(() => Promise.resolve(true)),
  showTagPicker: mocks.showTagPicker,
}));

vi.mock("./ToastContext", () => ({
  showToast: vi.fn(),
}));

vi.mock("./BookmarksContext", () => ({
  useBookmarks: () => ({
    selectedBookmarks: new Set(["bookmark-1"]),
    bookmarks: [{ id: "bookmark-1", title: "One", url: "https://one.test" }],
    setBookmarks: vi.fn(),
    setSelectedBookmarks: vi.fn(),
    setBulkMode: vi.fn(),
    loadBookmarks: mocks.loadBookmarks,
    clearViewCache: mocks.clearViewCache,
  }),
}));

describe("useBulkOps tag payloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes tags for the bulk-add API contract", async () => {
    mocks.showTagPicker.mockResolvedValue(["javascript", "frontend"]);
    const { result } = renderHook(() => useBulkOps());

    await act(() => result.current.bulkAddTags());

    expect(mocks.api).toHaveBeenCalledWith("/tags/bulk-add", {
      method: "POST",
      body: JSON.stringify({
        bookmark_ids: ["bookmark-1"],
        tags: "javascript,frontend",
      }),
    });
    expect(mocks.loadBookmarks).toHaveBeenCalledOnce();
  });

  it("serializes tags for the bulk-remove API contract", async () => {
    mocks.showTagPicker.mockResolvedValue(["javascript"]);
    const { result } = renderHook(() => useBulkOps());

    await act(() => result.current.bulkRemoveTags());

    expect(mocks.api).toHaveBeenCalledWith("/tags/bulk-remove", {
      method: "POST",
      body: JSON.stringify({
        bookmark_ids: ["bookmark-1"],
        tags: "javascript",
      }),
    });
  });

  it("marks a selection done and archives it in one request", async () => {
    const { result } = renderHook(() => useBulkOps());

    await act(() => result.current.bulkReadingState("done"));

    expect(mocks.api).toHaveBeenCalledWith("/bookmarks/bulk/reading-state", {
      method: "POST",
      body: JSON.stringify({
        ids: ["bookmark-1"],
        reading_state: "done",
        archive: true,
      }),
    });
    expect(mocks.loadBookmarks).toHaveBeenCalledOnce();
  });
});
