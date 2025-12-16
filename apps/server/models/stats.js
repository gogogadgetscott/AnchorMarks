const https = require('https');
const http = require('http');

function getStats(db, userId) {
  const bookmarkCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?').get(userId);
  const folderCount = db.prepare('SELECT COUNT(*) as count FROM folders WHERE user_id = ?').get(userId);
  const favoriteCount = db
    .prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_favorite = 1')
    .get(userId);
  const topClicked = db
    .prepare(`
    SELECT title, url, favicon_local as favicon, click_count 
    FROM bookmarks 
    WHERE user_id = ? AND click_count > 0 
    ORDER BY click_count DESC 
    LIMIT 5
  `)
    .all(userId);

  const tagCounts = db
    .prepare(`
      SELECT t.name, COUNT(bt.bookmark_id) as count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
    `)
    .all(userId);

  const usedTags = tagCounts.filter((t) => t.count > 0);

  return {
    total_bookmarks: bookmarkCount.count,
    total_folders: folderCount.count,
    total_tags: usedTags.length,
    favorites: favoriteCount.count,
    top_clicked: topClicked,
    top_tags: usedTags.sort((a, b) => b.count - a.count).slice(0, 10).map((t) => [t.name, t.count]),
  };
}

function findDuplicates(db, userId) {
  const duplicates = db
    .prepare(`
        SELECT url, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(title, '|||') as titles
        FROM bookmarks 
        WHERE user_id = ?
        GROUP BY url 
        HAVING COUNT(*) > 1
        ORDER BY count DESC
    `)
    .all(userId);

  return duplicates.map((d) => ({
    url: d.url,
    count: d.count,
    ids: d.ids.split(','),
    titles: d.titles.split('|||'),
  }));
}

function cleanupDuplicates(db, userId) {
  const duplicates = db
    .prepare(`
        SELECT url, GROUP_CONCAT(id) as ids
        FROM bookmarks 
        WHERE user_id = ?
        GROUP BY url 
        HAVING COUNT(*) > 1
    `)
    .all(userId);

  let deleted = 0;
  for (const dup of duplicates) {
    const ids = dup.ids.split(',');
    for (let i = 1; i < ids.length; i++) {
      db.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?').run(ids[i], userId);
      deleted++;
    }
  }

  return { deleted, message: `Removed ${deleted} duplicate bookmarks` };
}

function getDeadlinksInfo(db, userId, limit = 50) {
  const bookmarks = db
    .prepare(`
        SELECT id, url, title, last_checked, is_dead
        FROM bookmarks 
        WHERE user_id = ?
        ORDER BY last_checked ASC NULLS FIRST
        LIMIT ?
    `)
    .all(userId, limit);

  const deadCount = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND is_dead = 1")
    .get(userId);

  return {
    dead_links: deadCount.count,
    unchecked: bookmarks.filter((b) => !b.last_checked).length,
    bookmarks: bookmarks.filter((b) => b.is_dead === 1).map((b) => ({ id: b.id, url: b.url, title: b.title })),
    to_check: bookmarks,
  };
}

async function runDeadlinkChecks(db, userId, limit = 50) {
  const bookmarks = db
    .prepare(`
        SELECT id, url, title
        FROM bookmarks 
        WHERE user_id = ?
        ORDER BY last_checked ASC NULLS FIRST
        LIMIT ?
    `)
    .all(userId, limit);

  const results = [];
  const checkList = bookmarks.slice(0, 20);

  for (const bookmark of checkList) {
    try {
      const urlObj = new URL(bookmark.url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const isDead = await new Promise((resolve) => {
        const req = protocol.request(bookmark.url, { method: 'HEAD', timeout: 5000 }, (response) => {
          resolve(response.statusCode >= 400);
        });
        req.on('error', () => resolve(true));
        req.on('timeout', () => {
          req.destroy();
          resolve(true);
        });
        req.end();
      });

      db.prepare('UPDATE bookmarks SET is_dead = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?').run(isDead ? 1 : 0, bookmark.id);

      if (isDead) results.push({ id: bookmark.id, url: bookmark.url, title: bookmark.title });
    } catch (e) {
      db.prepare('UPDATE bookmarks SET is_dead = 1, last_checked = CURRENT_TIMESTAMP WHERE id = ?').run(bookmark.id);
      results.push({ id: bookmark.id, url: bookmark.url, title: bookmark.title, error: e.message });
    }
  }

  return {
    checked: Math.min(20, bookmarks.length),
    dead_links_found: results.length,
    dead_links: results,
  };
}

module.exports = { getStats, findDuplicates, cleanupDuplicates, getDeadlinksInfo, runDeadlinkChecks };

function getEngagement(db, userId) {
  const totalClicks = db
    .prepare("SELECT COALESCE(SUM(click_count), 0) as total FROM bookmarks WHERE user_id = ?")
    .get(userId).total;

  const unread = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count = 0")
    .get(userId).count;

  const frequentlyUsed = db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 5")
    .get(userId).count;

  return { totalClicks, unread, frequentlyUsed };
}

function getLastAdded(db, userId) {
  const row = db
    .prepare("SELECT created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(userId);
  return row ? row.created_at : null;
}

module.exports = Object.assign(module.exports, { getEngagement, getLastAdded });
