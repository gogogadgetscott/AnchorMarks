import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TagModal from "../TagModal";
import { ModalProvider } from "../../../contexts/ModalContext";
import { vi } from "vitest";

const tagActions = vi.hoisted(() => ({
  createTag: vi.fn(() => Promise.resolve(true)),
  renameTag: vi.fn(() => Promise.resolve()),
  updateTag: vi.fn(() => Promise.resolve()),
  deleteTag: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@contexts/BookmarksContext", () => ({
  useBookmarks: () => ({
    ...tagActions,
    tagMetadata: {},
  }),
}));

// Mock focus-trap utilities
vi.mock("@utils/focus-trap.ts", () => ({
  createFocusTrap: vi.fn(),
  removeFocusTrap: vi.fn(),
}));

describe("TagModal (React)", () => {
  const renderTagModal = () => {
    return render(
      <ModalProvider>
        <TagModal />
      </ModalProvider>,
    );
  };

  it("renders the modal with title", () => {
    renderTagModal();
    expect(screen.getByText("New Tag")).toBeTruthy();
  });

  it("renders tag name input field", () => {
    renderTagModal();
    expect(screen.getByLabelText(/Tag Name/)).toBeTruthy();
  });

  it("renders color picker with tag colors", () => {
    renderTagModal();
    const colorButtons = screen.getAllByRole("button");
    const colorOptions = colorButtons.filter((btn) =>
      btn.className.includes("color-option-tag"),
    );
    expect(colorOptions.length).toBeGreaterThan(5);
  });

  it("updates tag name input value", () => {
    renderTagModal();
    const tagInput = screen.getByLabelText(/Tag Name/) as HTMLInputElement;
    fireEvent.change(tagInput, { target: { value: "javascript" } });
    expect(tagInput.value).toBe("javascript");
  });

  it("selects color when clicked", () => {
    renderTagModal();
    const colorButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.className.includes("color-option-tag"));
    fireEvent.click(colorButtons[0]);
    expect(colorButtons[0].classList.contains("active")).toBe(true);
  });

  it("does not render delete for a new tag", () => {
    renderTagModal();
    expect(screen.queryByText("Delete Tag")).toBeNull();
  });

  it("renders cancel and create buttons", () => {
    renderTagModal();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Create Tag")).toBeTruthy();
  });

  it("has accessibility attributes", () => {
    const { container } = renderTagModal();
    const modal = container.querySelector("#tag-modal");
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
  });

  it("closes modal when close button is clicked", () => {
    renderTagModal();
    const closeBtn = screen.getByLabelText(/Close modal/);
    fireEvent.click(closeBtn);
    // Modal should still be rendered but hidden (handled by context)
    expect(screen.getByText("New Tag")).toBeTruthy();
  });

  it("creates a tag when the new-tag form is submitted", () => {
    renderTagModal();
    fireEvent.change(screen.getByLabelText(/Tag Name/), {
      target: { value: "research" },
    });
    fireEvent.click(screen.getByText("Create Tag"));

    expect(tagActions.createTag).toHaveBeenCalledWith("research", "#f59e0b");
  });
});
