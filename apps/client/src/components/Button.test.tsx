import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button.tsx";

describe("Button (React)", () => {
  it("renders text and primary variant class", () => {
    render(<Button text="Click Me" variant="primary" className="my-btn" />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("btn-primary");
    expect(btn.className).toContain("my-btn");
    expect(screen.getByText("Click Me")).toBeTruthy();
  });

  it("renders icon-only variant with btn-icon class", () => {
    render(<Button variant="icon" icon="star" />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("btn-icon");
    expect(btn.className).not.toContain("btn btn-");
  });

  it("sets data attributes from data prop", () => {
    render(<Button text="Data" data={{ action: "test", id: 123 }} />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-action")).toBe("test");
    expect(btn.getAttribute("data-id")).toBe("123");
  });

  it("sets button type", () => {
    render(<Button text="Submit" type="submit" />);
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("sets title attribute", () => {
    render(<Button text="X" title="Close dialog" />);
    expect(screen.getByRole("button").getAttribute("title")).toBe(
      "Close dialog",
    );
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button text="Go" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders icon SVG when icon prop provided", () => {
    const { container } = render(<Button text="Star" icon="star" />);
    expect(container.querySelector("svg.icon-star")).toBeTruthy();
  });

  it("does not render icon element when icon prop is empty", () => {
    const { container } = render(<Button text="No icon" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
