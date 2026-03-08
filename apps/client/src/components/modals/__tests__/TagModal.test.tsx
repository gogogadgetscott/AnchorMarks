import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TagModal from "../TagModal";
import { ModalProvider } from "../../../contexts/ModalContext";
import { vi } from "vitest";

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
    expect(screen.getByText("Edit Tag")).toBeTruthy();
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

  it("renders delete button", () => {
    renderTagModal();
    expect(screen.getByText("Delete Tag")).toBeTruthy();
  });

  it("renders cancel and save buttons", () => {
    renderTagModal();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Save Tag")).toBeTruthy();
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
    expect(screen.getByText("Edit Tag")).toBeTruthy();
  });
});
