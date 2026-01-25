import { describe, it, expect, beforeEach } from "vitest";
import {
  executeActiveItem,
  _testSetCurrentItems,
  _testSetActiveIndex,
  _testSetOpen,
  _testGetState,
} from "../omnibar";

describe("Omnibar keyboard behavior for views", () => {
  beforeEach(() => {
    _testSetCurrentItems([]);
    _testSetActiveIndex(0);
    _testSetOpen(false);
  });

  it("keeps omnibar open after executing a view item via keyboard", () => {
    let called = false;
    _testSetCurrentItems([
      {
        type: "result",
        label: "View1",
        action: () => (called = true),
        category: "view",
      },
    ]);
    _testSetActiveIndex(0);
    _testSetOpen(true);

    executeActiveItem();

    expect(called).toBe(true);
    expect(_testGetState().isOpen).toBe(true);
  });

  it("closes omnibar after executing a non-view item via keyboard", () => {
    let called = false;
    _testSetCurrentItems([
      {
        type: "result",
        label: "BM1",
        action: () => (called = true),
        category: "bookmark",
      },
    ]);
    _testSetActiveIndex(0);
    _testSetOpen(true);

    executeActiveItem();

    expect(called).toBe(true);
    expect(_testGetState().isOpen).toBe(false);
  });
});
