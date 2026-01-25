import { describe, it, expect } from "vitest";
import { SkeletonCard } from "./SkeletonCard";

describe("SkeletonCard", () => {
  it("renders skeleton placeholders for bookmark card", () => {
    const html = SkeletonCard();

    expect(html).toContain("skeleton-card");
    expect(html).toContain("skeleton-title");
    expect(html).toContain("skeleton-url");
    expect(html).toContain("bookmark-actions");
  });
});
