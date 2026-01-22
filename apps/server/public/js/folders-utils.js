// Shared helper for building folder <option> HTML
(function (global) {
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildFolderOptionsHTML(folders, topLabel) {
    const sorter = function (a, b) {
      return a.name.localeCompare(b.name);
    };

    let html = `<option value="">${escapeHtml(topLabel || "None")}</option>`;

    function build(parent_id, level) {
      if (level === undefined) level = 0;
      const children = folders
        .filter(function (f) {
          return (f.parent_id || null) === parent_id;
        })
        .sort(sorter);

      children.forEach(function (f) {
        const prefix = "&nbsp;&nbsp;&nbsp;".repeat(level);
        html += `<option value="${f.id}">${prefix}${escapeHtml(f.name)}</option>`;
        build(f.id, level + 1);
      });
    }

    build(null, 0);
    return html;
  }

  global.escapeHtml = escapeHtml;
  global.buildFolderOptionsHTML = buildFolderOptionsHTML;
})(typeof window !== "undefined" ? window : this);
