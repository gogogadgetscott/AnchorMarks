const quickSearchModel = require("../models/quickSearch");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function search(req, res) {
  const db = req.app.get("db");
  try {
    const { q, limit = 10 } = req.validatedQuery || req.query;
    if (!q)
      return res.json(quickSearchModel.listRecent(db, req.user.id, limit));
    res.json(quickSearchModel.search(db, req.user.id, q, limit));
  } catch (err) {
    return reportAndSend(res, err, logger, "Quick search error");
  }
}

module.exports = { search };
