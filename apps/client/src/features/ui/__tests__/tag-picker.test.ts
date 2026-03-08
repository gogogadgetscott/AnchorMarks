import { beforeEach, describe, expect, it, vi } from "vitest";

const { showTagPickerMock } = vi.hoisted(() => ({
  showTagPickerMock: vi.fn(),
}));

vi.mock("@/contexts/ConfirmContext", () => ({
  showConfirm: vi.fn(),
  showPrompt: vi.fn(),
  showTagPicker: showTagPickerMock,
}));

import { TagPickerDialog, tagPickerDialog } from "../confirm-dialog";

describe("TagPickerDialog bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (TagPickerDialog as any).instance = undefined;
  });

  it("tagPickerDialog delegates to TagPickerDialog singleton", async () => {
    showTagPickerMock.mockResolvedValueOnce(["foo"]);

    await expect(
      tagPickerDialog({
        initialTags: ["foo", "bar"],
        selectionCount: 2,
      }),
    ).resolves.toEqual(["foo"]);

    expect(showTagPickerMock).toHaveBeenCalledWith({
      initialTags: ["foo", "bar"],
      selectionCount: 2,
    });
  });

  it("TagPickerDialog.getInstance returns singleton", () => {
    const first = TagPickerDialog.getInstance();
    const second = TagPickerDialog.getInstance();

    expect(first).toBe(second);
  });

  it("TagPickerDialog.show delegates to showTagPicker", async () => {
    showTagPickerMock.mockResolvedValueOnce(null);

    await expect(
      TagPickerDialog.getInstance().show({
        initialTags: ["alpha"],
      }),
    ).resolves.toBeNull();

    expect(showTagPickerMock).toHaveBeenCalledWith({
      initialTags: ["alpha"],
    });
  });
});
