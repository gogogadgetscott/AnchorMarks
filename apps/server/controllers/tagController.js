const { v4: uuidv4 } = require("uuid");
const bookmarkModel = require("../models/bookmark");
const tagHelpers = require("../services/tagService");
const { parseTags, mergeTags, stringifyTags } = require("../utils/tagUtils");
const { broadcast } = require("../services/websocketService");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function listTags(req, res) {
  const db = req.app.get("db");
  try {
    const tagModel = require("../models/tag");
    const tags = tagModel.listTags(db, req.user.id);
    res.json(tags);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error fetching tags");
  }
}

function createTag(req, res) {
  const db = req.app.get("db");
  const { name, color, icon } = req.validated;
  const id = uuidv4();
  const tagModel = require("../models/tag");
  const maxPos = db
    .prepare("SELECT MAX(position) as max FROM tags WHERE user_id = ?")
    .get(req.user.id);
  const position = (maxPos.max || 0) + 1;
  try {
    tagModel.createTag(db, {
      id,
      user_id: req.user.id,
      name: name.trim(),
      color: color || "#f59e0b",
      icon: icon || "tag",
      position,
    });
    const tag = db
      .prepare("SELECT *, 0 as count FROM tags WHERE id = ?")
      .get(id);
    broadcast(req.user.id, { type: "tags:changed" });
    res.json(tag);
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE"))
      return res.status(409).json({ error: "Tag already exists" });
    return reportAndSend(res, err, logger, "Error creating tag");
  }
}

function updateTag(req, res) {
  const db = req.app.get("db");
  const tagModel = require("../models/tag");
  const { name, color, icon, position } = req.validated;
  try {
    tagModel.updateTag(db, req.params.id, req.user.id, {
      name,
      color,
      icon,
      position,
    });
    const tag = db
      .prepare(
        `
      SELECT t.*, COUNT(bt.bookmark_id) as count
      FROM tags t LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE t.id = ? AND t.user_id = ? GROUP BY t.id
    `,
      )
      .get(req.params.id, req.user.id);
    if (!tag) return res.status(404).json({ error: "Tag not found" });
    broadcast(req.user.id, { type: "tags:changed" });
    res.json(tag);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error updating tag");
  }
}

function deleteTag(req, res) {
  const db = req.app.get("db");
  const tagModel = require("../models/tag");
  try {
    tagModel.deleteTag(db, req.params.id, req.user.id);
    broadcast(req.user.id, { type: "tags:changed" });
    res.json({ success: true });
  } catch (err) {
    return reportAndSend(res, err, logger, "Error deleting tag");
  }
}

function suggestTags(req, res) {
  const db = req.app.get("db");
  const { url } = req.validatedQuery;
  if (!url) return res.json([]);
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, "");
    const counts = {};
    const bump = (tag, weight = 1) => {
      if (!tag) return;
      const key = tag.toLowerCase();
      counts[key] = (counts[key] || 0) + weight;
    };
    const allRows = bookmarkModel.getSampleForSuggestion(db, req.user.id, 800);
    const docFreq = {};
    const tokenizer = (text) =>
      (text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s\-/]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && t.length < 30);
    allRows.forEach((row) => {
      const tokens = new Set(tokenizer(row.title));
      tokens.forEach((tok) => {
        docFreq[tok] = (docFreq[tok] || 0) + 1;
      });
    });
    const totalDocs = allRows.length || 1;
    allRows.forEach((row) => {
      const urlMatch = row.url && row.url.includes(hostname);
      if (urlMatch) {
        parseTags(row.tags).forEach((t) => bump(t, 2.5));
        try {
          const rowHost = new URL(row.url).hostname.replace(/^www\./, "");
          if (rowHost === hostname)
            parseTags(row.tags).forEach((t) => bump(t, 3.5));
        } catch {}
      }
      const tfCounts = {};
      tokenizer(row.title).forEach((tok) => {
        tfCounts[tok] = (tfCounts[tok] || 0) + 1;
      });
      Object.entries(tfCounts).forEach(([tok, tf]) => {
        const df = docFreq[tok] || 1;
        const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
        const weight = tf * idf;
        if (urlMatch) bump(tok, weight * 1.2);
        else bump(tok, weight * 0.6);
      });
    });
    const stopwords = new Set([
      "www",
      "com",
      "net",
      "org",
      "app",
      "io",
      "dev",
      "ai",
    ]);
    hostname.split(".").forEach((part) => {
      if (part && part.length > 2 && !stopwords.has(part)) bump(part, 1.5);
    });
    urlObj.pathname
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p && p.length > 2 && p.length < 40)
      .slice(0, 4)
      .forEach((part) => {
        const clean = part.replace(/[-_]+/g, " ").toLowerCase();
        clean.split(" ").forEach((seg) => {
          if (seg && seg.length > 2) bump(seg, 1);
        });
      });
    const suggestions = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 15);
    res.json(suggestions);
  } catch (err) {
    logger.warn("Tag suggestion failed", err);
    res.json([]);
  }
}

