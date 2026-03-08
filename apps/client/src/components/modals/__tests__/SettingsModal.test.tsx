import { useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SettingsModal from "../SettingsModal";
import { ModalProvider, useModal } from "@/contexts/ModalContext";

vi.mock("@utils/focus-trap.ts", () => ({
  createFocusTrap: vi.fn(),
  removeFocusTrap: vi.fn(),
}));

vi.mock("../settings/ProfileSettings", () => ({
  ProfileSettings: () => <div id="settings-profile">Profile panel</div>,
}));
vi.mock("../settings/GeneralSettings", () => ({
  GeneralSettings: () => <div id="settings-general">General panel</div>,
}));
vi.mock("../settings/TagSettings", () => ({
  TagSettings: () => <div id="settings-tags">Tags panel</div>,
}));
vi.mock("../settings/ApiSettings", () => ({
  ApiSettings: () => <div id="settings-api">API panel</div>,
}));
vi.mock("../settings/ImportExportSettings", () => ({
  ImportExportSettings: () => <div id="settings-import">Import panel</div>,
}));
vi.mock("../settings/MaintenanceSettings", () => ({
  MaintenanceSettings: () => (
    <div id="settings-maintenance">Maintenance panel</div>
  ),
}));
vi.mock("../settings/ShortcutSettings", () => ({
  ShortcutSettings: () => <div id="settings-shortcuts">Shortcuts panel</div>,
}));

function OpenSettingsModalOnMount() {
  const { openSettingsModal } = useModal();
  useEffect(() => {
    openSettingsModal();
  }, [openSettingsModal]);
  return <SettingsModal />;
}

describe("SettingsModal (React)", () => {
  const renderSettingsModal = () => {
    return render(
      <ModalProvider>
        <OpenSettingsModalOnMount />
      </ModalProvider>,
    );
  };

  it("renders the modal with title", () => {
    renderSettingsModal();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders settings tabs", () => {
    const { container } = renderSettingsModal();
    const tabLabels = Array.from(container.querySelectorAll(".tab-label")).map(
      (el) => el.textContent,
    );

    expect(tabLabels).toEqual(
      expect.arrayContaining([
        "Profile",
        "General",
        "Tags",
        "API",
        "Import/Export",
        "Maintenance",
        "Shortcuts",
      ]),
    );
  });

  it("renders section headers", () => {
    const { container } = renderSettingsModal();
    const sectionHeaders = Array.from(
      container.querySelectorAll(".settings-nav-header"),
    ).map((el) => el.textContent);

    expect(sectionHeaders).toEqual(
      expect.arrayContaining(["Account", "App", "Maintenance"]),
    );
  });

  it("renders close button", () => {
    renderSettingsModal();
    expect(screen.getByLabelText(/Close settings/)).toBeTruthy();
  });

  it("switches tabs when clicked", () => {
    renderSettingsModal();
    const apiTab = screen.getByText("API").closest("button");
    if (apiTab) {
      fireEvent.click(apiTab);
      expect(apiTab.classList.contains("active")).toBe(true);
      expect(screen.getByText("API panel")).toBeTruthy();
    }
  });

  it("has accessibility attributes", () => {
    const { container } = renderSettingsModal();
    const modal = container.querySelector("#settings-modal");
    expect(modal?.getAttribute("role")).toBe("dialog");
    expect(modal?.getAttribute("aria-modal")).toBe("true");
    expect(modal?.getAttribute("aria-labelledby")).toBe("settings-modal-title");
  });

  it("renders default panel content", () => {
    renderSettingsModal();
    expect(screen.getByText("General panel")).toBeTruthy();
  });

  it("closes modal when backdrop is clicked", () => {
    const { container } = renderSettingsModal();
    const backdrop = container.querySelector(".modal-backdrop");
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(container.querySelector("#settings-modal")).toBeNull();
  });

  it("closes modal when close button is clicked", () => {
    const { container } = renderSettingsModal();
    const closeBtn = screen.getByLabelText(/Close settings/);
    fireEvent.click(closeBtn);
    expect(container.querySelector("#settings-modal")).toBeNull();
  });

  it("has tab navigation landmark", () => {
    const { container } = renderSettingsModal();
    const nav = container.querySelector('nav[aria-label="Settings sections"]');
    expect(nav).toBeTruthy();
  });
});
