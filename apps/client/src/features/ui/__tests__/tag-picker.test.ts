import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@utils/logger.ts", () => {
  const mockFn = vi.fn();
  return {
    logger: {
      debug: mockFn,
      info: mockFn,
      warn: mockFn,
      error: mockFn,
    },
    logDebug: mockFn,
    logInfo: mockFn,
    logWarn: mockFn,
    logError: mockFn,
  };
});

import { TagPickerDialog } from "../confirm-dialog";
import * as state from "@features/state";

function buildSkeleton() {
  document.body.innerHTML = `
    <div id="bulk-tag-picker-modal" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="tag-picker-title"></h2>
          <p class="tag-picker-subtitle"></p>
          <button class="tag-picker-cancel-x"></button>
        </div>
        <div class="modal-body">
          <div id="bulk-tags-input-container">
            <div id="bulk-selected-tags"></div>
            <input id="bulk-tags-text-input" />
            <div id="bulk-tag-autocomplete"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="tag-picker-cancel"></button>
          <button class="tag-picker-ok"></button>
        </div>
      </div>
    </div>
  `;
}

describe("TagPickerDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    (TagPickerDialog as any).instance = undefined;
    state.setTagMetadata({
      alpha: { color: "#111", count: 2 },
      foo: { color: "#222", count: 1 },
      bar: { color: "#333", count: 3 },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
    (TagPickerDialog as any).instance = undefined;
    state.setTagMetadata({});
  });

  it("initializes modal and renders provided tags", async () => {
    buildSkeleton();
    const dialog = TagPickerDialog.getInstance();
    const promise = dialog.show({ initialTags: ["alpha"], selectionCount: 3 });

    vi.runAllTimers();

    const selected = document.querySelector("#bulk-selected-tags")?.textContent;
    expect(selected).toContain("alpha");
    expect(document.querySelector(".tag-picker-subtitle")?.textContent).toBe(
      "3 bookmarks selected",
    );

    document.querySelector<HTMLElement>(".tag-picker-ok")?.click();
    await expect(promise).resolves.toEqual(["alpha"]);
  });

  it("adds new tags via keyboard and returns them", async () => {
    buildSkeleton();
    const dialog = TagPickerDialog.getInstance();
    const promise = dialog.show();

    const input = document.querySelector<HTMLInputElement>(
      "#bulk-tags-text-input",
    );
    input!.value = "foo";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    input!.value = "bar";
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: ",", bubbles: true }),
    );

    document.querySelector<HTMLElement>(".tag-picker-ok")?.click();

    await expect(promise).resolves.toEqual(["foo", "bar"]);
  });

  it("supports tag removal via backspace", async () => {
    buildSkeleton();
    const dialog = TagPickerDialog.getInstance();
    const promise = dialog.show({ initialTags: ["foo", "bar"] });

    const input = document.querySelector<HTMLInputElement>(
      "#bulk-tags-text-input",
    );
    input!.value = "";
    input?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }),
    );

    document.querySelector<HTMLElement>(".tag-picker-ok")?.click();

    await expect(promise).resolves.toEqual(["foo"]);
  });

  it("cancels when backdrop is clicked", async () => {
    buildSkeleton();
    const dialog = TagPickerDialog.getInstance();
    const promise = dialog.show();

    document.querySelector<HTMLElement>(".modal-backdrop")?.click();

    await expect(promise).resolves.toBeNull();
  });
});
