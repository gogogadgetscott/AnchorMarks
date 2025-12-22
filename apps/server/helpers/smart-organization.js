/**
 * Smart Organization core logic moved to helpers folder
 */
const DOMAIN_CATEGORIES = {
  "github.com": {
    tags: ["github", "development", "code", "opensource", "repository"],
    category: "development",
    priority: 0.95,
  },
  "stackoverflow.com": {
    tags: ["stackoverflow", "reference", "code-help", "qa", "programming"],
    category: "reference",
    priority: 0.92,
  },
  "medium.com": {
    tags: ["medium", "articles", "reading", "tech-blogs", "learning"],
    category: "content",
    priority: 0.85,
  },
  "dev.to": {
    tags: ["dev.to", "articles", "tutorials", "development", "learning"],
    category: "content",
    priority: 0.85,
  },
  "hashnode.com": {
    tags: ["hashnode", "articles", "tutorials", "development", "learning"],
    category: "content",
    priority: 0.85,
  },
  "docs.python.org": {
    tags: ["python", "documentation", "reference", "official"],
    category: "documentation",
    priority: 0.95,
  },
  "nodejs.org": {
    tags: ["nodejs", "javascript", "documentation", "reference", "backend"],
    category: "documentation",
    priority: 0.95,
  },
  "docker.com": {
    tags: ["docker", "devops", "containerization", "deployment"],
    category: "devops",
    priority: 0.9,
  },
  "kubernetes.io": {
    tags: ["kubernetes", "devops", "orchestration", "deployment"],
    category: "devops",
    priority: 0.9,
  },
  "npmjs.com": {
    tags: ["npm", "javascript", "packages", "nodejs", "libraries"],
    category: "development",
    priority: 0.88,
  },
  "pypi.org": {
    tags: ["pypi", "python", "packages", "libraries"],
    category: "development",
    priority: 0.88,
  },
  "youtube.com": {
    tags: ["youtube", "video", "tutorial", "learning", "educational"],
    category: "content",
    priority: 0.75,
  },
  "udemy.com": {
    tags: ["udemy", "course", "learning", "tutorial", "educational"],
    category: "learning",
    priority: 0.8,
  },
  "coursera.org": {
    tags: ["coursera", "course", "learning", "educational", "certification"],
    category: "learning",
    priority: 0.8,
  },
  "reddit.com": {
    tags: ["reddit", "discussion", "community", "forum"],
    category: "community",
    priority: 0.7,
  },
  "hackernews.com": {
    tags: ["hackernews", "news", "tech-news", "discussion", "community"],
    category: "news",
    priority: 0.8,
  },
  "twitter.com": {
    tags: ["twitter", "social", "news", "discussion"],
    category: "social",
    priority: 0.65,
  },
  "wikipedia.org": {
    tags: ["wikipedia", "reference", "knowledge", "educational"],
    category: "reference",
    priority: 0.85,
  },
  "mdn.mozilla.org": {
    tags: [
      "mdn",
      "documentation",
      "web",
      "javascript",
      "css",
      "html",
      "reference",
    ],
    category: "documentation",
    priority: 0.95,
  },
  "aws.amazon.com": {
    tags: ["aws", "cloud", "devops", "infrastructure"],
    category: "cloud",
    priority: 0.9,
  },
  "azure.microsoft.com": {
    tags: ["azure", "cloud", "devops", "microsoft"],
    category: "cloud",
    priority: 0.9,
  },
  "gcp.google.com": {
    tags: ["gcp", "cloud", "devops", "google"],
    category: "cloud",
    priority: 0.9,
  },
  "linkedin.com": {
    tags: ["linkedin", "professional", "networking", "social"],
    category: "professional",
    priority: 0.7,
  },
};

function getDomainCategory(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.replace(/^www\./, "");
    if (DOMAIN_CATEGORIES[hostname]) return DOMAIN_CATEGORIES[hostname];
    const parts = hostname.split(".");
    for (let i = 0; i < parts.length; i++) {
      const variant = parts.slice(i).join(".");
      if (DOMAIN_CATEGORIES[variant]) return DOMAIN_CATEGORIES[variant];
    }
    return { tags: [hostname.split(".")[0]], category: "web", priority: 0.6 };
  } catch {
    return { tags: [], category: "unknown", priority: 0.3 };
  }
}

function getDomainScore(db, userId, domain, tag) {
  try {
    const domainBookmarks = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND url LIKE ?`,
      )
      .get(userId, `%${domain}%`);
    if (!domainBookmarks.count) return 0;
    const taggedCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks b JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id WHERE b.user_id = ? AND b.url LIKE ? AND t.name = ?`,
      )
      .get(userId, `%${domain}%`, tag);
    const frequency = taggedCount.count / domainBookmarks.count;
    const scale = Math.min(domainBookmarks.count / 100, 1.0);
    return frequency * scale;
  } catch {
    return 0;
  }
}

