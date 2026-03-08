import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewToggle } from "./ViewToggle.tsx";

describe("ViewToggle (React)", () => {
  it("renders all three mode buttons by default", () => {
    render(<ViewToggle />);
    expect(screen.getByTitle("Grid View")).toBeTruthy();
    expect(screen.getByTitle("List View")).toBeTruthy();
    expect(screen.getByTitle("Compact List")).toBeTruthy();
  });

  it("marks active mode button with active class", () => {
    render(<ViewToggle activeMode="list" />);
    const listBtn = screen.getByTitle("List View");
    expect(listBtn.classList.contains("active")).toBe(true);
    expect(screen.getByTitle("Grid View").classList.contains("active")).toBe(
      false,
    );
  });

  it("renders only provided modes", () => {
    render(<ViewToggle modes={["compact"]} />);
    expect(screen.getByTitle("Compact List")).toBeTruthy();
    expect(screen.queryByTitle("Grid View")).toBeNull();
    expect(screen.queryByTitle("List View")).toBeNull();
  });

  it("calls onModeChange with correct mode when button clicked", () => {
    const onModeChange = vi.fn();
    render(<ViewToggle activeMode="grid" onModeChange={onModeChange} />);
    fireEvent.click(screen.getByTitle("List View"));
    expect(onModeChange).toHaveBeenCalledWith("list");
  });

  it("sets data-view-mode attribute on each button", () => {
    render(<ViewToggle />);
    expect(screen.getByTitle("Grid View").getAttribute("data-view-mode")).toBe(
      "grid",
    );
    expect(screen.getByTitle("List View").getAttribute("data-view-mode")).toBe(
      "list",
    );
    expect(
      screen.getByTitle("Compact List").getAttribute("data-view-mode"),
    ).toBe("compact");
  });

  it("renders icon SVG inside each button", () => {
    const { container } = render(<ViewToggle />);
    const buttons = container.querySelectorAll(".view-btn");
    buttons.forEach((btn) => {
      expect(btn.querySelector("svg")).toBeTruthy();
    });
  });
});
