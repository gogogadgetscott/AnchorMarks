import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DuplicateCenter } from "./DuplicateCenter";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  showConfirm: vi.fn(() => Promise.resolve(true)),
  clearViewCache: vi.fn(),
  loadBookmarks: vi.fn(() => Promise.resolve()),
}));

vi.mock("@services/api.ts", () => ({
  api: mocks.api,
}));

vi.mock("@contexts/ConfirmContext", () => ({
  showConfirm: mocks.showConfirm,
}));

vi.mock("@contexts/ToastContext", () => ({
  showToast: vi.fn(),
}));

vi.mock("@contexts/BookmarksContext", () => ({
  useBookmarks: () => ({
    clearViewCache: mocks.clearViewCache,
    loadBookmarks: mocks.loadBookmarks,
  }),
}));

describe("DuplicateCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.api.mockResolvedValue({
      duplicates: [
        {
          canonical_url: "https://example.com/article",
          match_type: "url",
          count: 2,
          bookmarks: [
            {
              id: "bookmark-old",
              title: "Old Article",
              url: "https://example.com/article",
              created_at: "2024-01-01T00:00:00Z",
              tags: ["one"],
            },
            {
              id: "bookmark-new",
              title: "New Article",
              url: "https://www.example.com/article/",
              created_at: "2025-01-01T00:00:00Z",
              tags: ["two"],
            },
          ],
        },
      ],
    });
  });

  it("lists duplicate groups and quick keep actions", async () => {
    render(<DuplicateCenter />);
    await waitFor(() =>
      expect(
        screen.getAllByText("https://example.com/article").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByText("2 bookmarks")).toBeTruthy();
    expect(screen.getByText("Keep Newest")).toBeTruthy();
  });

  it("searches duplicate titles and URLs", async () => {
    render(<DuplicateCenter />);
    await waitFor(() => expect(screen.getByText("Old Article")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Search duplicates"), {
      target: { value: "missing" },
    });
    expect(
      screen.getByText("No duplicate groups match your search."),
    ).toBeTruthy();
  });
});
