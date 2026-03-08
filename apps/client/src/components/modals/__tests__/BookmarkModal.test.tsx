import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import BookmarkModal from "../BookmarkModal";
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

describe("BookmarkModal (React)", () => {
  const renderBookmarkModal = () => {
    return render(
      <ModalProvider>
        <BookmarkModal />
      </ModalProvider>,
    );
  };

  it("renders the modal with correct title for new bookmark", () => {
    renderBookmarkModal();
    expect(screen.getByText("Add Bookmark")).toBeTruthy();
  });

  it("renders all required form fields", () => {
    renderBookmarkModal();
    expect(screen.getByLabelText(/URL/)).toBeTruthy();
    expect(screen.getByLabelText(/Title/)).toBeTruthy();
    expect(screen.getByLabelText(/Description/)).toBeTruthy();
    expect(screen.getByLabelText(/Folder/)).toBeTruthy();
    expect(screen.getByLabelText(/Tags/)).toBeTruthy();
  });

  it("updates URL field value", () => {
    renderBookmarkModal();
    const urlInput = screen.getByLabelText(/URL/) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    expect(urlInput.value).toBe("https://example.com");
  });

  it("renders folder options from context", () => {
    renderBookmarkModal();
    const folderSelect = screen.getByLabelText(/Folder/) as HTMLSelectElement;
    const options = within(folderSelect).getAllByRole("option");
    expect(options).toHaveLength(3); // None + 2 folders
    expect(options[1].textContent).toBe("Folder 1");
    expect(options[2].textContent).toBe("Folder 2");
  });

  it("renders color picker with all colors", () => {
    renderBookmarkModal();
    const colorButtons = document.querySelectorAll(".color-option-bookmark");
    expect(colorButtons.length).toBeGreaterThan(5);
  });

  it("selects color option when clicked", () => {
    renderBookmarkModal();
    const indigoButton = screen.getByTitle("Indigo");
    fireEvent.click(indigoButton);
    expect(indigoButton.classList.contains("active")).toBe(true);
  });

  it("renders close button", () => {
    renderBookmarkModal();
    const closeBtn = screen.getByLabelText(/Close modal/);
    expect(closeBtn).toBeTruthy();
  });

  it("renders cancel and save buttons in footer", () => {
    renderBookmarkModal();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getAllByText("Save Bookmark")).toBeTruthy();
  });

  it("has accessibility attributes", () => {
    const { container } = renderBookmarkModal();
    const modal = container.querySelector("#bookmark-modal");
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(modal?.getAttribute("aria-labelledby")).toBe("bookmark-modal-title");
  });

  it("disables fetch button when URL is empty", () => {
    renderBookmarkModal();
    const fetchButton = screen.getByText(/Fetch Info/) as HTMLButtonElement;
    expect(fetchButton.disabled).toBe(true);
  });

  it("enables fetch button when URL is present", () => {
    renderBookmarkModal();
    const urlInput = screen.getByLabelText(/URL/);
    const fetchButton = screen.getByText(/Fetch Info/) as HTMLButtonElement;

    fireEvent.change(urlInput, { target: { value: "https://example.com" } });
    expect(fetchButton.disabled).toBe(false);
  });
});
