import { describe, it, expect } from "vitest";
import { buildFolderOptionsHTML } from "../folders-utils";

describe("buildFolderOptionsHTML", () => {
  it("builds nested options and sorts siblings alphabetically", () => {
    const folders = [
      { id: "1", name: "Projects", parent_id: null },
      { id: "2", name: "Personal", parent_id: null },
      { id: "3", name: "Alpha", parent_id: "1" },
      { id: "4", name: "Work", parent_id: "1" },
    ] as any;

    const html = buildFolderOptionsHTML(folders, "— No folder (top level) —");

    const labels = Array.from(
      html.matchAll(/<option[^>]*>(.*?)<\/option>/g),
    ).map((m) => m[1].replace(/&nbsp;/g, " ").trim());

    expect(labels).toEqual([
      "— No folder (top level) —",
      "Personal",
      "Projects",
      "Alpha",
      "Work",
    ]);
  });

  it("handles empty folder list", () => {
    const html = buildFolderOptionsHTML([], "None");
    const labels = Array.from(
      html.matchAll(/<option[^>]*>(.*?)<\/option>/g),
    ).map((m) => m[1].replace(/&nbsp;/g, " ").trim());
    expect(labels).toEqual(["None"]);
  });
});