function getActivityScore(db, userId, tag, days = 7) {
  try {
    const recentQuery = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND datetime(created_at) > datetime('now', ? || ' days')`,
      )
      .get(userId, -days);
    if (!recentQuery.count) return 0;
    const recentTagged = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks b JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id WHERE b.user_id = ? AND t.name = ? AND datetime(b.created_at) > datetime('now', ? || ' days')`,
      )
      .get(userId, tag, -days);
    const frequency = recentTagged.count / recentQuery.count;
    const recencyBoost = days <= 7 ? 1.2 : days <= 14 ? 0.9 : 0.5;
    return Math.min(frequency * recencyBoost, 1.0);
  } catch {
    return 0;
  }
}

function tokenizeText(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-/]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && t.length < 30);
}

function getSimilarityScore(db, userId, url, tag) {
  try {
    const tokens = tokenizeText(url);
    if (!tokens.length) return 0;
    const similarBookmarks = db
      .prepare(
        `SELECT b.id, b.title, b.url, COALESCE(tags_joined.tags, '') as tags FROM bookmarks b LEFT JOIN ( SELECT bt.bookmark_id, GROUP_CONCAT(t.name, ', ') as tags FROM bookmark_tags bt JOIN tags t ON t.id = bt.tag_id WHERE t.user_id = ? GROUP BY bt.bookmark_id ) tags_joined ON tags_joined.bookmark_id = b.id WHERE b.user_id = ? LIMIT 100`,
      )
      .all(userId, userId);
    let matchCount = 0;
    let tagCount = 0;
    similarBookmarks.forEach((bm) => {
      const bmTokens = tokenizeText(`${bm.title || ""} ${bm.url || ""}`);
      const matches = tokens.filter((t) => bmTokens.includes(t));
      if (matches.length > 0) {
        matchCount++;
        const tagTokens = (bm.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        if (tagTokens.includes(tag.toLowerCase())) tagCount++;
      }
    });
    if (!matchCount) return 0;
    const tagFrequency = tagCount / matchCount;
    const logBoost = Math.log(tagCount + 1);
    return Math.min((tagFrequency * logBoost) / 10, 1.0);
  } catch {
    return 0;
  }
}

function calculateTagScore(db, userId, url, tag, weights = {}) {
  const w = {
    domain: weights.domain ?? 0.35,
    activity: weights.activity ?? 0.4,
    similarity: weights.similarity ?? 0.25,
  };
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, "");
    const domainScore = getDomainScore(db, userId, domain, tag);
    const activityScore = getActivityScore(db, userId, tag, 7);
    const similarityScore = getSimilarityScore(db, userId, url, tag);
    const totalScore =
      domainScore * w.domain +
      activityScore * w.activity +
      similarityScore * w.similarity;
    return {
      score: Math.min(totalScore, 1.0),
      domainScore,
      activityScore,
      similarityScore,
      sources: {
        domain: domainScore > 0.1,
        activity: activityScore > 0.1,
        similarity: similarityScore > 0.1,
      },
    };
  } catch {
    return {
      score: 0,
      domainScore: 0,
      activityScore: 0,
      similarityScore: 0,
      sources: {},
    };
  }
}

function getTopSource(scores) {
  if (
    scores.domainScore >= scores.activityScore &&
    scores.domainScore >= scores.similarityScore
  )
    return "domain";
  else if (scores.activityScore >= scores.similarityScore) return "activity";
  return "similar";
}

function generateReason(tag, domain, scores, db, userId) {
  const source = getTopSource(scores);
  if (source === "domain") {
    const domainBookmarks = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND url LIKE ?`,
      )
      .get(userId, `%${domain}%`);
    if (!domainBookmarks.count) return `No bookmarks found for ${domain}`;
    const taggedCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks b JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id WHERE b.user_id = ? AND b.url LIKE ? AND t.name = ?`,
      )
      .get(userId, `%${domain}%`, tag);
    const percent = Math.round(
      (taggedCount.count / domainBookmarks.count) * 100,
    );
    return `${percent}% of ${domain} bookmarks use this tag`;
  } else if (source === "activity") {
    const recentTagged = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks b JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id WHERE b.user_id = ? AND t.name = ? AND datetime(b.created_at) > datetime('now', '-7 days')`,
      )
      .get(userId, tag);
    return `Added ${recentTagged.count} bookmarks with this tag in the last 7 days`;
  } else {
    return `Similar to other bookmarks you've tagged with "${tag}"`;
  }
}

