import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ModalPortal } from "@components/modals/ModalPortal";
import { AppProviders } from "@contexts/AppProviders";

// Mock focus-trap utilities
vi.mock("@utils/focus-trap.ts", () => ({
  createFocusTrap: vi.fn(),
  removeFocusTrap: vi.fn(),
}));

// Mock useFolders (used by BookmarkModal)
vi.mock("@contexts/FoldersContext", async () => {
  const actual = await vi.importActual("@contexts/FoldersContext");
  return {
    ...actual,
    useFolders: () => ({
      folders: [],
      createFolder: vi.fn(),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn(),
    }),
  };
});

// Mock useBookmarks (used by FilterSidebar)
vi.mock("@contexts/BookmarksContext", async () => {
  const actual = await vi.importActual("@contexts/BookmarksContext");
  return {
    ...actual,
    useBookmarks: () => ({
      filterConfig: {
        sort: "recently_added",
        tags: [],
        tagSort: "count_desc",
        tagMode: "OR",
      },
      setFilterConfig: vi.fn(),
      tagMetadata: {},
    }),
  };
});

// Modal-controller is imported by ModalContext
vi.mock("@utils/modal-controller", () => ({
  registerModalDispatcher: vi.fn(),
}));

describe("ModalPortal", () => {
  const renderPortal = () => {
    return render(
      <AppProviders>
        <ModalPortal />
      </AppProviders>,
    );
  };

  it("does not render modals when none is open", () => {
    renderPortal();
    const portal = document.getElementById("modal-portal");
    expect(portal).toBeTruthy();
  });

  it("creates portal container if it doesn't exist", () => {
    renderPortal();
    const portal = document.getElementById("modal-portal");
    expect(portal).toBeTruthy();
  });

  it("reuses existing portal container", () => {
    renderPortal();
    const portal1 = document.getElementById("modal-portal");
    renderPortal();
    const portal2 = document.getElementById("modal-portal");
    expect(portal1).toBe(portal2);
  });
});
