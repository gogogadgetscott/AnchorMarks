import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagOrganizer } from "./TagOrganizer";

const mocks = vi.hoisted(() => ({
  fetchTagStats: vi.fn(),
  refreshTagData: vi.fn(() => Promise.resolve()),
  openTagModal: vi.fn(),
  tagMetadata: {
    javascript: { id: "tag-1", color: "#f59e0b", count: 3 },
  },
}));

vi.mock("@contexts/BookmarksContext", () => ({
  useBookmarks: () => ({
    fetchTagStats: mocks.fetchTagStats,
    refreshTagData: mocks.refreshTagData,
    tagMetadata: mocks.tagMetadata,
  }),
}));

vi.mock("@utils/modal-controller.ts", () => ({
  openTagModal: mocks.openTagModal,
}));

vi.mock("@contexts/ConfirmContext", () => ({
  showConfirm: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@contexts/ToastContext", () => ({
  showToast: vi.fn(),
}));

describe("TagOrganizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchTagStats.mockResolvedValue([
      { id: "tag-1", name: "javascript", count: 3, color: "#f59e0b" },
      { id: "tag-2", name: "unused", count: 0, color: "#6366f1" },
    ]);
  });

  it("lists tags and filters unused tags", async () => {
    render(<TagOrganizer />);
    await waitFor(() => expect(screen.getByText("javascript")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Unused/ }));

    expect(screen.getByText("unused")).toBeTruthy();
    expect(screen.queryByText("javascript")).toBeNull();
  });

  it("opens the shared modal to create or edit tags", async () => {
    render(<TagOrganizer />);
    await waitFor(() => expect(screen.getByText("javascript")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "New Tag" }));
    expect(mocks.openTagModal).toHaveBeenCalledWith("");

    fireEvent.click(screen.getByRole("button", { name: "Edit javascript" }));
    expect(mocks.openTagModal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tag-1", name: "javascript" }),
    );
  });
});
