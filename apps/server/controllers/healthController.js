const statsModel = require("../models/stats");
const bookmarkModel = require("../models/bookmark");
const { monitor } = require("../utils/performanceMonitor");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function findDuplicates(req, res) {
  const db = req.app.get("db");
  try {
    const dups = statsModel.findDuplicates(db, req.user.id);
    res.json({ total_duplicates: dups.length, duplicates: dups });
  } catch (err) {
    return reportAndSend(res, err, logger, "Duplicates error");
  }
}

function cleanupDuplicates(req, res) {
  const db = req.app.get("db");
  try {
    res.json(statsModel.cleanupDuplicates(db, req.user.id));
  } catch (err) {
    return reportAndSend(res, err, logger, "Cleanup duplicates error");
  }
}

async function checkDeadlinks(req, res) {
  const db = req.app.get("db");
  try {
    const q = req.validatedQuery || req.query;
    const { check } = q;
    const limit = q.limit ?? 50;
    if (check !== "true") {
      const info = statsModel.getDeadlinksInfo(db, req.user.id, limit);
      return res.json({
        dead_links: info.dead_links,
        unchecked: info.unchecked,
        bookmarks: info.bookmarks,
      });
    }
    res.json(await statsModel.runDeadlinkChecks(db, req.user.id, limit));
  } catch (err) {
    return reportAndSend(res, err, logger, "Deadlinks error");
  }
}

function getBookmarksByDomain(req, res) {
  const db = req.app.get("db");
  try {
    const urls = bookmarkModel.listUrls(db, req.user.id);
    const domainCounts = {};
    urls.forEach((u) => {
      try {
        const domain = new URL(u).hostname.replace("www.", "");
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch {}
    });
    const sorted = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([domain, count]) => ({ domain, count }));
    res.json(sorted);
  } catch (err) {
    return reportAndSend(res, err, logger, "Error computing domains");
  }
}

function getPerformanceStats(req, res) {
  try {
    const q = req.validatedQuery || req.query;
    const timeWindow = q.window ?? 3600000;
    res.json(monitor.getStats(timeWindow));
  } catch (err) {
    return reportAndSend(res, err, logger, "Performance stats error");
  }
}

module.exports = {
  findDuplicates,
  cleanupDuplicates,
  checkDeadlinks,
  getBookmarksByDomain,
  getPerformanceStats,
};
