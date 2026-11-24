const { checkUrlHealth } = require("../services/linkHealthService");
const bookmarkModel = require("./bookmark");
const {
  canonicalizeUrl,
  normalizeTitle,
  similarity,
} = require("../utils/urlCanonicalizer");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../services/tagService");

function getStats(db, userId) {
  const bookmarkStats = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?")
    .get(userId);
  const favoriteCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_favorite = 1",
    )
    .get(userId);
  const folderCount = db
    .prepare("SELECT COUNT(*) as count FROM folders WHERE user_id = ?")
    .get(userId);
  const topClicked = db
    .prepare(
      `
    SELECT title, url, favicon_local as favicon, click_count 
    FROM bookmarks 
    WHERE user_id = ? AND click_count > 0 
    ORDER BY click_count DESC 
    LIMIT 5
  `,
    )
    .all(userId);

  const tagCounts = db
    .prepare(
      `
      SELECT t.name, COUNT(bt.bookmark_id) as count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
    `,
    )
    .all(userId);

  const usedTags = tagCounts.filter((t) => t.count > 0);

  return {
    total_bookmarks: bookmarkStats.count,
    total_folders: folderCount.count,
    total_tags: usedTags.length,
    favorites: favoriteCount.count,
    top_clicked: topClicked,
    top_tags: usedTags
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((t) => [t.name, t.count]),
    monthly_growth: getMonthlyGrowth(db, userId),
    top_domains: getTopDomains(db, userId),
    dead_links: getDeadlinkCount(db, userId),
  };
}

function getMonthlyGrowth(db, userId) {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }

  const monthlyCounts = db
    .prepare(
      `
      SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
      FROM bookmarks
      WHERE user_id = ?
        AND created_at >= date('now', 'start of month', '-5 months')
      GROUP BY month
    `,
    )
    .all(userId);

  const countByMonth = new Map(
    monthlyCounts.map((row) => [row.month, row.count]),
  );

  return months.map((month) => ({
    month,
    count: countByMonth.get(month) || 0,
  }));
}

function getTopDomains(db, userId) {
  // Normalize URL to host (strip protocol); group by host (handle URLs with and without path)
  return db
    .prepare(
      `
      WITH normalized AS (
        SELECT 
          replace(replace(replace(url, 'http://', ''), 'https://', ''), 'www.', '') as raw_domain
        FROM bookmarks
        WHERE user_id = ? AND trim(url) != ''
      ),
      host_only AS (
        SELECT 
          CASE WHEN instr(raw_domain, '/') > 0 
            THEN substr(raw_domain, 1, instr(raw_domain, '/') - 1) 
            ELSE raw_domain 
          END AS domain
        FROM normalized
        WHERE trim(raw_domain) != ''
      )
      SELECT domain, COUNT(*) AS count
      FROM host_only
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 10
    `,
    )
    .all(userId)
    .map((d) => ({ domain: d.domain, count: d.count }));
}

function getDeadlinkCount(db, userId) {
  return db
    .prepare(
      "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_dead = 1",
    )
    .get(userId).count;
}

