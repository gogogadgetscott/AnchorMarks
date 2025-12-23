// tests for Button component
import { describe, it, expect } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with text and primary variant", () => {
    const html = Button("Click Me", {
      variant: "primary",
      className: "my-btn",
    });
    expect(html).toContain("Click Me");
    expect(html).toContain("btn btn-primary");
    expect(html).toContain("my-btn");
  });

  it("includes icon when provided", () => {
    const html = Button("", { icon: "star", variant: "icon" });
    expect(html).toContain("star");
  });

  it("adds data attributes correctly", () => {
    const html = Button("Data", { data: { action: "test", id: 123 } });
    expect(html).toContain('data-action="test"');
    expect(html).toContain('data-id="123"');
  });
});
