import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { SkeletonCard } from "./SkeletonCard";

describe("SkeletonCard", () => {
  it("renders skeleton placeholders for bookmark card", () => {
    const { container } = render(createElement(SkeletonCard));

    expect(container.querySelector(".skeleton-card")).toBeTruthy();
    expect(container.querySelector(".skeleton-title")).toBeTruthy();
    expect(container.querySelector(".skeleton-url")).toBeTruthy();
    expect(container.querySelector(".bookmark-actions")).toBeTruthy();
  });
});
