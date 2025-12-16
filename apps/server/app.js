const path = require("path");
// Load environment from repository `apps/.env` explicitly so running from
// project root still picks up the correct file.
const _envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: _envPath, quiet: true });
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const https = require("https");
const fs = require("fs");
const helmet = require("helmet");
const smartOrg = require("./smart-organization");
const aiTags = require("./ai-tags");
const { v4: uuidv4 } = require("uuid");

const config = require("./config");
const { initializeDatabase, ensureDirectories } = require("./models/db");
const { authenticateToken, validateCsrfToken } = require("./middleware");
const { setupAuthRoutes } = require("./routes/auth");
const { isPrivateAddress, fetchFavicon } = require("./utils");
const {
  ensureTagsExist,
  updateBookmarkTags,
  getUserTags,
  getBookmarkTagsString,
} = require("./tag-helpers");

const app = express();
config.validateSecurityConfig();

// Initialize database
const db = initializeDatabase(config.DB_PATH);
const { FAVICONS_DIR, THUMBNAILS_DIR } = ensureDirectories();

// Middleware functions
const authenticateTokenMiddleware = authenticateToken(db);
const validateCsrfTokenMiddleware = validateCsrfToken(db);

// Favicon fetch function
const fetchFaviconWrapper = (url, bookmarkId) =>
  fetchFavicon(url, bookmarkId, db, FAVICONS_DIR, config.NODE_ENV);

// Background jobs and thumbnail cache are handled in background.js
const { createBackgroundJobs } = require("./background");
const bg = createBackgroundJobs({ db, ensureDirectories, fetchFavicon: fetchFaviconWrapper, isPrivateAddress, config });

// ============== THUMBNAIL CACHING ==============

// Cache for in-progress thumbnail fetches
const thumbnailFetchQueue = new Map();

