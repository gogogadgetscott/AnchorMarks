import { describe, it, expect } from "vitest";
import { Omnibar } from "./Omnibar";

describe("Omnibar", () => {
  it("renders input with default dropdown sections", () => {
    const html = Omnibar();

    expect(html).toContain('id="search-input"');
    expect(html).toContain("Search or type > for commands...");
    expect(html).toContain("omnibar-panel");
    expect(html).toContain("Recent Searches");
    expect(html).toContain("Suggested Tags");
    expect(html).toContain("Quick Actions");
  });

  it("omits dropdown when disabled", () => {
    const html = Omnibar({
      id: "cmdk",
      showDropdown: false,
      shortcut: "Ctrl+P",
    });

    expect(html).toContain('id="cmdk"');
    expect(html).toContain("Ctrl+P");
    expect(html).not.toContain("omnibar-panel");
  });
});