function findDuplicates(db, userId) {
  const rows = db
    .prepare(
      `SELECT b.*,
              COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tags
       FROM bookmarks b
       LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
       LEFT JOIN tags t ON t.id = bt.tag_id AND t.user_id = b.user_id
       WHERE b.user_id = ?
       GROUP BY b.id
       ORDER BY b.created_at DESC`,
    )
    .all(userId);

  const urlGroups = new Map();
  rows.forEach((bookmark) => {
    const canonicalUrl = canonicalizeUrl(bookmark.url);
    if (!canonicalUrl) return;
    const existing = urlGroups.get(canonicalUrl) || [];
    existing.push({
      ...bookmark,
      tags: bookmark.tags ? bookmark.tags.split(",").filter(Boolean) : [],
    });
    urlGroups.set(canonicalUrl, existing);
  });

  const groups = [];
  urlGroups.forEach((bookmarks, canonicalUrl) => {
    if (bookmarks.length > 1) {
      groups.push({
        canonical_url: canonicalUrl,
        url: bookmarks[0].url,
        ids: bookmarks.map((bookmark) => bookmark.id),
        titles: bookmarks.map((bookmark) => bookmark.title),
        match_type: "url",
        count: bookmarks.length,
        bookmarks,
      });
    }
  });

  const exactIds = new Set(
    groups.flatMap((group) => group.bookmarks.map((bookmark) => bookmark.id)),
  );
  const titleCandidates = rows.filter((bookmark) => !exactIds.has(bookmark.id));
  const titleUsed = new Set();
  titleCandidates.forEach((bookmark) => {
    if (titleUsed.has(bookmark.id)) return;
    let host;
    try {
      host = new URL(bookmark.url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return;
    }
    const matches = titleCandidates.filter((candidate) => {
      if (candidate.id === bookmark.id || titleUsed.has(candidate.id))
        return false;
      try {
        const candidateHost = new URL(candidate.url).hostname
          .toLowerCase()
          .replace(/^www\./, "");
        if (candidateHost !== host) return false;
      } catch {
        return false;
      }
      return (
        similarity(
          normalizeTitle(bookmark.title),
          normalizeTitle(candidate.title),
        ) >= 0.92
      );
    });
    if (matches.length > 0) {
      const bookmarksInGroup = [
        {
          ...bookmark,
          tags: bookmark.tags ? bookmark.tags.split(",").filter(Boolean) : [],
        },
        ...matches.map((candidate) => ({
          ...candidate,
          tags: candidate.tags ? candidate.tags.split(",").filter(Boolean) : [],
        })),
      ];
      groups.push({
        canonical_url: canonicalizeUrl(bookmark.url) || bookmark.url,
        url: bookmark.url,
        ids: bookmarksInGroup.map((item) => item.id),
        titles: bookmarksInGroup.map((item) => item.title),
        match_type: "title",
        count: bookmarksInGroup.length,
        bookmarks: bookmarksInGroup,
      });
      titleUsed.add(bookmark.id);
      matches.forEach((candidate) => titleUsed.add(candidate.id));
    }
  });

  groups.sort(
    (a, b) =>
      b.count - a.count ||
      String(b.bookmarks[0].created_at || "").localeCompare(
        String(a.bookmarks[0].created_at || ""),
      ),
  );
  return groups;
}

function resolveDuplicateGroup(db, userId, keepId, mergeIds) {
  if (!keepId || !Array.isArray(mergeIds) || mergeIds.length === 0) {
    throw new Error("A keeper and at least one duplicate are required");
  }

  const ids = [keepId, ...mergeIds];
  const uniqueIds = [...new Set(ids)];
  const bookmarks = uniqueIds
    .map((id) =>
      db
        .prepare(
          `SELECT b.*,
                  COALESCE(GROUP_CONCAT(DISTINCT t.name), '') AS tags
           FROM bookmarks b
           LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
           LEFT JOIN tags t ON t.id = bt.tag_id AND t.user_id = b.user_id
           WHERE b.id = ? AND b.user_id = ?
           GROUP BY b.id`,
        )
        .get(id, userId),
    )
    .filter(Boolean);

  const keeper = bookmarks.find((bookmark) => bookmark.id === keepId);
  if (!keeper || bookmarks.length !== uniqueIds.length) {
    throw new Error(
      "One or more duplicate bookmarks are not owned by this user",
    );
  }

  const tagNames = new Set();
  let favorite = Boolean(keeper.is_favorite);
  let folderId = keeper.folder_id || null;
  let description = keeper.description || null;
  let color = keeper.color || null;
  let ogImage = keeper.og_image || null;
  let readingState = keeper.reading_state || "unread";
  let clickCount = 0;
  const rank = { unread: 0, reading: 1, done: 2 };

  bookmarks.forEach((bookmark) => {
    if (bookmark.tags) {
      bookmark.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag) => tagNames.add(tag));
    }
    favorite = favorite || Boolean(bookmark.is_favorite);
    if (!folderId && bookmark.folder_id) folderId = bookmark.folder_id;
    if (!description && bookmark.description)
      description = bookmark.description;
    if (!color && bookmark.color) color = bookmark.color;
    if (!ogImage && bookmark.og_image) ogImage = bookmark.og_image;
    if (rank[bookmark.reading_state || "unread"] > rank[readingState]) {
      readingState = bookmark.reading_state || "unread";
    }
    clickCount += Number(bookmark.click_count || 0);
  });

  return db.transaction(() => {
    db.prepare(
      `UPDATE bookmarks
       SET folder_id = ?, description = ?, color = ?, og_image = ?,
           is_favorite = ?, reading_state = ?, read_at = CASE WHEN ? = 'done' THEN COALESCE(read_at, CURRENT_TIMESTAMP) ELSE NULL END,
           click_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
    ).run(
      folderId,
      description,
      color,
      ogImage,
      favorite ? 1 : 0,
      readingState,
      readingState,
      clickCount,
      keepId,
      userId,
    );

    if (tagNames.size > 0) {
      const tagResult = ensureTagsExist(db, userId, [...tagNames].join(", "), {
        returnMap: true,
      });
      updateBookmarkTags(db, keepId, tagResult.tagIds, { userId });
    } else {
      updateBookmarkTags(db, keepId, [], { userId });
    }

    const deleteStatement = db.prepare(
      "DELETE FROM bookmarks WHERE id = ? AND user_id = ?",
    );
    mergeIds.forEach((id) => deleteStatement.run(id, userId));
  })();
}

function cleanupDuplicates(db, userId) {
  const groups = findDuplicates(db, userId);
  let deleted = 0;
  db.transaction(() => {
    groups.forEach((group) => {
      const ordered = [...group.bookmarks].sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
      );
      const keeper = ordered[0];
      const mergeIds = ordered.slice(1).map((bookmark) => bookmark.id);
      if (keeper && mergeIds.length > 0) {
        resolveDuplicateGroup(db, userId, keeper.id, mergeIds);
        deleted += mergeIds.length;
      }
    });
  })();
  return { deleted, message: `Removed ${deleted} duplicate bookmarks` };
}

function getDeadlinksInfo(db, userId, limit = 50) {
  const bookmarks = db
    .prepare(
      `
        SELECT id, url, title, last_checked, is_dead
        FROM bookmarks 
        WHERE user_id = ?
        ORDER BY last_checked ASC NULLS FIRST
        LIMIT ?
    `,
    )
    .all(userId, limit);

  const deadCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_dead = 1",
    )
    .get(userId);

  return {
    dead_links: deadCount.count,
    unchecked: bookmarks.filter((b) => !b.last_checked).length,
    bookmarks: bookmarks
      .filter((b) => b.is_dead === 1)
      .map((b) => ({ id: b.id, url: b.url, title: b.title })),
    to_check: bookmarks,
  };
}

async function runDeadlinkChecks(db, userId, limit = 50) {
  // In test environment, avoid real network calls to keep tests fast/reliable
  if (process.env.NODE_ENV === "test") {
    return {
      checked: 0,
      dead_links_found: 0,
      dead_links: [],
    };
  }

  const bookmarks = db
    .prepare(
      `
        SELECT id, url, title
        FROM bookmarks 
        WHERE user_id = ?
        ORDER BY last_checked ASC NULLS FIRST
        LIMIT ?
    `,
    )
    .all(userId, limit);

  const results = [];
  const checkList = bookmarks.slice(0, 20);

  for (const bookmark of checkList) {
    const health = await checkUrlHealth(bookmark.url);
    bookmarkModel.setLinkHealth(db, userId, bookmark.id, health);
    if (health.status === "dead" || health.status === "timeout") {
      results.push({
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        health_status: health.status,
        error: health.error,
      });
    }
  }

  return {
    checked: Math.min(20, bookmarks.length),
    dead_links_found: results.length,
    dead_links: results,
  };
}

module.exports = {
  getStats,
  findDuplicates,
  cleanupDuplicates,
  getDeadlinksInfo,
  runDeadlinkChecks,
  resolveDuplicateGroup,
};

function getEngagement(db, userId) {
  const totalClicks = db
    .prepare(
      "SELECT COALESCE(SUM(click_count), 0) as total FROM bookmarks WHERE user_id = ?",
    )
    .get(userId).total;

  const unread = db
    .prepare(
      "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count = 0",
    )
    .get(userId).count;

  const frequentlyUsed = db
    .prepare(
      "SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 5",
    )
    .get(userId).count;

  return { totalClicks, unread, frequentlyUsed };
}

function getLastAdded(db, userId) {
  const row = db
    .prepare(
      "SELECT created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(userId);
  return row ? row.created_at : null;
}

module.exports = Object.assign(module.exports, {
  getEngagement,
  getLastAdded,
  getMonthlyGrowth,
  getTopDomains,
});
