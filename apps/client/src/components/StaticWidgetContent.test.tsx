import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "../test-utils";
import { StaticWidgetContent } from "./StaticWidgetContent.tsx";

describe("StaticWidgetContent", () => {
  it("renders each metric label and value", () => {
    renderWithProviders(
      <StaticWidgetContent
        data={{ "Total Bookmarks": 42, Favorites: 7, Archived: 3 }}
      />,
    );

    expect(screen.getByText("Total Bookmarks")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders empty text when no metrics are present", () => {
    renderWithProviders(
      <StaticWidgetContent data={{}} emptyLabel="Nothing to show" />,
    );

    expect(screen.getByText("Nothing to show")).toBeTruthy();
  });
});
