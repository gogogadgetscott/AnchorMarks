type FolderLike = {
  id: string;
  name: string;
  parent_id?: string | null;
};

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

export function buildFolderOptionsHTML(
  folders: FolderLike[],
  topLabel = "None",
): string {
  const sorter = (a: FolderLike, b: FolderLike) => a.name.localeCompare(b.name);

  let html = `<option value="">${escapeHtml(topLabel)}</option>`;

  function build(parentId: string | null = null, level = 0): void {
    const children = folders
      .filter((folder) => (folder.parent_id || null) === parentId)
      .sort(sorter);

    children.forEach((folder) => {
      const prefix = "&nbsp;&nbsp;&nbsp;".repeat(level);
      html += `<option value="${folder.id}">${prefix}${escapeHtml(folder.name)}</option>`;
      build(folder.id, level + 1);
    });
  }

  build(null, 0);
  return html;
}

declare global {
  interface Window {
    anchormarks?: {
      buildFolderOptionsHTML?: typeof buildFolderOptionsHTML;
    };
  }
}

window.anchormarks = window.anchormarks || {};
window.anchormarks.buildFolderOptionsHTML = buildFolderOptionsHTML;
