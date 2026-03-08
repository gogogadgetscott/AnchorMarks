import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Icon } from "./Icon.tsx";

describe("Icon component", () => {
  it("renders an svg element", () => {
    const { container } = render(<Icon name="plus" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("includes the proper child elements for a known icon", () => {
    const { container } = render(<Icon name="search" />);
    // search icon has a circle and a path
    const circle = container.querySelector("circle");
    const path = container.querySelector("path");
    expect(circle).toBeTruthy();
    expect(path).toBeTruthy();
  });

  it("applies custom className and strokeWidth", () => {
    const { container } = render(
      <Icon name="close" className="foo" strokeWidth={4} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    if (svg) {
      expect(svg.classList.contains("foo")).toBe(true);
      expect(svg.getAttribute("stroke-width")).toBe("4");
    }
  });
});
