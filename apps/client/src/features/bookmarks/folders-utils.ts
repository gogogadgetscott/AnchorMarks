import { Folder } from "../../types/index";
import { escapeHtml } from "@utils/index.ts";

export function buildFolderOptionsHTML(
  folders: Folder[],
  topLabel = "None",
): string {
  const sorter = (a: any, b: any) => a.name.localeCompare(b.name);

  let html = `<option value="">${escapeHtml(topLabel)}</option>`;

  function build(parent_id: string | null = null, level = 0) {
    const children = folders
      .filter((f) => (f.parent_id || null) === parent_id)
      .sort(sorter);

    children.forEach((f) => {
      const prefix = "&nbsp;&nbsp;&nbsp;".repeat(level);
      html += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
      build(f.id, level + 1);
    });
  }

  build(null, 0);
  return html;
}
