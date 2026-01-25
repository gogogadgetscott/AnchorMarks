import { describe, it, expect } from "vitest";
import * as components from "./index";

describe("components index", () => {
  it("re-exports component factories", () => {
    expect(components.Header).toBeInstanceOf(Function);
    expect(components.Omnibar).toBeInstanceOf(Function);
    expect(components.SelectionUI).toBeInstanceOf(Function);
    expect(components.ViewToggle).toBeInstanceOf(Function);
    expect(components.UserProfile).toBeInstanceOf(Function);
    expect(components.SkeletonCard).toBeInstanceOf(Function);
    expect(components.Badge).toBeInstanceOf(Function);
    expect(components.Button).toBeInstanceOf(Function);
    expect(components.BookmarkCard).toBeInstanceOf(Function);
    expect(components.RichBookmarkCard).toBeInstanceOf(Function);
    expect(components.Icon).toBeInstanceOf(Function);
    expect(components.Tag).toBeInstanceOf(Function);
  });
});
