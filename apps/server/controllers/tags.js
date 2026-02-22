const { v4: uuidv4 } = require("uuid");
const bookmarkModel = require("../models/bookmark");
const tagHelpers = require("../helpers/tag-helpers");
const tagParseHelpers = require("../helpers/tags");

function setupTagsRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware } = helpers;
  const tagModel = require("../models/tag");
  const { parseTags, mergeTags, stringifyTags } = tagParseHelpers;
  const { broadcast } = require("../helpers/websocket");

  // --- CRUD (tag entity) ---

  /**
   * @swagger
   * /tags:
   *   get:
   *     summary: List all tags
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: A list of tags
   */
  app.get("/api/tags", authenticateTokenMiddleware, (req, res) => {
    try {
      const tags = tagModel.listTags(db, req.user.id);
      res.json(tags);
    } catch (err) {
      console.error("Error fetching tags:", err);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  /**
   * @swagger
   * /tags:
   *   post:
   *     summary: Create a new tag
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *               color:
   *                 type: string
   *               icon:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tag created successfully
   */
  app.post("/api/tags", authenticateTokenMiddleware, (req, res) => {
    const { name, color, icon } = req.body;
    if (!name || !name.trim())
      return res.status(400).json({ error: "Tag name is required" });
    const id = uuidv4();
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
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  /**
   * @swagger
   * /tags/{id}:
   *   put:
   *     summary: Update a tag
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               color:
   *                 type: string
   *               icon:
   *                 type: string
   *               position:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Tag updated successfully
   */
  app.put("/api/tags/:id", authenticateTokenMiddleware, (req, res) => {
    const { name, color, icon, position } = req.body;
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
        FROM tags t
        LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
        WHERE t.id = ?
        GROUP BY t.id
      `,
        )
        .get(req.params.id);
      if (!tag) return res.status(404).json({ error: "Tag not found" });
      broadcast(req.user.id, { type: "tags:changed" });
      res.json(tag);
    } catch (err) {
      console.error("Error updating tag:", err);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  /**
   * @swagger
   * /tags/{id}:
   *   delete:
   *     summary: Delete a tag
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Tag deleted successfully
   */
  app.delete("/api/tags/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      tagModel.deleteTag(db, req.params.id, req.user.id);
      broadcast(req.user.id, { type: "tags:changed" });
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting tag:", err);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // --- Suggest, analytics, bulk, rename ---

  /**
   * @swagger
   * /tags/suggest:
   *   get:
   *     summary: Get tag suggestions for a URL
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     parameters:
   *       - in: query
   *         name: url
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: A list of suggested tags
   */
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
          } catch { }
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
    } catch {
      res.json([]);
    }
  });

  /**
   * @swagger
   * /tags/analytics:
   *   get:
   *     summary: Get tag usage analytics
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Tag analytics data
   */
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

  /**
   * @swagger
   * /tags/bulk-add:
   *   post:
   *     summary: Add tags to multiple bookmarks
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [bookmark_ids, tags]
   *             properties:
   *               bookmark_ids:
   *                 type: array
   *                 items:
   *                   type: string
   *               tags:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tags added successfully
   */
  app.post("/api/tags/bulk-add", authenticateTokenMiddleware, (req, res) => {
    const { bookmark_ids, tags } = req.body;
    if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
      return res
        .status(400)
        .json({ error: "bookmark_ids and tags are required" });
    }

    const normalizedTags = parseTags(tags);
    const updated = [];
    const userId = req.user.id;

    bookmark_ids.forEach((id) => {
      // Verify ownership: skip bookmarks not belonging to this user
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
  });

  /**
   * @swagger
   * /tags/bulk-remove:
   *   post:
   *     summary: Remove tags from multiple bookmarks
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [bookmark_ids, tags]
   *             properties:
   *               bookmark_ids:
   *                 type: array
   *                 items:
   *                   type: string
   *               tags:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tags removed successfully
   */
  app.post("/api/tags/bulk-remove", authenticateTokenMiddleware, (req, res) => {
    const { bookmark_ids, tags } = req.body;
    if (!Array.isArray(bookmark_ids) || bookmark_ids.length === 0 || !tags) {
      return res
        .status(400)
        .json({ error: "bookmark_ids and tags are required" });
    }

    const removeSet = new Set(parseTags(tags).map((t) => t.toLowerCase()));
    const updated = [];
    const userId = req.user.id;

    bookmark_ids.forEach((id) => {
      // Verify ownership: skip bookmarks not belonging to this user
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
      } else {
        tagHelpers.updateBookmarkTags(db, id, [], { userId });
      }

      updated.push(id);
    });

    res.json({ updated });
  });

  /**
   * @swagger
   * /tags/rename:
   *   post:
   *     summary: Rename or merge a tag
   *     tags: [Tags]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [from, to]
   *             properties:
   *               from:
   *                 type: string
   *               to:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tag renamed successfully
   *       404:
   *         description: Tag not found
   */
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

module.exports = { setupTagsRoutes };
