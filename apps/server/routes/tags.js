const bookmarkModel = require("../models/bookmark");
const tagHelpers = require("../helpers/tag-helpers");
const tagParseHelpers = require("../helpers/tags");

function setupTagsRoutes(app, db, { authenticateTokenMiddleware }) {
  const { parseTags, mergeTags, stringifyTags } = tagParseHelpers;

  app.get("/api/tags/suggest", authenticateTokenMiddleware, (req, res) => {
    const { url } = req.query;
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

      const allRows = bookmarkModel.getSampleForSuggestion(
        db,
        req.user.id,
        800,
      );

      const docFreq = {};
      const tokenizer = (text) => {
        return (text || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s\-/]/g, " ")
          .split(/\s+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 2 && t.length < 30);
      };

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
            if (rowHost === hostname) {
              parseTags(row.tags).forEach((t) => bump(t, 3.5));
            }
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
    } catch {
      res.json([]);
    }
  });

  app.get("/api/tags/analytics", authenticateTokenMiddleware, (req, res) => {
    try {
      const tags = tagHelpers.getTagUsageCounts(db, req.user.id);
      const cooccurrence = tagHelpers.getTagCooccurrence(db, req.user.id);
      res.json({ success: true, tags, cooccurrence });
    } catch (err) {
      console.error("Tag analytics error:", err);
      res.status(500).json({ error: "Failed to compute tag analytics" });
    }
  });

  app.post("/api/tags/bulk-add", authenticateTokenMiddleware, (req, res) => {
    const { bookmark_ids, tags } = req.body;
    if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
      return res
        .status(400)
        .json({ error: "bookmark_ids and tags are required" });
    }

    const normalizedTags = parseTags(tags);
    const updated = [];

    bookmark_ids.forEach((id) => {
      const current = tagHelpers.getBookmarkTagsString(db, id);
      const merged = mergeTags(current, normalizedTags);
      const tagsString = stringifyTags(merged);
      const tagIds = tagHelpers.ensureTagsExist(db, req.user.id, tagsString);
      tagHelpers.updateBookmarkTags(db, id, tagIds);
      updated.push(id);
    });

    res.json({ updated });
  });

  app.post("/api/tags/bulk-remove", authenticateTokenMiddleware, (req, res) => {
    const { bookmark_ids, tags } = req.body;
    if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
      return res
        .status(400)
        .json({ error: "bookmark_ids and tags are required" });
    }

    const removeSet = new Set(parseTags(tags).map((t) => t.toLowerCase()));
    const updated = [];

    bookmark_ids.forEach((id) => {
      const current = tagHelpers.getBookmarkTagsString(db, id);
      if (!current) {
        tagHelpers.updateBookmarkTags(db, id, []);
        return;
      }
      const filtered = parseTags(current).filter(
        (t) => !removeSet.has(t.toLowerCase()),
      );
      const tagsString = filtered.length ? stringifyTags(filtered) : null;

      if (tagsString) {
        const tagIds = tagHelpers.ensureTagsExist(db, req.user.id, tagsString);
        tagHelpers.updateBookmarkTags(db, id, tagIds);
      } else {
        tagHelpers.updateBookmarkTags(db, id, []);
      }

      updated.push(id);
    });

    res.json({ updated });
  });

  app.post("/api/tags/rename", authenticateTokenMiddleware, (req, res) => {
    const { from, to } = req.body;
    if (!from || !to)
      return res.status(400).json({ error: "from and to are required" });
    try {
      const result = tagHelpers.renameOrMergeTag(db, req.user.id, from, to);
      if (result.error === "not_found")
        return res.status(404).json({ error: "Tag not found" });
      res.json({ updated: result.updated });
    } catch (err) {
      console.error("Tag rename error:", err);
      res.status(500).json({ error: "Failed to rename/merge tag" });
    }
  });
}

module.exports = setupTagsRoutes;