async function cacheThumbnail(url, bookmarkId) {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) return null;

    // Block private/loopback targets in production to avoid SSRF
    if (config.NODE_ENV === "production" && (await isPrivateAddress(url))) {
      return null;
    }

    const domain = urlObj.hostname;
    const thumbnailFilename = `${bookmarkId.substring(0, 8)}_${domain.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
    const localPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    const publicPath = `/thumbnails/${thumbnailFilename}`;

    // Check if already cached locally
    if (fs.existsSync(localPath)) {
      bookmarkModel.setThumbnailLocal(db, bookmarkId, publicPath);
      return publicPath;
    }

    // Check if already being fetched (deduplicate)
    if (thumbnailFetchQueue.has(bookmarkId)) {
      return thumbnailFetchQueue.get(bookmarkId);
    }

    // Simple service: Store as a placeholder for now
    // In a production system, you would use a headless browser like Puppeteer
    // to capture actual website screenshots
    const fetchPromise = new Promise((resolve) => {
      // For now, just store a placeholder indicating thumbnails can be added
      // Real implementation would use screenshot/favicon service
      bookmarkModel.setThumbnailLocal(db, bookmarkId, null);
      thumbnailFetchQueue.delete(bookmarkId);
      resolve(null);
    });

    thumbnailFetchQueue.set(bookmarkId, fetchPromise);
    return fetchPromise;
  } catch (err) {
    console.error("Thumbnail cache error:", err);
    return null;
  }
}

// ============== MIDDLEWARE ==============

// Security headers for production
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
    "https://r2cdn.perplexity.ai",
  ],
  imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

if (config.NODE_ENV === "production") {
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}

// CORS configuration
const corsOptions = {
  origin: config.resolveCorsOrigin(),
  credentials: true,
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
};
app.use(cors(corsOptions));
app.use(cookieParser());

// Rate limiting for API
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per minute

function rateLimiter(req, res, next) {
  if (config.NODE_ENV !== "production") return next();

  const key = req.ip;
  const now = Date.now();

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  } else {
    const record = requestCounts.get(key);
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + RATE_LIMIT_WINDOW;
    } else {
      record.count++;
      if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: "Too many requests" });
      }
    }
  }
  next();
}

app.use("/api", rateLimiter);
app.use(express.json({ limit: "10mb" }));

// Request logging (must be before express.static; static can end the response and skip later middleware)
app.use((req, res, next) => {
  if (config.NODE_ENV === "development") {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  }
  next();
});

// Extract middleware setup into middleware.js
const { setupMiddleware } = require("./middleware");
setupMiddleware(app, { config, validateCsrfTokenMiddleware });

// local helpers
function generateCsrfToken() {
  return uuidv4().replace(/-/g, "");
}

// Delegate API route registration to routes/api.js for clarity
const { setupApiRoutes } = require("./routes/api");
setupApiRoutes(app, db, {
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  fetchFaviconWrapper,
  config,
});

// GET /api/tags/suggest-ai - AI-powered tag suggestions for a URL
app.get(
  "/api/tags/suggest-ai",
  authenticateTokenMiddleware,
  async (req, res) => {
    const { url, limit = 10 } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL parameter required" });
    }

    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    try {
      const userTags = getUserTags(db, req.user.id).map((t) => t.name);

      const aiConfig = config.getAIConfig
        ? config.getAIConfig()
        : { provider: "none" };
      const suggestions = await aiTags.suggestTagsAI(
        { url, title: null, limit: parseInt(limit), userTags },
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
        return res.status(501).json({ error: err.message });
      }
      console.error("AI tag suggestions error:", err);
      return res.status(500).json({ error: "Failed to get AI suggestions" });
    }
  },
);

// Update user settings
app.put(
  "/api/settings",
  authenticateTokenMiddleware,
  validateCsrfTokenMiddleware,
  (req, res) => {
    try {
      const {
        view_mode,
        hide_favicons,
        hide_sidebar,
        ai_suggestions_enabled,
        theme,
        dashboard_mode,
        dashboard_tags,
        dashboard_sort,
        widget_order,
        dashboard_widgets,
        collapsed_sections,
        include_child_bookmarks,
      } = req.body;

      // Upsert settings via model
      userSettingsModel.upsertUserSettings(db, req.user.id, req.body);

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating settings:", err);
      res.status(500).json({ error: "Failed to update settings" });
    }
  },
);

// ============== DASHBOARD VIEWS =============

const dashboardModel = require('./models/dashboard');
const bookmarkViewModel = require('./models/bookmarkView');
const userSettingsModel = require('./models/userSettings');
const smartCollectionsModel = require('./models/smartCollections');
const syncModel = require('./models/sync');
const importExportModel = require('./models/importExport');
const quickSearchModel = require('./models/quickSearch');
const statsModel = require('./models/stats');
const bookmarkModel = require('./models/bookmark');
const tagHelpersLocal = require('./helpers/tags');
const { parseTags, mergeTags, stringifyTags, parseTagsDetailed, normalizeTagColorOverrides } = tagHelpersLocal;
// Route groups are delegated to route modules under apps/server/routes/
const setupDashboardRoutes = require('./routes/dashboard');
const setupBookmarkViewsRoutes = require('./routes/bookmarkViews');
const setupCollectionsRoutes = require('./routes/collections');
const setupBookmarksRoutes = require('./routes/bookmarks');

setupDashboardRoutes(app, db, { authenticateTokenMiddleware, validateCsrfTokenMiddleware });
setupBookmarkViewsRoutes(app, db, { authenticateTokenMiddleware, validateCsrfTokenMiddleware });
setupCollectionsRoutes(app, db, { authenticateTokenMiddleware });
setupBookmarksRoutes(app, db, { authenticateTokenMiddleware, validateCsrfTokenMiddleware, fetchFaviconWrapper, config });

const { fetchUrlMetadata, detectContentType } = require('./helpers/metadata');
const { parseHtmlMetadata, decodeHtmlEntities, generateBookmarkHtml } = require('./helpers/html');
const { parseBookmarkHtml } = require('./helpers/import');

// Parse HTML for metadata
function parseHtmlMetadata(html, url) {
  const metadata = {
    title: "",
    description: "",
    url: url,
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    metadata.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Extract meta description
  const descMatch =
    html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (descMatch) {
    metadata.description = decodeHtmlEntities(descMatch[1].trim());
  }

  // Try Open Graph tags
  const ogTitleMatch =
    html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(ogTitleMatch[1].trim());
  }

  const ogDescMatch =
    html.match(
      /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i,
    );
  if (ogDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(ogDescMatch[1].trim());
  }

  // Try Twitter Card tags
  const twitterTitleMatch =
    html.match(
      /<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:title["']/i,
    );
  if (twitterTitleMatch && !metadata.title) {
    metadata.title = decodeHtmlEntities(twitterTitleMatch[1].trim());
  }

  const twitterDescMatch =
    html.match(
      /<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:description["']/i,
    );
  if (twitterDescMatch && !metadata.description) {
    metadata.description = decodeHtmlEntities(twitterDescMatch[1].trim());
  }

  // Fallback to hostname if no title found
  if (!metadata.title) {
    try {
      metadata.title = new URL(url).hostname;
    } catch {
      metadata.title = url;
    }
  }

  return metadata;
}

// Decode common HTML entities
function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&nbsp;": " ",
  };
  return text.replace(/&[a-z0-9#]+;/gi, (match) => entities[match] || match);
}

// Create bookmark
app.post('/api/bookmarks', authenticateTokenMiddleware, async (req, res) => {
  const { title, url, description, folder_id, tags } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const contentType = detectContentType(url);
    const created = bookmarkModel.createBookmark(db, req.user.id, { title: title || url, url, description, folder_id, content_type: contentType });

    // Handle tags via normalized bookmark_tags table
    if (tags && tags.trim()) {
      const tagResult = ensureTagsExist(db, req.user.id, tags, { returnMap: true });
      const overrides = normalizeTagColorOverrides(req.body.tag_colors || req.body.tagColorOverrides, tagResult.tagMap);
      updateBookmarkTags(db, created.id, tagResult.tagIds, { colorOverridesByTagId: overrides });
    }

    // Trigger async favicon fetch
    fetchFaviconWrapper(url, created.id).catch(console.error);

    const bookmark = bookmarkModel.getBookmarkById(db, req.user.id, created.id);
    bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
    res.json(bookmark);
  } catch (err) {
    console.error('Error creating bookmark:', err);
    res.status(500).json({ error: 'Failed to create bookmark' });
  }
});

// Detect content type from URL
function detectContentType(url) {
  try {
    const urlLower = url.toLowerCase();
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Video platforms
    if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("vimeo.com") ||
      hostname.includes("dailymotion.com") ||
      hostname.includes("twitch.tv")
    ) {
      return "video";
    }

    // Social/tweets
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return "tweet";
    }

    // PDF
    if (pathname.endsWith(".pdf")) {
      return "pdf";
    }

    // Images
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathname)) {
      return "image";
    }

    // GitHub
    if (hostname.includes("github.com")) {
      return "repo";
    }

    // News/articles
    if (
      hostname.includes("medium.com") ||
      hostname.includes("dev.to") ||
      hostname.includes("substack.com") ||
      hostname.includes("hackernews") ||
      hostname.includes("reddit.com")
    ) {
      return "article";
    }

    // Documentation
    if (
      hostname.includes("docs.") ||
      pathname.includes("/docs/") ||
      pathname.includes("/documentation/")
    ) {
      return "docs";
    }

    // Default
    return "link";
  } catch (e) {
    return "link";
  }
}

// Tag helpers
// Shared tag helpers are provided by apps/server/helpers/tags.js

// Update bookmark
app.put('/api/bookmarks/:id', authenticateTokenMiddleware, (req, res) => {
  try {
    const fields = req.body;
    const updated = bookmarkModel.updateBookmark(db, req.user.id, req.params.id, fields);

    if (fields.tags !== undefined) {
      if (fields.tags && fields.tags.trim && fields.tags.trim()) {
        const tagResult = ensureTagsExist(db, req.user.id, fields.tags, { returnMap: true });
        const overrides = normalizeTagColorOverrides(fields.tag_colors || fields.tagColorOverrides, tagResult.tagMap);
        updateBookmarkTags(db, req.params.id, tagResult.tagIds, { colorOverridesByTagId: overrides });
      } else {
        updateBookmarkTags(db, req.params.id, []);
      }
    }

    const bookmark = bookmarkModel.getBookmarkById(db, req.user.id, req.params.id);
    bookmark.tags_detailed = parseTagsDetailed(bookmark.tags_detailed);
    res.json(bookmark);
  } catch (err) {
    console.error('Error updating bookmark:', err);
    res.status(500).json({ error: 'Failed to update bookmark' });
  }
});

// Refresh favicon for a bookmark
app.post(
  "/api/bookmarks/:id/refresh-favicon",
  authenticateTokenMiddleware,
  async (req, res) => {
      const bookmark = bookmarkModel.getBookmarkById(db, req.user.id, req.params.id);
      if (!bookmark) return res.status(404).json({ error: 'Bookmark not found' });

      // Reset local favicon to trigger re-fetch
      bookmarkModel.updateBookmark(db, req.user.id, bookmark.id, { favicon: null });

      const newFavicon = await fetchFaviconWrapper(bookmark.url, bookmark.id);
      res.json({ favicon: newFavicon });
  },
);

// Delete bookmark
app.delete('/api/bookmarks/:id', authenticateTokenMiddleware, (req, res) => {
  try {
    bookmarkModel.deleteBookmark(db, req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting bookmark:', err);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

// ============== TAG ROUTES ==============

// Suggest tags from URL/domain and prior usage
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

    // Fetch a slice of bookmarks for TF-IDF style scoring
    const bookmarkModel = require('./models/bookmark');
    const allRows = bookmarkModel.getSampleForSuggestion(db, req.user.id, 800);

    // Existing tags on same domain + compute doc frequencies for title terms
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
        } catch {
          /* ignore */
        }
      }

      // TF-IDF style weights from titles
      const tfCounts = {};
      tokenizer(row.title).forEach((tok) => {
        tfCounts[tok] = (tfCounts[tok] || 0) + 1;
      });
      Object.entries(tfCounts).forEach(([tok, tf]) => {
        const df = docFreq[tok] || 1;
        const idf = Math.log((totalDocs + 1) / (df + 1)) + 1; // smoothed
        const weight = tf * idf;
        if (urlMatch) bump(tok, weight * 1.2);
        else bump(tok, weight * 0.6);
      });
    });

    // Domain-derived keywords
    const stopwords = new Set(["www", "com", "net", "org", "app", "io", "dev"]);
    hostname.split(".").forEach((part) => {
      if (part && part.length > 2 && !stopwords.has(part)) bump(part, 1.5);
    });

    // Path-derived keywords
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
    res.json([]);
  }
});

// Tag analytics and co-occurrence
app.get("/api/tags/analytics", authenticateTokenMiddleware, (req, res) => {
  try {
    const tagHelpers = require('./tag-helpers');
    const tags = tagHelpers.getTagUsageCounts(db, req.user.id);
    const cooccurrence = tagHelpers.getTagCooccurrence(db, req.user.id);

    res.json({ success: true, tags, cooccurrence });
  } catch (err) {
    console.error("Tag analytics error:", err);
    res.status(500).json({ error: "Failed to compute tag analytics" });
  }
});

// Bulk add tags to bookmarks
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
    const current = getBookmarkTagsString(db, id);
    const merged = mergeTags(current, normalizedTags);
    const tagsString = stringifyTags(merged);
    const tagIds = ensureTagsExist(db, req.user.id, tagsString);
    updateBookmarkTags(db, id, tagIds);
    updated.push(id);
  });

  res.json({ updated });
});

// Bulk remove tags from bookmarks
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
    const current = getBookmarkTagsString(db, id);
    if (!current) {
      updateBookmarkTags(db, id, []);
      return;
    }
    const filtered = parseTags(current).filter(
      (t) => !removeSet.has(t.toLowerCase()),
    );
    const tagsString = filtered.length ? stringifyTags(filtered) : null;

    if (tagsString) {
      const tagIds = ensureTagsExist(db, req.user.id, tagsString);
      updateBookmarkTags(db, id, tagIds);
    } else {
      updateBookmarkTags(db, id, []);
    }

    updated.push(id);
  });

  res.json({ updated });
});

// Rename/merge a tag across all bookmarks
app.post('/api/tags/rename', authenticateTokenMiddleware, (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  try {
    const result = require('./tag-helpers').renameOrMergeTag(db, req.user.id, from, to);
    if (result.error === 'not_found') return res.status(404).json({ error: 'Tag not found' });
    res.json({ updated: result.updated });
  } catch (err) {
    console.error('Tag rename error:', err);
    res.status(500).json({ error: 'Failed to rename/merge tag' });
  }
});

// Track bookmark click
app.post(
  "/api/bookmarks/:id/click",
  authenticateTokenMiddleware,
  (req, res) => {
    try {
      bookmarkModel.incrementClick(db, req.user.id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error('Error incrementing click:', err);
      res.status(500).json({ error: 'Failed to update click count' });
    }
  },
);

// ============== IMconfig.PORT/EXconfig.PORT ROUTES ==============

app.post('/api/import/html', authenticateTokenMiddleware, (req, res) => {
  try {
    const { html } = req.body;
    // parseBookmarkHtml currently returns parsed items but also performed inserts.
    // For now, keep parsing in-app but store parsed objects then delegate DB work to model.
    const parsed = parseBookmarkHtml(html, req.user.id);
    // parsed may already include created ids; if so, return as-is. Otherwise, map to simple objects
    const toImport = parsed.map((p) => ({ title: p.title, url: p.url, description: p.description || null, folder_id: p.folder_id || null, tags: p.tags || null }));
    const result = importExportModel.importJson(db, req.user.id, { bookmarks: toImport, folders: [] });
    // Trigger favicon fetch for created bookmarks
    result.imported.forEach((b) => fetchFaviconWrapper(b.url, b.id).catch(console.error));
    res.json({ imported: result.imported.length, bookmarks: result.imported });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to parse bookmarks' });
  }
});

app.post('/api/import/json', authenticateTokenMiddleware, (req, res) => {
  try {
    const { bookmarks = [], folders = [] } = req.body;
    const result = importExportModel.importJson(db, req.user.id, { bookmarks, folders });
    // Trigger favicon fetch for created bookmarks
    result.imported.forEach((b) => fetchFaviconWrapper(b.url, b.id).catch(console.error));
    res.json({ imported: result.imported.length, bookmarks: result.imported });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to import bookmarks' });
  }
});

app.get('/api/export', authenticateTokenMiddleware, (req, res) => {
  try {
    const { format } = req.query;
    const data = importExportModel.exportData(db, req.user.id);
    data.bookmarks.forEach((b) => { b.tags_detailed = parseTagsDetailed(b.tags_detailed); });
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', 'attachment; filename=anchormarks-bookmarks.html');
      res.send(generateBookmarkHtml(data.bookmarks, data.folders));
    } else {
      res.json({ bookmarks: data.bookmarks, folders: data.folders });
    }
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// ============== SYNC ROUTES ==============

app.get('/api/sync/status', authenticateTokenMiddleware, (req, res) => {
  try {
    res.json(syncModel.getStatus(db, req.user.id));
  } catch (err) {
    console.error('Sync status error:', err);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

app.post('/api/sync/push', authenticateTokenMiddleware, (req, res) => {
  try {
    const { bookmarks, folders } = req.body;
    const results = syncModel.push(db, req.user.id, { bookmarks, folders });

    // Trigger favicon fetch for any created bookmarks if caller included urls
    if (bookmarks && bookmarks.length) {
      for (const bm of bookmarks) {
        if (!bm.url) continue;
        try {
          const id = bookmarkModel.findBookmarkIdByUrl(db, req.user.id, bm.url);
          if (id) fetchFaviconWrapper(bm.url, id).catch(console.error);
        } catch (e) {
          // ignore
        }
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: 'Failed to push sync data' });
  }
});

app.get('/api/sync/pull', authenticateTokenMiddleware, (req, res) => {
  try {
    const data = syncModel.pull(db, req.user.id);
    data.bookmarks.forEach((b) => {
      b.tags_detailed = parseTagsDetailed(b.tags_detailed);
    });
    res.json(data);
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: 'Failed to pull sync data' });
  }
});

// ============== QUICK SEARCH (Flow Launcher) ==============

app.get('/api/quick-search', authenticateTokenMiddleware, (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) {
      const bookmarks = quickSearchModel.listRecent(db, req.user.id, limit);
      return res.json(bookmarks);
    }
    const bookmarks = quickSearchModel.search(db, req.user.id, q, limit);
    res.json(bookmarks);
  } catch (err) {
    console.error('Quick search error:', err);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// ============== STATS ==============

app.get('/api/stats', authenticateTokenMiddleware, (req, res) => {
  try {
    res.json(statsModel.getStats(db, req.user.id));
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to compute stats' });
  }
});

// ============== HEALTH CHECK / CLEANUP ==============

// Find duplicate bookmarks (same URL)
app.get('/api/health/duplicates', authenticateTokenMiddleware, (req, res) => {
  try {
    const dups = statsModel.findDuplicates(db, req.user.id);
    res.json({ total_duplicates: dups.length, duplicates: dups });
  } catch (err) {
    console.error('Duplicates error:', err);
    res.status(500).json({ error: 'Failed to list duplicates' });
  }
});

// Delete duplicate bookmarks (keep the first one)
app.post('/api/health/duplicates/cleanup', authenticateTokenMiddleware, (req, res) => {
  try {
    const result = statsModel.cleanupDuplicates(db, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Cleanup duplicates error:', err);
    res.status(500).json({ error: 'Failed to cleanup duplicates' });
  }
});

// Check for dead links (async - returns job status)
app.get('/api/health/deadlinks', authenticateTokenMiddleware, async (req, res) => {
  try {
    const { check } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    if (check !== 'true') {
      const info = statsModel.getDeadlinksInfo(db, req.user.id, limit);
      return res.json({ dead_links: info.dead_links, unchecked: info.unchecked, bookmarks: info.bookmarks });
    }

    // Run checks
    const result = await statsModel.runDeadlinkChecks(db, req.user.id, limit);
    res.json(result);
  } catch (err) {
    console.error('Deadlinks error:', err);
    res.status(500).json({ error: 'Failed to run deadlink checks' });
  }
});

// Get bookmarks by domain
app.get('/api/bookmarks/by-domain', authenticateTokenMiddleware, (req, res) => {
  try {
    const urls = bookmarkModel.listUrls(db, req.user.id);
    const domainCounts = {};
    urls.forEach((u) => {
      try {
        const domain = new URL(u).hostname.replace('www.', '');
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch (e) {}
    });
    const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([domain, count]) => ({ domain, count }));
    res.json(sorted);
  } catch (err) {
    console.error('Error computing domains:', err);
    res.status(500).json({ error: 'Failed to compute domains' });
  }
});

// ============== EXAMPLE BOOKMARKS ==============

const EXAMPLE_BOOKMARKS = [
  // Productivity
  {
    title: "Google",
    url: "https://www.google.com",
    description: "Search the web",
    tags: "search,productivity",
  },
  {
    title: "Gmail",
    url: "https://mail.google.com",
    description: "Google email service",
    tags: "email,productivity",
  },
  {
    title: "Google Calendar",
    url: "https://calendar.google.com",
    description: "Manage your schedule",
    tags: "calendar,productivity",
  },
  {
    title: "Google Drive",
    url: "https://drive.google.com",
    description: "Cloud storage and collaboration",
    tags: "storage,productivity",
  },
  {
    title: "Notion",
    url: "https://www.notion.so",
    description: "All-in-one workspace",
    tags: "notes,productivity",
  },

  // Development
  {
    title: "GitHub",
    url: "https://github.com",
    description: "Code hosting and collaboration",
    tags: "development,git",
  },
  {
    title: "Stack Overflow",
    url: "https://stackoverflow.com",
    description: "Programming Q&A community",
    tags: "development,help",
  },
  {
    title: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    description: "Web development documentation",
    tags: "development,docs",
  },
  {
    title: "CodePen",
    url: "https://codepen.io",
    description: "Frontend code playground",
    tags: "development,sandbox",
  },

  // Learning
  {
    title: "Wikipedia",
    url: "https://www.wikipedia.org",
    description: "Free encyclopedia",
    tags: "learning,reference",
  },
  {
    title: "YouTube",
    url: "https://www.youtube.com",
    description: "Video streaming platform",
    tags: "learning,entertainment",
  },
  {
    title: "Coursera",
    url: "https://www.coursera.org",
    description: "Online courses and degrees",
    tags: "learning,education",
  },

  // News & Social
  {
    title: "Reddit",
    url: "https://www.reddit.com",
    description: "Social news and discussion",
    tags: "social,news",
  },
  {
    title: "Hacker News",
    url: "https://news.ycombinator.com",
    description: "Tech news and discussion",
    tags: "news,tech",
  },
  {
    title: "Twitter / X",
    url: "https://twitter.com",
    description: "Social microblogging",
    tags: "social,news",
  },
];

// Create example bookmarks for a user
function createExampleBookmarks(userId, folderId = null) {
  const created = [];

  for (let i = 0; i < EXAMPLE_BOOKMARKS.length; i++) {
    const bm = EXAMPLE_BOOKMARKS[i];
    const id = uuidv4();
    const faviconUrl = null;

    const bookmarkModel = require('./models/bookmark');
    // Create bookmark via model so DB logic lives in one place
    const created = bookmarkModel.createBookmark(db, {
      id,
      user_id: userId,
      folder_id: folderId,
      title: bm.title,
      url: bm.url,
      description: bm.description,
      favicon: faviconUrl,
      position: i + 1,
    });

    if (bm.tags) {
      const tagsString = stringifyTags(parseTags(bm.tags));
      const tagIds = ensureTagsExist(db, userId, tagsString);
      updateBookmarkTags(db, created.id, tagIds);
    }

    // Trigger async favicon fetch
    fetchFaviconWrapper(bm.url, created.id).catch(console.error);

    created.push({ id: created.id, ...bm, favicon: faviconUrl, tags: bm.tags });
  }

  return created;
}

// ============== HELPER FUNCTIONS ==============

// const cheerio = require('cheerio'); // Removed as not available
// Since we don't have cheerio, we'll stick to regex/parsing but handle nesting.
// The previous logic flatten import.
// To support nesting, we need to respect the <DL> hierarchy.
// Netscape bookmark file format uses recursive <DL><p><DT><H3>...</H3><DL>...</DL></DT> ... </DL>

function parseBookmarkHtml(html, userId) {
  const imported = [];

  // Using simple regex for flat structure wasn't enough.
  // Let's implement a recursive parser or simulate a DOM parser.
  // Given the constraints and likely input size, a stateful parser is safer.

  // However, writing a full HTML parser in one block is error-prone.
  // Let's refine the regex approach to be recursive if possible, or use a stack-based parser.
  // Or simpler: Use a library if available. Assuming no external libs besides what's in package.json.
  // package.json likely has no cheerio.

  // Let's try a stack-based approach assuming valid Netscape format
  // Tokens: <DT>, <H3>, <A>, <DL>, </DL>

  // Helper to create folder
  function createFolder(name, parentId) {
    const folderModel = require('./models/folder');
    return folderModel.ensureFolder(db, userId, name, parentId);
  }

  // We will simple-parse line by line or tag by tag?
  // Regex-based recursive parser for specific structure:

  // 1. Normalize
  let content = html.replace(/[\r\n]+/g, " ").replace(/>\s+</g, "><");

  // 2. We need to find <DT><H3...>(.*?)</H3>...<DL>(.*?)</DL> pattern and <DT><A...>(.*?)</A> pattern.
  // The previous implementation was too greedy.

  // Let's use a scanning function that processes a string and recursively calls itself for DL blocks

  function parseBlock(blockHtml, currentParentId) {
    // Regex to find items in this block.
    // Items are either <DT><H3>...<DL>...</DL> (Folder) or <DT><A>...</A> (Bookmark)
    // Since regex doesn't support balanced tags easily, this is hard.

    // Alternative: Use 'cheerio' if available? No.
    // Let's use a makeshift parser index-based.

    let i = 0;
    const len = blockHtml.length;

    while (i < len) {
      // Find next <DT>
      const dtIndex = blockHtml.indexOf("<DT>", i);
      if (dtIndex === -1) break;

      i = dtIndex + 4; // Past <DT>

      // Check if it's an H3 (Folder) or A (Bookmark)
      if (blockHtml.startsWith("<H3", i)) {
        // Folder
        const h3End = blockHtml.indexOf("</H3>", i);
        const h3Start = blockHtml.indexOf(">", i) + 1;
        const folderName = blockHtml.substring(h3Start, h3End);

        const dlStart = blockHtml.indexOf("<DL>", h3End);
        const dlEnd = findClosingTag(blockHtml, dlStart, "DL"); // Helpers needed

        if (dlStart !== -1 && dlEnd !== -1) {
          const folderId = createFolder(folderName, currentParentId);
          // Recurse inner DL content
          const innerHtml = blockHtml.substring(dlStart + 4, dlEnd); // +4 skip <p> usually? Netscape adds <p> after DL or inside?
          // Usually <DL><p>...
          parseBlock(innerHtml, folderId);
          i = dlEnd + 5; // Past </DL>
        } else {
          i = h3End + 5;
        }
      } else if (blockHtml.startsWith("<A", i)) {
        // Bookmark
        const aEnd = blockHtml.indexOf("</A>", i);
        const aTagEnd = blockHtml.indexOf(">", i);
        const aHtml = blockHtml.substring(i, aEnd + 4); // Full <A...>...</A>

        // Parse attributes
        const attributes = blockHtml.substring(i, aTagEnd);
        const title = blockHtml.substring(aTagEnd + 1, aEnd);

        // Extract HREF
        const hrefMatch = attributes.match(/HREF="([^"]+)"/i);
        if (hrefMatch) {
          const url = hrefMatch[1];
          // Extract TAGS
          const tagsMatch = attributes.match(/TAGS=["']([^"']+)["']/i);
          const tags = tagsMatch ? tagsMatch[1] : null;

          if (!url.startsWith("javascript:") && !url.startsWith("place:")) {
              const id = uuidv4();
              const faviconUrl = null;
              const tagsString = tags ? stringifyTags(parseTags(tags)) : null;

              const bookmarkModel = require('./models/bookmark');
              const created = bookmarkModel.createBookmark(db, {
                id,
                user_id: userId,
                folder_id: currentParentId,
                title,
                url,
                favicon: faviconUrl,
              });

              if (tagsString) {
                const tagIds = ensureTagsExist(db, userId, tagsString);
                updateBookmarkTags(db, created.id, tagIds);
              }

              fetchFaviconWrapper(url, created.id).catch(console.error);
              imported.push({ id: created.id, title, url, tags: tagsString || null });
          }
        }
        i = aEnd + 4;
      } else {
        i++;
      }
    }
  }

  // Helper to find balancing </DL>
  function findClosingTag(str, start, tagName) {
    let depth = 1;
    let pos = start + tagName.length + 2; // Past <DL>
    const openTag = `<${tagName}`;
    const closeTag = `</${tagName}>`;

    while (depth > 0 && pos < str.length) {
      const nextOpen = str.indexOf(openTag, pos);
      const nextClose = str.indexOf(closeTag, pos);

      if (nextClose === -1) return -1; // Malformed

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTag.length;
      } else {
        depth--;
        pos = nextClose + closeTag.length;
      }
      if (depth === 0) return nextClose;
    }
    return -1;
  }

  // Strip DOCTYPE/HTML wrapper if possible or just search body
  parseBlock(html, null);

  return imported;
}

function generateBookmarkHtml(bookmarks, folders) {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>AnchorMarks Bookmarks</TITLE>
<H1>AnchorMarks Bookmarks</H1>
<DL><p>\n`;

  for (const bm of bookmarks) {
    const tagsAttr = bm.tags ? ` TAGS="${bm.tags}"` : "";
    html += `    <DT><A HREF="${bm.url}"${tagsAttr}>${bm.title}</A>\n`;
  }

  html += `</DL><p>`;
  return html;
}

