import { describe, it, expect } from "vitest";
import { Header } from "./Header";
import * as state from "@features/state.ts";

describe("Header", () => {
  it("renders default header with view toggle and profile", () => {
    state.setViewMode("list");

    const html = Header({ id: "bookmarks-header", title: "Bookmarks" });

    expect(html).toContain('id="bookmarks-header"');
    expect(html).toContain("<h1>Bookmarks</h1>");
    expect(html).toContain("view-toggle");
    expect(html).toContain("header-user-avatar-btn");
  });

  it("respects optional sections and custom content", () => {
    const html = Header({
      id: "collections-header",
      title: "Collections",
      showFilterButton: true,
      showViewToggle: false,
      showUserProfile: false,
      rightContent: '<span class="custom-right">Right</span>',
      centerContent: '<div class="custom-center">Center</div>',
    });

    expect(html).toContain("filter-dropdown-btn");
    expect(html).toContain("custom-right");
    expect(html).toContain("custom-center");
    expect(html).not.toContain("view-toggle");
    expect(html).not.toContain("header-user-avatar-btn");
  });
});
