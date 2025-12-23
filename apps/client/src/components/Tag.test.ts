// tests for Tag component
import { describe, it, expect } from "vitest";
import { Tag, TagChip } from "./Tag";

describe("Tag", () => {
  it("renders tag with name", () => {
    const html = Tag("test-tag");
    expect(html).toContain("test-tag");
    expect(html).toContain("tag");
  });

  it("applies custom color", () => {
    const html = Tag("colored", { color: "#ff0000" });
    expect(html).toContain("--tag-color: #ff0000");
  });

  it("adds data attributes", () => {
    const html = Tag("data-tag", { data: { action: "filter", value: "123" } });
    expect(html).toContain('data-action="filter"');
    expect(html).toContain('data-value="123"');
  });

  it("sets cursor style based on clickable", () => {
    const clickable = Tag("click", { clickable: true });
    const notClickable = Tag("no-click", { clickable: false });
    expect(clickable).toContain("cursor: pointer");
    expect(notClickable).toContain("cursor: default");
  });
});

describe("TagChip", () => {
  it("renders tag chip with name", () => {
    const html = TagChip("chip-tag");
    expect(html).toContain("chip-tag");
    expect(html).toContain("filter-chip");
  });

  it("applies active class when active", () => {
    const html = TagChip("active-tag", { active: true });
    expect(html).toContain("active");
  });

  it("includes remove button", () => {
    const html = TagChip("removable");
    expect(html).toContain("remove-filter");
  });
});