function getDomainStats(db, userId, domain) {
  try {
    const bookmarkCount = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND url LIKE ?`,
      )
      .get(userId, `%${domain}%`).count;
    const distribution = db
      .prepare(
        `SELECT t.name as tag, COUNT(bt.bookmark_id) as count FROM bookmarks b JOIN bookmark_tags bt ON bt.bookmark_id = b.id JOIN tags t ON t.id = bt.tag_id WHERE b.user_id = ? AND b.url LIKE ? GROUP BY t.id ORDER BY count DESC LIMIT 10`,
      )
      .all(userId, `%${domain}%`);
    return { domain, bookmarkCount, tagDistribution: distribution };
  } catch {
    return { domain, bookmarkCount: 0, tagDistribution: {} };
  }
}

function getTagClusters(db, userId) {
  try {
    const tagCooccurrence = db
      .prepare(
        `SELECT tag_id, COUNT(*) as count FROM bookmark_tags WHERE bookmark_id IN ( SELECT id FROM bookmarks WHERE user_id = ? ) GROUP BY tag_id ORDER BY count DESC LIMIT 100`,
      )
      .all(userId);
    const tagNames = {};
    const tags = db
      .prepare(`SELECT id, name FROM tags WHERE user_id = ?`)
      .all(userId);
    tags.forEach((tag) => {
      tagNames[tag.id] = tag.name;
    });
    const clusters = [];
    const categories = {};
    tagCooccurrence.forEach((row) => {
      const tagName = tagNames[row.tag_id];
      if (!tagName) return;
      let category = "other";
      if (
        tagName.includes("react") ||
        tagName.includes("vue") ||
        tagName.includes("angular")
      )
        category = "frontend";
      else if (
        tagName.includes("docker") ||
        tagName.includes("k8s") ||
        tagName.includes("devops")
      )
        category = "devops";
      else if (
        tagName.includes("python") ||
        tagName.includes("javascript") ||
        tagName.includes("java")
      )
        category = "language";
      else if (
        tagName.includes("tutorial") ||
        tagName.includes("learning") ||
        tagName.includes("course")
      )
        category = "learning";
      if (!categories[category]) categories[category] = [];
      categories[category].push(tagName);
    });
    Object.entries(categories).forEach(([category, tagList]) => {
      if (tagList.length > 1) {
        clusters.push({
          name: `${category.charAt(0).toUpperCase() + category.slice(1)} Topics`,
          type: "tag_cluster",
          tags: tagList,
          category,
          bookmark_count:
            db
              .prepare(
                `SELECT COUNT(DISTINCT bookmark_id) as count FROM bookmark_tags WHERE tag_id IN ( SELECT id FROM tags WHERE user_id = ? AND name IN (${tagList.map(() => "?").join(",")}) )`,
              )
              .get(userId, ...tagList).count || 0,
          reason: `Group of ${tagList.length} related tags`,
          rules: { tags: tagList },
        });
      }
    });
    return clusters.sort((a, b) => b.bookmarkCount - a.bookmarkCount);
  } catch {
    return [];
  }
}

function getActivityCollections(db, userId) {
  try {
    const collections = [];
    const recent7 = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND datetime(created_at) > datetime('now', '-7 days')`,
      )
      .get(userId).count;
    if (recent7 > 0)
      collections.push({
        name: "Recent Bookmarks (7 days)",
        type: "activity",
        icon: "clock",
        color: "#f59e0b",
        filters: { addedWithinDays: 7 },
        bookmark_count: recent7,
        reason: `${recent7} bookmarks added in the last 7 days`,
      });
    const frequentlyUsed = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 5`,
      )
      .get(userId).count;
    if (frequentlyUsed > 0)
      collections.push({
        name: "Frequently Used",
        type: "activity",
        icon: "trending-up",
        color: "#10b981",
        filters: { clickCountMinimum: 5 },
        bookmark_count: frequentlyUsed,
        reason: `${frequentlyUsed} bookmarks clicked more than 5 times`,
      });
    const unread = db
      .prepare(
        `SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count = 0 AND datetime(created_at) < datetime('now', '-7 days')`,
      )
      .get(userId).count;
    if (unread > 0)
      collections.push({
        name: "Unread",
        type: "activity",
        icon: "eye-off",
        color: "#6b7280",
        filters: { unread: true },
        bookmark_count: unread,
        reason: `${unread} bookmarks you haven't clicked yet`,
      });
    return collections;
  } catch {
    return [];
  }
}

function getDomainCollections(db, userId) {
  try {
    const collections = [];
    const topDomains = db
      .prepare(
        `SELECT SUBSTR(url, INSTR(url, '://') + 3, INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1) as domain, COUNT(*) as count FROM bookmarks WHERE user_id = ? GROUP BY domain ORDER BY count DESC LIMIT 5`,
      )
      .all(userId);
    topDomains.forEach((row) => {
      const domain = row.domain.replace(/^www\./, "");
      const category = getDomainCategory(`https://${domain}`);
      collections.push({
        name: `${domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1)} Resources`,
        type: "domain",
        icon: "link",
        color: "#6366f1",
        domain,
        bookmark_count: row.count,
        category: category.category,
        reason: `${row.count} bookmarks from ${domain}`,
      });
    });
    return collections;
  } catch {
    return [];
  }
}

module.exports = {
  getDomainCategory,
  getDomainScore,
  getActivityScore,
  getSimilarityScore,
  calculateTagScore,
  generateReason,
  getDomainStats,
  getTagClusters,
  getActivityCollections,
  getDomainCollections,
  tokenizeText,
  getTopSource,
  DOMAIN_CATEGORIES,
};
