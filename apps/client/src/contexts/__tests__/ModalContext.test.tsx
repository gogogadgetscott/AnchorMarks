import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ModalProvider, useModal } from "../ModalContext";

describe("ModalContext", () => {
  it("initializes with no modal open", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });
    expect(result.current.openModal).toBe(null);
  });

  it("opens bookmark modal with data", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openBookmarkModal({ url: "https://example.com" });
    });

    expect(result.current.openModal).toBe("bookmark");
    expect(result.current.bookmarkFormData.url).toBe("https://example.com");
  });

  it("opens tag modal with name and color", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openTagModal("javascript", "#6366f1");
    });

    expect(result.current.openModal).toBe("tag");
    expect(result.current.tagFormData.name).toBe("javascript");
    expect(result.current.tagFormData.color).toBe("#6366f1");
  });

  it("opens folder modal with data", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openFolderModal({ name: "My Collection" });
    });

    expect(result.current.openModal).toBe("folder");
    expect(result.current.folderFormData.name).toBe("My Collection");
  });

  it("opens settings modal with optional tab", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openSettingsModal("api");
    });

    expect(result.current.openModal).toBe("settings");
    expect(result.current.settingsActiveTab).toBe("api");
  });

  it("closes modal and clears data", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openBookmarkModal({ url: "https://example.com" });
    });

    expect(result.current.openModal).toBe("bookmark");

    act(() => {
      result.current.closeModal();
    });

    expect(result.current.openModal).toBe(null);
  });

  it("throws error when useModal is called outside ModalProvider", () => {
    expect(() => renderHook(() => useModal())).toThrow(
      "useModal must be used within a ModalProvider",
    );
  });

  it("updates form data without closing modal", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openBookmarkModal({ url: "https://example.com" });
    });

    act(() => {
      result.current.setBookmarkFormData({ title: "Example Site" });
    });

    expect(result.current.openModal).toBe("bookmark");
    expect(result.current.bookmarkFormData.url).toBe("https://example.com");
    expect(result.current.bookmarkFormData.title).toBe("Example Site");
  });

  it("switches settings tabs", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ModalProvider>{children}</ModalProvider>
    );

    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openSettingsModal("general");
    });

    expect(result.current.settingsActiveTab).toBe("general");

    act(() => {
      result.current.setSettingsActiveTab("profile");
    });

    expect(result.current.settingsActiveTab).toBe("profile");
  });
});
