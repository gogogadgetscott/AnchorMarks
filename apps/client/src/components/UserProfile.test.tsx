import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserProfile } from "./UserProfile.tsx";

describe("UserProfile (React)", () => {
  it("renders default name and plan", () => {
    render(<UserProfile />);
    expect(screen.getByText("User")).toBeTruthy();
    expect(screen.getByText("Free Plan")).toBeTruthy();
  });

  it("renders custom name, avatarChar, and plan", () => {
    render(<UserProfile name="Ada Lovelace" avatarChar="A" plan="Pro" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    // avatarChar appears in avatar divs
    const avatarEls = document.querySelectorAll(".user-avatar");
    const hasA = Array.from(avatarEls).some((el) => el.textContent === "A");
    expect(hasA).toBe(true);
  });

  it("applies additional className to container", () => {
    const { container } = render(<UserProfile className="extra-class" />);
    expect(container.querySelector(".extra-class")).toBeTruthy();
  });

  it("calls onToggleDropdown when avatar button clicked", () => {
    const onToggleDropdown = vi.fn();
    render(<UserProfile onToggleDropdown={onToggleDropdown} />);
    fireEvent.click(document.querySelector(".user-avatar-btn")!);
    expect(onToggleDropdown).toHaveBeenCalledOnce();
  });

  it("calls onOpenSettings when Settings clicked", () => {
    const onOpenSettings = vi.fn();
    render(<UserProfile onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByText("Settings"));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it("calls onLogout when Logout clicked", () => {
    const onLogout = vi.fn();
    render(<UserProfile onLogout={onLogout} />);
    fireEvent.click(screen.getByText("Logout"));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("renders settings and logout buttons", () => {
    render(<UserProfile />);
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Logout")).toBeTruthy();
  });
});
