import { describe, it, expect, beforeEach } from "vitest";
import { Tag } from "@components/Tag.ts";
import * as state from "@features/state.ts";

describe("Tag Click Integration", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    state.setFilterConfig({
      tags: [],
      sort: "recently_added",
      search: undefined,
      tagMode: "OR",
      tagSort: "",
    });
  });

  it("generates tag with correct data attributes", () => {
    const html = Tag("test-tag", {
      color: "#ff0000",
      data: { action: "toggle-filter-tag", tag: "test-tag" },
    });

    expect(html).toContain('data-action="toggle-filter-tag"');
    expect(html).toContain('data-tag="test-tag"');
    expect(html).toContain("test-tag");
  });

  it("escapes special characters in tag names", () => {
    const html = Tag('test"tag', {
      data: { action: "toggle-filter-tag", tag: 'test"tag' },
    });

    // Should escape quotes in attributes
    expect(html).toContain('data-tag="test&quot;tag"');
    // Should escape quotes in content
    expect(html).toContain("test&quot;tag");
  });

  it("handles ampersands in tag names", () => {
    const html = Tag("test&tag", {
      data: { action: "toggle-filter-tag", tag: "test&tag" },
    });

    expect(html).toContain('data-tag="test&amp;tag"');
    expect(html).toContain("test&amp;tag");
  });

  it("can retrieve tag name from data attribute", () => {
    const html = Tag("my-tag", {
      data: { action: "toggle-filter-tag", tag: "my-tag" },
    });

    document.body.innerHTML = html;
    const tagElement = document.querySelector(".tag") as HTMLElement;

    expect(tagElement).toBeTruthy();
    expect(tagElement.dataset.action).toBe("toggle-filter-tag");
    expect(tagElement.dataset.tag).toBe("my-tag");
    expect(tagElement.getAttribute("data-tag")).toBe("my-tag");
  });

  it("can retrieve tag name with special characters from attribute", () => {
    const html = Tag('test"tag', {
      data: { action: "toggle-filter-tag", tag: 'test"tag' },
    });

    document.body.innerHTML = html;
    const tagElement = document.querySelector(".tag") as HTMLElement;

    expect(tagElement).toBeTruthy();
    // dataset and getAttribute should both return the unescaped value
    expect(tagElement.dataset.tag).toBe('test"tag');
    expect(tagElement.getAttribute("data-tag")).toBe('test"tag');
  });
});
