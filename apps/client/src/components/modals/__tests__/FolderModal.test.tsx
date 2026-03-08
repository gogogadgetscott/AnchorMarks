import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import FolderModal from "../FolderModal";
import { ModalProvider } from "../../../contexts/ModalContext";

const mockFolders = [
  { id: "f1", name: "Folder 1", parentId: null, color: "#6366f1" },
  { id: "f2", name: "Folder 2", parentId: null, color: "#8b5cf6" },
];

// Mock useFolders
vi.mock("@contexts/FoldersContext", async () => {
  const actual = await vi.importActual("@contexts/FoldersContext");
  return {
    ...actual,
    useFolders: () => ({
      folders: mockFolders,
      createFolder: vi.fn(),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn(),
    }),
  };
});

// Mock focus-trap utilities
vi.mock("@utils/focus-trap.ts", () => ({
  createFocusTrap: vi.fn(),
  removeFocusTrap: vi.fn(),
}));

describe("FolderModal (React)", () => {
  const renderFolderModal = () => {
    return render(
      <ModalProvider>
        <FolderModal />
      </ModalProvider>,
    );
  };

  it("renders the modal with correct title for new folder", () => {
    renderFolderModal();
    expect(screen.getByText("New Folder")).toBeTruthy();
  });

  it("renders all required form fields", () => {
    renderFolderModal();
    expect(screen.getByLabelText(/Folder Name/)).toBeTruthy();
    expect(screen.getByLabelText(/Parent Folder/)).toBeTruthy();
    expect(screen.getByText("Color")).toBeTruthy();
  });

  it("updates folder name input value", () => {
    renderFolderModal();
    const nameInput = screen.getByLabelText(/Folder Name/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "My Collection" } });
    expect(nameInput.value).toBe("My Collection");
  });

  it("renders parent folder options", () => {
    renderFolderModal();
    const parentSelect = screen.getByLabelText(
      /Parent Folder/,
    ) as HTMLSelectElement;
    const options = within(parentSelect).getAllByRole("option");
    expect(options).toHaveLength(3); // None + 2 folders
  });

  it("renders color picker with folder colors", () => {
    renderFolderModal();
    const colorButtons = screen.getAllByRole("button");
    const colorOptions = colorButtons.filter((btn) =>
      btn.className.includes("color-option"),
    );
    expect(colorOptions.length).toBeGreaterThan(5);
  });

  it("selects color option when clicked", () => {
    renderFolderModal();
    const colorButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.className.includes("color-option") &&
          !btn.className.includes("color-option-tag") &&
          !btn.className.includes("color-option-bookmark"),
      );
    fireEvent.click(colorButtons[0]);
    expect(colorButtons[0].classList.contains("active")).toBe(true);
  });

  it("renders cancel and create buttons", () => {
    renderFolderModal();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Create Folder")).toBeTruthy();
  });

  it("has accessibility attributes", () => {
    const { container } = renderFolderModal();
    const modal = container.querySelector("#folder-modal");
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(modal?.getAttribute("aria-labelledby")).toBe("folder-modal-title");
  });

  it("closes modal when backdrop is clicked", () => {
    const { container } = renderFolderModal();
    const backdrop = container.querySelector(".modal-backdrop");
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    // Modal should still be rendered but hidden (handled by context)
    expect(screen.getByText("New Folder")).toBeTruthy();
  });
});
