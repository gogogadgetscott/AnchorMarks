const statsModel = require("../models/stats");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function getStats(req, res) {
  const db = req.app.get("db");
  try {
    res.json(statsModel.getStats(db, req.user.id));
  } catch (err) {
    return reportAndSend(res, err, logger, "Stats error");
  }
}

function getAdvancedStats(req, res) {
  const db = req.app.get("db");
  try {
    const stats = statsModel.getStats(db, req.user.id);
    const engagement = statsModel.getEngagement(db, req.user.id);
    res.json({ ...stats, ...engagement });
  } catch (err) {
    return reportAndSend(res, err, logger, "Advanced stats error");
  }
}

module.exports = { getStats, getAdvancedStats };
