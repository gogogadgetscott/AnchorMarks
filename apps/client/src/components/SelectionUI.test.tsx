import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SelectionUI } from "./SelectionUI.tsx";

afterEach(cleanup);

describe("SelectionUI (React)", () => {
  it("renders the selection count", () => {
    render(<SelectionUI selectionCount={5} />);
    expect(screen.getByText("5 selected")).toBeTruthy();
  });

  it("renders 0 when selectionCount is omitted", () => {
    render(<SelectionUI />);
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("renders default action buttons", () => {
    render(<SelectionUI />);
    expect(screen.getByTitle("Archive Selected")).toBeTruthy();
    expect(screen.getByTitle("Move to Folder")).toBeTruthy();
    expect(screen.getByTitle("Add Tags")).toBeTruthy();
    expect(screen.getByTitle("Delete")).toBeTruthy();
  });

  it("renders only specified actions", () => {
    render(<SelectionUI actions={["delete", "auto-tag"]} />);
    expect(screen.getByTitle("Delete")).toBeTruthy();
    expect(screen.getByTitle("Auto-Tag with AI")).toBeTruthy();
    expect(screen.queryByTitle("Archive Selected")).toBeNull();
  });

  it("calls onClear when clear button clicked", () => {
    const onClear = vi.fn();
    render(<SelectionUI onClear={onClear} />);
    fireEvent.click(screen.getByTitle("Clear Selection"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("calls onSelectAll when Select All clicked", () => {
    const onSelectAll = vi.fn();
    render(<SelectionUI onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByText("Select All"));
    expect(onSelectAll).toHaveBeenCalledOnce();
  });

  it("calls onBulkAction with the action key when action button clicked", () => {
    const onBulkAction = vi.fn();
    render(
      <SelectionUI
        actions={["archive", "delete"]}
        onBulkAction={onBulkAction}
      />,
    );
    fireEvent.click(screen.getByTitle("Archive Selected"));
    expect(onBulkAction).toHaveBeenCalledWith("archive");
    fireEvent.click(screen.getByTitle("Delete"));
    expect(onBulkAction).toHaveBeenCalledWith("delete");
  });

  it("renders all supported actions when explicitly listed", () => {
    render(
      <SelectionUI
        actions={["archive", "unarchive", "move", "tag", "auto-tag", "delete"]}
      />,
    );
    expect(screen.getByTitle("Archive Selected")).toBeTruthy();
    expect(screen.getByTitle("Unarchive Selected")).toBeTruthy();
    expect(screen.getByTitle("Move to Folder")).toBeTruthy();
    expect(screen.getByTitle("Add Tags")).toBeTruthy();
    expect(screen.getByTitle("Auto-Tag with AI")).toBeTruthy();
    expect(screen.getByTitle("Delete")).toBeTruthy();
  });
});
