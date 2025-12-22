const smartOrg = require("../helpers/smart-organization");
const tagHelpers = require("../helpers/tag-helpers");
const bookmarkModel = require("../models/bookmark");
const smartCollectionsModel = require("../models/smartCollections");
const statsModel = require("../models/stats");

function setupSmartOrganizationRoutes(
  app,
  db,
  { authenticateTokenMiddleware, validateCsrfTokenMiddleware },
) {
  app.get(
    "/api/tags/suggest-smart",
    authenticateTokenMiddleware,
    (req, res) => {
      const { url, limit = 10 } = req.query;
      const include_domain = req.query.include_domain !== "false";
      const include_activity = req.query.include_activity !== "false";
      const include_similar = req.query.include_similar !== "false";

      if (!url)
        return res.status(400).json({ error: "URL parameter required" });
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      try {
        const domain = urlObj.hostname.replace(/^www\./, "");
        const categoryInfo = smartOrg.getDomainCategory(url);
        const domainStats = smartOrg.getDomainStats(db, req.user.id, domain);

        const tagsToScore = new Set();
        if (include_domain && categoryInfo.tags)
          categoryInfo.tags.forEach((t) => tagsToScore.add(t));

        const userTags = tagHelpers
          .getUserTags(db, req.user.id)
          .map((t) => t.name);
        userTags.forEach((row) => tagsToScore.add(row));

        const domainTags = tagHelpers.getTagsForDomain(db, req.user.id, domain);
        domainTags.forEach((t) => tagsToScore.add(t));

        const suggestions = [];
        tagsToScore.forEach((tag) => {
          const scores = smartOrg.calculateTagScore(db, req.user.id, url, tag, {
            domain: include_domain ? 0.35 : 0,
            activity: include_activity ? 0.4 : 0,
            similarity: include_similar ? 0.25 : 0,
          });

          if (scores.score > 0.1) {
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
          }
        });

        suggestions.sort((a, b) => b.score - a.score);

        res.json({
          suggestions: suggestions.slice(0, parseInt(limit)),
          domain_info: {
            domain,
            category: categoryInfo.category,
            ...domainStats,
          },
        });
      } catch (err) {
        console.error("Smart tag suggestions error:", err.message || err);
        return res.status(400).json({ error: err.message || "Invalid URL" });
      }
    },
  );

  app.get(
    "/api/smart-collections/suggest",
    authenticateTokenMiddleware,
    (req, res) => {
      const { type, limit = 5 } = req.query;
      try {
        let suggestions = [];
        if (!type || type === "tag_cluster") {
          const clusters = smartOrg.getTagClusters(db, req.user.id);
          suggestions = suggestions.concat(clusters.slice(0, 2));
        }
        if (!type || type === "activity") {
          const activityCollections = smartOrg.getActivityCollections(
            db,
            req.user.id,
          );
          suggestions = suggestions.concat(activityCollections.slice(0, 2));
        }
        if (!type || type === "domain") {
          const domainCollections = smartOrg.getDomainCollections(
            db,
            req.user.id,
          );
          suggestions = suggestions.concat(domainCollections.slice(0, 2));
        }

        const seen = new Set();
        const unique = suggestions.filter((s) => {
          if (seen.has(s.name)) return false;
          seen.add(s.name);
          return true;
        });
        res.json({ collections: unique.slice(0, parseInt(limit)) });
      } catch (err) {
        console.error("Smart collections suggest error:", err);
        return res.status(500).json({ error: err.message });
      }
    },
  );

  app.post(
    "/api/smart-collections/create",
    authenticateTokenMiddleware,
    validateCsrfTokenMiddleware,
    (req, res) => {
      const {
        name,
        type = "tag_cluster",
        icon,
        color,
        tags,
        domain,
        filters,
      } = req.body;
      if (!name || !type)
        return res.status(400).json({ error: "Name and type are required" });
      if (type === "tag_cluster" && (!tags || !tags.length))
        return res
          .status(400)
          .json({ error: "Rules are required for tag cluster collections" });
      try {
        let filterObj = {};
        if (type === "tag_cluster" && tags && tags.length) filterObj = { tags };
        else if (type === "domain" && domain) filterObj = { domain };
        else if (type === "activity" && filters) filterObj = filters;

        const created = smartCollectionsModel.createCollection(
          db,
          req.user.id,
          {
            name,
            icon: icon || "filter",
            color: color || "#6366f1",
            filters: filterObj,
          },
        );
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
        res
          .status(500)
          .json({ error: "Failed to create collection: " + err.message });
      }
    },
  );

  app.get(
    "/api/smart-collections/domain-stats",
    authenticateTokenMiddleware,
    (req, res) => {
      const { domain } = req.query;
      if (!domain)
        return res.status(400).json({ error: "Domain parameter required" });
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
        res.status(500).json({ error: err.message });
      }
    },
  );

  app.get(
    "/api/smart-collections/tag-clusters",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        const clusters = smartOrg.getTagClusters(db, req.user.id);
        res.json({ clusters });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    },
  );

  app.get("/api/smart-insights", authenticateTokenMiddleware, (req, res) => {
    try {
      const top = statsModel.getStats(db, req.user.id);
      const engagement = statsModel.getEngagement(db, req.user.id);
      const lastAdded = statsModel.getLastAdded(db, req.user.id);
      const totalBookmarks = top.total_bookmarks;
      const totalTags = top.total_tags;
      const thisWeek = totalBookmarks;
      const thisMonth = totalBookmarks;
      const totalClicks = engagement.totalClicks;
      const unread = engagement.unread;
      const frequentlyUsed = engagement.frequentlyUsed;
      res.json({
        total_bookmarks: totalBookmarks,
        total_tags: totalTags,
        top_domains: [],
        top_tags: [],
        recent_activity: {
          bookmarks_this_week: thisWeek,
          bookmarks_this_month: thisMonth,
          last_bookmark_added: lastAdded || null,
        },
        engagement: {
          total_clicks: totalClicks,
          unread_bookmarks: unread,
          frequently_used: frequentlyUsed,
        },
        suggestions: { create_these_collections: [], organize_these_tags: [] },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = setupSmartOrganizationRoutes;