// ============== SMART ORGANIZATION ENDPOINTS ==============
// Note: Must be BEFORE the catch-all route to prevent interference

// GET /api/tags/suggest-smart - Smart tag suggestions for a URL
app.get("/api/tags/suggest-smart", authenticateTokenMiddleware, (req, res) => {
  const { url, limit = 10 } = req.query;
  const include_domain = req.query.include_domain !== "false";
  const include_activity = req.query.include_activity !== "false";
  const include_similar = req.query.include_similar !== "false";

  if (!url) {
    return res.status(400).json({ error: "URL parameter required" });
  }

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const domain = urlObj.hostname.replace(/^www\./, "");

    // Get domain category info
    const categoryInfo = smartOrg.getDomainCategory(url);
    const domainStats = smartOrg.getDomainStats(db, req.user.id, domain);

    // Collect all possible tags to score
    const tagsToScore = new Set();

    // Add domain category tags
    if (include_domain && categoryInfo.tags) {
      categoryInfo.tags.forEach((t) => tagsToScore.add(t));
    }

    // Add existing tags from user's bookmarks
    const tagHelpers = require('./tag-helpers');
    const userTags = tagHelpers.getUserTags(db, req.user.id).map(t => t.name);
    userTags.forEach((row) => tagsToScore.add(row));

    // Add tags from domain bookmarks
    const domainTags = tagHelpers.getTagsForDomain(db, req.user.id, domain);
    domainTags.forEach((t) => tagsToScore.add(t));

    // Score all tags
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

    // Sort by score and limit
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
});

