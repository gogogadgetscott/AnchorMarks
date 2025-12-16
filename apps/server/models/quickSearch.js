function listRecent(db, userId, limit = 10) {
  return db
    .prepare(`
    SELECT id, title, url, favicon_local as favicon, click_count 
      FROM bookmarks 
      WHERE user_id = ? 
      ORDER BY click_count DESC, last_clicked DESC, created_at DESC 
      LIMIT ?
    `)
    .all(userId, parseInt(limit));
}

function search(db, userId, q, limit = 10) {
  const searchTerm = `%${q}%`;
  return db
    .prepare(`
    SELECT DISTINCT b.id, b.title, b.url, b.favicon_local as favicon, b.click_count 
    FROM bookmarks b
    LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
    LEFT JOIN tags t ON t.id = bt.tag_id
    WHERE b.user_id = ? AND (b.title LIKE ? OR b.url LIKE ? OR t.name LIKE ?)
    ORDER BY 
      CASE WHEN b.title LIKE ? THEN 0 ELSE 1 END,
      b.click_count DESC
    LIMIT ?
  `)
    .all(userId, searchTerm, searchTerm, searchTerm, `${q}%`, parseInt(limit));
}

module.exports = { listRecent, search };
