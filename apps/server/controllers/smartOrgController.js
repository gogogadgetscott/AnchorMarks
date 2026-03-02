const smartOrg = require("../services/smartOrgService");
const tagHelpers = require("../services/tagService");
const bookmarkModel = require("../models/bookmark");
const smartCollectionsModel = require("../models/smartCollections");
const statsModel = require("../models/stats");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function suggestSmartTags(req, res) {
  const db = req.app.get("db");
  const q = req.validatedQuery || req.query;
  const {
    url,
    limit = 10,
    include_domain,
    include_activity,
    include_similar,
    domain_weight,
    activity_weight,
    similarity_weight,
  } = q;
  const includeDomain = include_domain !== "false";
  const includeActivity = include_activity !== "false";
  const includeSimilar = include_similar !== "false";
  const weights = {
    domain: domain_weight ?? (includeDomain ? 0.35 : 0),
    activity: activity_weight ?? (includeActivity ? 0.4 : 0),
    similarity: similarity_weight ?? (includeSimilar ? 0.25 : 0),
  };
  if (!url) return res.status(400).json({ error: "URL parameter required" });
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }
  try {
    const domain = urlObj.hostname.replace(/^www\./, "");
    const categoryInfo = smartOrg.getDomainCategory(url);
    const domainStats = smartOrg.getDomainStats(db, req.user.id, domain);
    const tagsToScore = new Set();
    if (includeDomain && categoryInfo.tags)
      categoryInfo.tags.forEach((t) => tagsToScore.add(t));
    const userTags = tagHelpers.getUserTags(db, req.user.id).map((t) => t.name);
    userTags.forEach((row) => tagsToScore.add(row));
    const domainTags = tagHelpers.getTagsForDomain(db, req.user.id, domain);
    domainTags.forEach((t) => tagsToScore.add(t));
    const suggestions = [];
    tagsToScore.forEach((tag) => {
      const scores = smartOrg.calculateTagScore(
        db,
        req.user.id,
        url,
        tag,
        weights,
      );
      if (scores.score > 0.1)
        suggestions.push({
          tag,
          score: Math.round(scores.score * 100) / 100,
          source: smartOrg.getTopSource
            ? smartOrg.getTopSource(scores)
            : "domain",
          reason: smartOrg.generateReason
            ? smartOrg.generateReason(tag, domain, scores, db, req.user.id)
            : "Suggested tag",
        });
    });
    suggestions.sort((a, b) => b.score - a.score);
    res.json({
      suggestions: suggestions.slice(0, parseInt(limit)),
      domain_info: { domain, category: categoryInfo.category, ...domainStats },
    });
  } catch (err) {
    logger.error("Smart tag suggestions error", err);
    return res.status(400).json({ error: "Invalid URL" });
  }
}

function suggestCollections(req, res) {
  const db = req.app.get("db");
  const q = req.validatedQuery || req.query;
  const { type, limit = 5 } = q;
  try {
    let suggestions = [];
    if (!type || type === "tag_cluster")
      suggestions = suggestions.concat(
        smartOrg.getTagClusters(db, req.user.id).slice(0, 2),
      );
    if (!type || type === "activity")
      suggestions = suggestions.concat(
        smartOrg.getActivityCollections(db, req.user.id).slice(0, 2),
      );
    if (!type || type === "domain")
      suggestions = suggestions.concat(
        smartOrg.getDomainCollections(db, req.user.id).slice(0, 2),
      );
    const seen = new Set();
    const unique = suggestions.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
    res.json({ collections: unique.slice(0, Number(limit)) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Smart collections suggest");
  }
}

function createSmartCollection(req, res) {
  const db = req.app.get("db");
  const data = req.validated;
  if (!data) return res.status(400).json({ error: "Validation required" });
  const {
    name,
    type = "tag_cluster",
    icon,
    color,
    tags,
    domain,
    filters,
  } = data;
  if (type === "tag_cluster" && (!tags || !tags.length))
    return res
      .status(400)
      .json({ error: "Rules are required for tag cluster collections" });
  try {
    let filterObj = {};
    if (type === "tag_cluster" && tags && tags.length) filterObj = { tags };
    else if (type === "domain" && domain) filterObj = { domain };
    else if (type === "activity" && filters) filterObj = filters;
    const created = smartCollectionsModel.createCollection(db, req.user.id, {
      name,
      icon: icon || "filter",
      color: color || "#6366f1",
      filters: filterObj,
    });
    res.json({
      id: created.id,
      name: created.name,
      type,
      icon: created.icon,
      color: created.color,
      filters: filterObj,
      created: true,
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Failed to create collection");
  }
}

function getDomainStats(req, res) {
  const db = req.app.get("db");
  const { domain } = req.validatedQuery || req.query;
  try {
    const stats = smartOrg.getDomainStats(db, req.user.id, domain);
    const category = smartOrg.getDomainCategory(`https://${domain}`);
    const recentBookmarks = bookmarkModel.getRecentCountForDomain(
      db,
      req.user.id,
      domain,
    );
    const mostClicked = bookmarkModel.getMostClickedForDomain(
      db,
      req.user.id,
      domain,
      5,
    );
    res.json({
      domain: stats.domain,
      bookmark_count: stats.bookmarkCount,
      tag_distribution: stats.tagDistribution,
      category: category.category,
      recentBookmarks,
      mostClicked,
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Failed to get domain stats");
  }
}

function getTagClusters(req, res) {
  const db = req.app.get("db");
  try {
    res.json({ clusters: smartOrg.getTagClusters(db, req.user.id) });
  } catch (err) {
    return reportAndSend(res, err, logger, "Failed to get tag clusters");
  }
}

function getSmartInsights(req, res) {
  const db = req.app.get("db");
  try {
    const top = statsModel.getStats(db, req.user.id);
    const engagement = statsModel.getEngagement(db, req.user.id);
    const lastAdded = statsModel.getLastAdded(db, req.user.id);
    res.json({
      total_bookmarks: top.total_bookmarks,
      total_tags: top.total_tags,
      top_domains: [],
      top_tags: [],
      recent_activity: {
        bookmarks_this_week: top.total_bookmarks,
        bookmarks_this_month: top.total_bookmarks,
        last_bookmark_added: lastAdded || null,
      },
      engagement: {
        total_clicks: engagement.totalClicks,
        unread_bookmarks: engagement.unread,
        frequently_used: engagement.frequentlyUsed,
      },
      suggestions: { create_these_collections: [], organize_these_tags: [] },
    });
  } catch (err) {
    return reportAndSend(res, err, logger, "Failed to get smart insights");
  }
}

module.exports = {
  suggestSmartTags,
  suggestCollections,
  createSmartCollection,
  getDomainStats,
  getTagClusters,
  getSmartInsights,
};