// GET /api/smart-collections/suggest - Get collection suggestions
app.get(
  "/api/smart-collections/suggest",
  authenticateTokenMiddleware,
  (req, res) => {
    const { type, limit = 5 } = req.query;

    try {
      let suggestions = [];

      // Get tag clusters
      if (!type || type === "tag_cluster") {
        const clusters = smartOrg.getTagClusters(db, req.user.id);
        suggestions = suggestions.concat(clusters.slice(0, 2));
      }

      // Get activity-based collections
      if (!type || type === "activity") {
        const activityCollections = smartOrg.getActivityCollections(
          db,
          req.user.id,
        );
        suggestions = suggestions.concat(activityCollections.slice(0, 2));
      }

      // Get domain-based collections
      if (!type || type === "domain") {
        const domainCollections = smartOrg.getDomainCollections(
          db,
          req.user.id,
        );
        suggestions = suggestions.concat(domainCollections.slice(0, 2));
      }

      // Deduplicate by name and limit
      const seen = new Set();
      const unique = suggestions.filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      });

      res.json({
        collections: unique.slice(0, parseInt(limit)),
      });
    } catch (err) {
      console.error("Smart collections suggest error:", err);
      return res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/smart-collections/create - Create a collection from suggestion
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

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    if (type === "tag_cluster" && (!tags || !tags.length)) {
      return res
        .status(400)
        .json({ error: "Rules are required for tag cluster collections" });
    }

    try {
      const id = uuidv4();

      // Convert to filters object for smart_collections table
      let filterObj = {};

      if (type === "tag_cluster" && tags && tags.length) {
        filterObj = { tags };
      } else if (type === "domain" && domain) {
        filterObj = { domain };
      } else if (type === "activity" && filters) {
        filterObj = filters;
      }

      const created = smartCollectionsModel.createCollection(db, req.user.id, {
        name,
        icon: icon || 'filter',
        color: color || '#6366f1',
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
      res
        .status(500)
        .json({ error: "Failed to create collection: " + err.message });
    }
  },
);

// GET /api/smart-collections/domain-stats - Domain statistics
app.get(
  "/api/smart-collections/domain-stats",
  authenticateTokenMiddleware,
  (req, res) => {
    const { domain } = req.query;

    if (!domain) {
      return res.status(400).json({ error: "Domain parameter required" });
    }

    try {
      const stats = smartOrg.getDomainStats(db, req.user.id, domain);
      const category = smartOrg.getDomainCategory(`https://${domain}`);

        const bookmarkModel = require('./models/bookmark');
        const recentBookmarks = bookmarkModel.getRecentCountForDomain(db, req.user.id, domain);
        const mostClicked = bookmarkModel.getMostClickedForDomain(db, req.user.id, domain, 5);

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

// GET /api/smart-collections/tag-clusters - Get tag clusters
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

// GET /api/smart-insights - Comprehensive insights dashboard
app.get("/api/smart-insights", authenticateTokenMiddleware, (req, res) => {
  try {
    const statsModel = require('./models/stats');
    const top = statsModel.getStats(db, req.user.id);
    const engagement = statsModel.getEngagement(db, req.user.id);
    const lastAdded = statsModel.getLastAdded(db, req.user.id);

    const totalBookmarks = top.total_bookmarks;
    const totalTags = top.total_tags;

    // Top domains
    //     SELECT
    //         REPLACE(REPLACE(url, 'https://', ''), 'http://', '') as full_domain,
    //         COUNT(*) as count
    //     FROM bookmarks
    //     WHERE user_id = ? AND url IS NOT NULL
    //     GROUP BY full_domain
    //     ORDER BY count DESC
    //     LIMIT 5
    // `).all(req.user.id).map(row => ({
    //     domain: row.full_domain ? row.full_domain.split('/')[0].replace(/^www\./, '') : 'unknown',
    //     count: row.count
    // }));

    // Top tags
    // const topTags = db.prepare(`
    //     SELECT name, COUNT(bt.tag_id) as count
    //     FROM tags t
    //     LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
    //     WHERE t.user_id = ?
    //     GROUP BY t.id
    //     ORDER BY count DESC
    //     LIMIT 5
    // `).all(req.user.id);

    // Recent activity
    const thisWeek = totalBookmarks;
    const thisMonth = totalBookmarks;
    const totalClicks = engagement.totalClicks;
    const unread = engagement.unread;
    const frequentlyUsed = engagement.frequentlyUsed;

    // Suggestions
    // const suggestedCollections = smartOrg.getActivityCollections(db, req.user.id).slice(0, 2);
    // const suggestedClusters = smartOrg.getTagClusters(db, req.user.id).slice(0, 2);

    res.json({
      total_bookmarks: totalBookmarks,
      total_tags: totalTags,
      top_domains: [], // topDomains.map(d => ({
      //     domain: d.domain,
      //     count: d.count,
      //     percentage: totalBookmarks > 0 ? Math.round((d.count / totalBookmarks) * 100) : 0
      // })),
      top_tags: [], // topTags.map(t => ({
      //     tag: t.name,
      //     count: t.count,
      //     percentage: totalBookmarks > 0 ? Math.round((t.count / totalBookmarks) * 100) : 0
      // })),
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
      suggestions: {
        create_these_collections: [], // suggestedCollections,
        organize_these_tags: [], // suggestedClusters
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend for all other routes
app.all(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nClosing database connection...");
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nClosing database connection...");
  db.close();
  process.exit(0);
});

// Start server only when executed directly; `server.js` is the preferred entry point.
if (require.main === module) {
  app.listen(config.PORT, config.HOST, () => {
    console.log(`\n╔═════════════════════════════════════════════════════════════════╗`);
    console.log(`║                                                                 ║`);
    console.log(`║   AnchorMarks v1.0.0                                            ║`);
    console.log(`║                                                                 ║`);
    console.log(`║   Server:   http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}                               ║`);
    console.log(`║   API:      http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}/api                           ║`);
    console.log(`║   Mode:     ${config.NODE_ENV.padEnd(52)}║`);
    console.log(`║   Database: ${config.DB_PATH.padEnd(52)}║`);
    console.log(`║                                                                 ║`);
    console.log(`╚═════════════════════════════════════════════════════════════════╝\n`);
  });
}

// Expose helpers for tests
app._isPrivateAddress = isPrivateAddress;
app.db = db;

module.exports = app;
