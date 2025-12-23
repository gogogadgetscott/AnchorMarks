function parseTags(tagsString) {
  if (!tagsString) return [];
  if (Array.isArray(tagsString))
    return tagsString.map((t) => String(t).trim()).filter(Boolean);
  return tagsString
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function mergeTags(existing, incoming) {
  const set = new Set([...parseTags(existing), ...parseTags(incoming)]);
  return Array.from(set);
}

function stringifyTags(tagsArray) {
  return parseTags(tagsArray).join(", ");
}

function parseTagsDetailed(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function normalizeTagColorOverrides(raw, tagMap = {}) {
  const overrides = {};
  if (!raw) return overrides;

  const isValidHex = (color) =>
    typeof color === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());

  const assignOverride = (name, color) => {
    if (!name || !isValidHex(color)) return;
    const tagId = tagMap[name] || tagMap[name.trim()] || null;
    if (tagId) {
      overrides[tagId] = color.trim();
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (entry && typeof entry === "object") {
        assignOverride(
          entry.name || entry.tag,
          entry.color || entry.color_override,
        );
      }
    });
  } else if (typeof raw === "object") {
    Object.entries(raw).forEach(([name, color]) => assignOverride(name, color));
  }

  return overrides;
}

module.exports = {
  parseTags,
  mergeTags,
  stringifyTags,
  parseTagsDetailed,
  normalizeTagColorOverrides,
};
