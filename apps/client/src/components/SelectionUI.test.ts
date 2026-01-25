import { describe, it, expect } from "vitest";
import { SelectionUI } from "./SelectionUI";

// Smoke tests for SelectionUI markup generation

describe("SelectionUI", () => {
  it("renders default bulk action buttons and selection controls", () => {
    const html = SelectionUI();

    expect(html).toContain("btn-clear-selection");
    expect(html).toContain("header-selection-count");
    expect(html).toContain("0 selected");

    // default actions
    expect(html).toContain("btn-bulk-archive");
    expect(html).toContain("btn-bulk-move");
    expect(html).toContain("btn-bulk-tag");
    expect(html).toContain("btn-bulk-delete");
  });

  it("respects custom actions and element ids", () => {
    const html = SelectionUI({
      actions: ["unarchive", "tag"],
      selectionCountId: "selection-count",
      clearBtnId: "clear-selection",
    });

    expect(html).toContain('id="clear-selection"');
    expect(html).toContain('id="selection-count"');
    expect(html).toContain("btn-bulk-unarchive");
    expect(html).toContain("btn-bulk-tag");
    expect(html).not.toContain("btn-bulk-archive");
  });
});
