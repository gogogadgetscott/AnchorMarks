import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@services/api.ts", () => ({
  api: vi.fn(),
}));

vi.mock("@utils/ui-helpers.ts", () => ({
  showToast: vi.fn(),
  closeModals: vi.fn(),
  openModal: vi.fn(),
  updateActiveNav: vi.fn(),
}));

vi.mock("@features/ui/confirm-dialog.ts", () => ({
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("./folders-utils", () => ({
  buildFolderOptionsHTML: vi.fn(() => '<option value="none">None</option>'),
}));

type MockFn = ReturnType<typeof vi.fn>;

let foldersModule: typeof import("../folders.ts");
let state: typeof import("@features/state.ts");
let apiMock: MockFn;
let showToastMock: MockFn;
let closeModalsMock: MockFn;
let confirmDialogMock: MockFn;

beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = `
    <div id="folders-list"></div>
    <select id="bookmark-folder"></select>
    <select id="folder-parent"></select>
    <select id="bulk-move-select"></select>
    <div id="view-title"></div>
  `;
  foldersModule = await import("../folders.ts");
  state = await import("@features/state.ts");

  const apiModule = (await import("@services/api.ts")) as unknown as {
    api: MockFn;
  };
  apiMock = apiModule.api;

  const helpersModule = (await import("@utils/ui-helpers.ts")) as unknown as {
    showToast: MockFn;
    closeModals: MockFn;
  };
  showToastMock = helpersModule.showToast;
  closeModalsMock = helpersModule.closeModals;

  const confirmModule =
    (await import("@features/ui/confirm-dialog.ts")) as unknown as {
      confirmDialog: MockFn;
    };
  confirmDialogMock = confirmModule.confirmDialog;

  state.setFolders([
    { id: "root", name: "Root", bookmark_count: 1 } as any,
    { id: "child", parent_id: "root", name: "Child", bookmark_count: 2 } as any,
  ]);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("folders module", () => {
  it("loads folders from API and updates state", async () => {
    apiMock.mockResolvedValueOnce([
      { id: "new", name: "New", bookmark_count: 0 } as any,
    ]);

    await foldersModule.loadFolders();

    expect(apiMock).toHaveBeenCalledWith("/folders");
    expect(state.folders[0].id).toBe("new");
    expect(document.getElementById("bookmark-folder")?.innerHTML).toContain(
      "option",
    );
  });

  it("creates folder via API and refreshes lists", async () => {
    apiMock.mockResolvedValueOnce({ id: "f2", name: "Second" });

    const result = await foldersModule.createFolder({ name: "Second" });

    expect(result).toEqual({ id: "f2", name: "Second" });
    expect(showToastMock).toHaveBeenCalledWith("Folder created!", "success");
    expect(closeModalsMock).toHaveBeenCalled();
    expect(state.folders.some((f) => f.id === "f2")).toBe(true);
  });

  it("updates folder state on PUT and handles errors", async () => {
    apiMock
      .mockResolvedValueOnce({ id: "root", name: "Root Updated" })
      .mockRejectedValueOnce(new Error("boom"));

    await foldersModule.updateFolder("root", { name: "Root Updated" });
    expect(state.folders.find((f) => f.id === "root")?.name).toBe(
      "Root Updated",
    );

    await foldersModule.updateFolder("missing", { name: "fail" });
    expect(showToastMock).toHaveBeenCalledWith("boom", "error");
  });

  it("confirms before deleting and resets view when deleting current folder", async () => {
    confirmDialogMock.mockResolvedValueOnce(true);
    state.setCurrentFolder("root");
    state.setCurrentView("dashboard");
    apiMock.mockResolvedValueOnce(undefined);

    await foldersModule.deleteFolder("root");
    await vi.waitFor(() => {
      expect(state.currentView).toBe("all");
    });

    expect(confirmDialogMock).toHaveBeenCalled();
    expect(state.currentFolder).toBeNull();
    expect(showToastMock).toHaveBeenCalledWith("Folder deleted", "success");
  });

  it("allows navigating to folder by index", async () => {
    const renderFilters = vi.fn();
    const loadBookmarks = vi.fn();
    vi.doMock("@features/bookmarks/search.ts", () => ({
      renderActiveFilters: renderFilters,
    }));
    vi.doMock("@features/bookmarks/bookmarks.ts", () => ({
      loadBookmarks,
    }));

    await foldersModule.navigateToFolderByIndex(0);

    expect(state.currentFolder).toBe("root");
  });
});
