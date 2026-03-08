import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tag, TagChip } from "./Tag.tsx";

describe("Tag (React)", () => {
  it("renders tag name", () => {
    render(<Tag name="react" />);
    expect(screen.getByText("react")).toBeTruthy();
  });

  it("applies tag CSS class", () => {
    const { container } = render(<Tag name="react" />);
    expect(container.querySelector(".tag")).toBeTruthy();
  });

  it("applies custom color via CSS variable", () => {
    const { container } = render(<Tag name="x" color="#ff0000" />);
    const el = container.querySelector(".tag") as HTMLElement;
    expect(el.style.getPropertyValue("--tag-color")).toBe("#ff0000");
  });

  it("sets cursor:pointer when clickable (default)", () => {
    const { container } = render(<Tag name="click" />);
    const el = container.querySelector(".tag") as HTMLElement;
    expect(el.style.cursor).toBe("pointer");
  });

  it("sets cursor:default when not clickable", () => {
    const { container } = render(<Tag name="static" clickable={false} />);
    const el = container.querySelector(".tag") as HTMLElement;
    expect(el.style.cursor).toBe("default");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Tag name="clickable" onClick={onClick} />);
    fireEvent.click(screen.getByText("clickable"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("sets data attributes from data prop", () => {
    const { container } = render(
      <Tag name="x" data={{ action: "filter", tag: "x" }} />,
    );
    const el = container.querySelector(".tag") as HTMLElement;
    expect(el.getAttribute("data-action")).toBe("filter");
    expect(el.getAttribute("data-tag")).toBe("x");
  });

  it("applies additional className", () => {
    const { container } = render(<Tag name="x" className="extra" />);
    expect(container.querySelector(".extra")).toBeTruthy();
  });
});

describe("TagChip (React)", () => {
  it("renders tag name", () => {
    render(<TagChip name="chip" />);
    expect(screen.getByText("chip")).toBeTruthy();
  });

  it("applies filter-chip class", () => {
    const { container } = render(<TagChip name="chip" />);
    expect(container.querySelector(".filter-chip")).toBeTruthy();
  });

  it("applies active class when active=true", () => {
    const { container } = render(<TagChip name="chip" active={true} />);
    expect(container.querySelector(".active")).toBeTruthy();
  });

  it("does not apply active class when active=false", () => {
    const { container } = render(<TagChip name="chip" active={false} />);
    expect(
      container.querySelector(".filter-chip")?.classList.contains("active"),
    ).toBe(false);
  });

  it("renders remove button", () => {
    render(<TagChip name="chip" />);
    expect(
      screen.getByRole("button", { name: "Remove tag filter" }),
    ).toBeTruthy();
  });

  it("calls onRemove when remove button clicked", () => {
    const onRemove = vi.fn();
    render(<TagChip name="chip" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove tag filter" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
