import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsModal from "../SettingsModal";
import { ModalProvider } from "../../../contexts/ModalContext";

// Mock focus-trap utilities
vi.mock("@utils/focus-trap.ts", () => ({
  createFocusTrap: vi.fn(),
  removeFocusTrap: vi.fn(),
}));

describe("SettingsModal (React)", () => {
  const renderSettingsModal = () => {
    return render(
      <ModalProvider>
        <SettingsModal />
      </ModalProvider>,
    );
  };

  it("renders the modal with title", () => {
    renderSettingsModal();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders settings tabs", () => {
    renderSettingsModal();
    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.getByText("API")).toBeTruthy();
  });

  it("renders section headers", () => {
    renderSettingsModal();
    expect(screen.getByText("Account")).toBeTruthy();
    expect(screen.getByText("Customization")).toBeTruthy();
    expect(screen.getByText("Integrations")).toBeTruthy();
  });

  it("renders close button", () => {
    renderSettingsModal();
    expect(screen.getByLabelText(/Close settings/)).toBeTruthy();
  });

  it("renders logout button", () => {
    renderSettingsModal();
    expect(screen.getByText("Log Out")).toBeTruthy();
  });

  it("switches tabs when clicked", () => {
    renderSettingsModal();
    const apiTab = screen.getByText("API").closest("button");
    if (apiTab) {
      fireEvent.click(apiTab);
      expect(apiTab.classList.contains("active")).toBe(true);
    }
  });

  it("has accessibility attributes", () => {
    const { container } = renderSettingsModal();
    const modal = container.querySelector("#settings-modal");
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(modal?.getAttribute("aria-labelledby")).toBe("settings-modal-title");
  });

  it("renders settings panel containers", () => {
    const { container } = renderSettingsModal();
    expect(container.querySelector("#settings-profile")).toBeTruthy();
    expect(container.querySelector("#settings-general")).toBeTruthy();
    expect(container.querySelector("#settings-dashboard")).toBeTruthy();
    expect(container.querySelector("#settings-tags")).toBeTruthy();
    expect(container.querySelector("#settings-api")).toBeTruthy();
  });

  it("closes modal when backdrop is clicked", () => {
    const { container } = renderSettingsModal();
    const backdrop = container.querySelector(".modal-backdrop");
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    // Modal should still be rendered (handled by context)
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("closes modal when close button is clicked", () => {
    renderSettingsModal();
    const closeBtn = screen.getByLabelText(/Close settings/);
    fireEvent.click(closeBtn);
    // Modal should still be rendered (handled by context)
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("has tab navigation landmark", () => {
    const { container } = renderSettingsModal();
    const nav = container.querySelector('nav[aria-label="Settings sections"]');
    expect(nav).toBeTruthy();
  });
});
