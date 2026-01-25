import { describe, it, expect } from "vitest";
import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  it("marks the active view mode", () => {
    const html = ViewToggle({ activeMode: "list" });

    expect(html).toContain('data-view-mode="list"');
    expect(html).toContain("active");
  });

  it("renders only provided modes", () => {
    const html = ViewToggle({ modes: ["compact"] });

    expect(html).toContain('data-view-mode="compact"');
    expect(html).not.toContain('data-view-mode="grid"');
    expect(html).not.toContain('data-view-mode="list"');
  });
});