function getTagAnalytics(req, res) {
  const db = req.app.get("db");
  try {
    const tags = tagHelpers.getTagUsageCounts(db, req.user.id);
    const cooccurrence = tagHelpers.getTagCooccurrence(db, req.user.id);
    res.json({ success: true, tags, cooccurrence });
  } catch (err) {
    return reportAndSend(res, err, logger, "Tag analytics error");
  }
}

function bulkAddTags(req, res) {
  const db = req.app.get("db");
  const { bookmark_ids, tags } = req.validated;
  const normalizedTags = parseTags(tags);
  const updated = [];
  const userId = req.user.id;
  bookmark_ids.forEach((id) => {
    const owned = db
      .prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?")
      .get(id, userId);
    if (!owned) return;
    const current = tagHelpers.getBookmarkTagsString(db, id, userId);
    const merged = mergeTags(current, normalizedTags);
    const tagsString = stringifyTags(merged);
    const tagIds = tagHelpers.ensureTagsExist(db, userId, tagsString);
    tagHelpers.updateBookmarkTags(db, id, tagIds, { userId });
    updated.push(id);
  });
  res.json({ updated });
}

function bulkRemoveTags(req, res) {
  const db = req.app.get("db");
  const { bookmark_ids, tags } = req.validated;
  const removeSet = new Set(parseTags(tags).map((t) => t.toLowerCase()));
  const updated = [];
  const userId = req.user.id;
  bookmark_ids.forEach((id) => {
    const owned = db
      .prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?")
      .get(id, userId);
    if (!owned) return;
    const current = tagHelpers.getBookmarkTagsString(db, id, userId);
    if (!current) {
      tagHelpers.updateBookmarkTags(db, id, [], { userId });
      return;
    }
    const filtered = parseTags(current).filter(
      (t) => !removeSet.has(t.toLowerCase()),
    );
    const tagsString = filtered.length ? stringifyTags(filtered) : null;
    if (tagsString) {
      const tagIds = tagHelpers.ensureTagsExist(db, userId, tagsString);
      tagHelpers.updateBookmarkTags(db, id, tagIds, { userId });
    } else tagHelpers.updateBookmarkTags(db, id, [], { userId });
    updated.push(id);
  });
  res.json({ updated });
}

function renameTag(req, res) {
  const db = req.app.get("db");
  const { from, to } = req.validated;
  try {
    const result = tagHelpers.renameOrMergeTag(db, req.user.id, from, to);
    if (result.error === "not_found")
      return res.status(404).json({ error: "Tag not found" });
    res.json({ updated: result.updated });
  } catch (err) {
    return reportAndSend(res, err, logger, "Tag rename error");
  }
}

async function suggestTagsAI(req, res) {
  const db = req.app.get("db");
  const config = require("../config");
  const aiTags = require("../services/aiTagService");
  const { url, limit = 10 } = req.validatedQuery || req.query;
  try {
    const userTags = db
      .prepare("SELECT DISTINCT name FROM tags WHERE user_id = ?")
      .all(req.user.id)
      .map((r) => r.name);
    const aiConfig = config.getAIConfig
      ? config.getAIConfig()
      : { provider: "none" };
    const suggestions = await aiTags.suggestTagsAI(
      { url, title: null, limit: Number(limit), userTags },
      aiConfig,
    );
    res.json({
      suggestions,
      info: { provider: aiConfig.provider, model: aiConfig.model || null },
    });
  } catch (err) {
    if (
      err &&
      (err.code === "AI_NOT_CONFIGURED" ||
        err.code === "AI_KEY_MISSING" ||
        err.code === "AI_UNSUPPORTED")
    ) {
      return res.status(501).json({ error: "AI service not configured" });
    }
    logger.error("AI tag suggestions error", err);
    return res.status(500).json({ error: "Failed to get AI suggestions" });
  }
}

module.exports = {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  suggestTags,
  getTagAnalytics,
  bulkAddTags,
  bulkRemoveTags,
  renameTag,
  suggestTagsAI,
};
