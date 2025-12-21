const { v4: uuidv4 } = require("uuid");
const http = require("http");
const https = require("https");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../helpers/tag-helpers");
const bookmarkModel = require("../models/bookmark");
const { isPrivateAddress } = require("../helpers/utils");
const config = require("../config");

function parseTagsDetailed(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch (err) {
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
    if (tagId) overrides[tagId] = color.trim();
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

async function fetchUrlMetadata(url, redirectCount = 0) {
  if (redirectCount > 5) throw new Error("Too many redirects");

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const options = {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    };

    const req = protocol.get(url, options, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        try {
          const redirectUrl = new URL(res.headers.location, url).toString();
          return fetchUrlMetadata(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        } catch (e) {
          return reject(e);
        }
      }

      if (res.statusCode !== 200)
        return reject(new Error(`HTTP ${res.statusCode}`));

      const contentType = res.headers["content-type"] || "";
      if (!contentType.includes("text/html")) {
        return resolve({ title: new URL(url).hostname, description: "", url });
      }

      let html = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        html += chunk;
        if (html.length > 500000) res.destroy();
      });
      res.on("end", () => {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const metadata = {
          title: titleMatch ? titleMatch[1].trim() : new URL(url).hostname,
          description: "",
          url,
        };
        const descMatch =
          html.match(
            /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
          ) ||
          html.match(
            /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
          );
        if (descMatch) metadata.description = descMatch[1].trim();
        resolve(metadata);
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

function detectContentType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname.toLowerCase();
    if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("vimeo.com")
    )
      return "video";
    if (hostname.includes("twitter.com") || hostname.includes("x.com"))
      return "tweet";
    if (pathname.endsWith(".pdf")) return "pdf";
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathname)) return "image";
    if (hostname.includes("github.com")) return "repo";
    return "link";
  } catch (e) {
    return "link";
  }
}

function setupBookmarksRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware, fetchFaviconWrapper } = helpers;

  // List bookmarks
  app.get("/api/bookmarks", authenticateTokenMiddleware, (req, res) => {
    const { folder_id, search, favorites, tags, sort, limit, offset, archived } =
      req.query;
    const opts = { folder_id, search, favorites, tags, sort, limit, offset, archived };
    try {
      const result = bookmarkModel.listBookmarks(db, req.user.id, opts);
      if (result.total !== undefined) {
        result.bookmarks.forEach((b) => {
          b.tags_detailed = parseTagsDetailed(b.tags_detailed);
        });
        return res.json({
          bookmarks: result.bookmarks,
          total: result.total,
          limit: parseInt(limit) || undefined,
          offset: parseInt(offset) || 0,
        });
      }
      result.bookmarks.forEach((b) => {
        b.tags_detailed = parseTagsDetailed(b.tags_detailed);
      });
      res.json(result.bookmarks);
    } catch (err) {
      console.error("Error listing bookmarks:", err);
      res.status(500).json({ error: "Failed to list bookmarks" });
    }
  });

  // Get single bookmark
  app.get("/api/bookmarks/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      const bookmark = bookmarkModel.getBookmarkById(
        db,
        req.user.id,
        req.params.id,
      );
      if (!bookmark)
        return res.status(404).json({ error: "Bookmark not found" });
      bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
      res.json(bookmark);
    } catch (err) {
      console.error("Error fetching bookmark:", err);
      res.status(500).json({ error: "Failed to fetch bookmark" });
    }
  });

  // Fetch metadata
  app.post(
    "/api/bookmarks/fetch-metadata",
    authenticateTokenMiddleware,
    async (req, res) => {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });
      try {
        const urlObj = new URL(url);
        if (!["http:", "https:"].includes(urlObj.protocol))
          return res.status(400).json({ error: "Invalid URL protocol" });
        if (config.NODE_ENV === "production" && (await isPrivateAddress(url)))
          return res
            .status(403)
            .json({ error: "Cannot fetch metadata from private addresses" });
        const metadata = await fetchUrlMetadata(url);
        res.json(metadata);
      } catch (err) {
        try {
          res.json({ title: new URL(url).hostname, description: "", url });
        } catch (e) {
          res.status(500).json({ error: "Failed to fetch metadata" });
        }
      }
    },
  );

  // Create bookmark
  app.post("/api/bookmarks", authenticateTokenMiddleware, (req, res) => {
    const { title, url, description, folder_id, tags, color } = req.body;
    const id = uuidv4();
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
      const maxPos = db
        .prepare("SELECT MAX(position) as max FROM bookmarks WHERE user_id = ?")
        .get(req.user.id);
      const position = (maxPos.max || 0) + 1;
      const faviconUrl = null;
      const contentType = detectContentType(url);

      bookmarkModel.createBookmark(db, {
        id,
        user_id: req.user.id,
        folder_id,
        title: title || url,
        url,
        description,
        favicon: faviconUrl,
        position,
        content_type: contentType,
        color: color || null,
      });

      if (tags && tags.trim()) {
        const tagResult = ensureTagsExist(db, req.user.id, tags, {
          returnMap: true,
        });
        const overrides = normalizeTagColorOverrides(
          req.body.tag_colors || req.body.tagColorOverrides,
          tagResult.tagMap,
        );
        updateBookmarkTags(db, id, tagResult.tagIds, {
          colorOverridesByTagId: overrides,
        });
      }

      fetchFaviconWrapper(url, id).catch(console.error);

      const bookmark = bookmarkModel.getBookmarkById(db, req.user.id, id);
      bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
      res.json(bookmark);
    } catch (err) {
      console.error("Error creating bookmark:", err);
      res.status(500).json({ error: "Failed to create bookmark" });
    }
  });

  // Track click
  app.post(
    "/api/bookmarks/:id/click",
    authenticateTokenMiddleware,
    (req, res) => {
      try {
        bookmarkModel.incrementClick(db, req.params.id, req.user.id);
        res.json({ success: true });
      } catch (err) {
        console.error("Error incrementing click:", err);
        res.status(500).json({ error: "Failed to update click count" });
      }
    },
  );
}

module.exports = {
  fetchUrlMetadata,
  detectContentType,
  parseTagsDetailed,
  normalizeTagColorOverrides,
};
