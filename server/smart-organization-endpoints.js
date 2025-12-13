/**
 * Smart Organization API Endpoints
 * 
 * Add these endpoints to server/index.js
 * 
 * Usage:
 * 1. Add to top of index.js after other requires:
 *    const smartOrg = require('./smart-organization');
 * 
 * 2. Add all the endpoints below to index.js after other app.get/app.post routes
 */

// ============== SMART TAG SUGGESTIONS ==============

/**
 * GET /api/tags/suggest-smart
 * 
 * Get intelligent tag suggestions for a URL based on:
 * - Domain analysis and category
 * - Recent activity patterns
 * - Content similarity
 * - Tag co-occurrence
 * 
 * Query Parameters:
 *   - url (required): URL to get suggestions for
 *   - limit (optional, default: 10): Max suggestions to return
 *   - include_domain (optional, default: true): Include domain-based suggestions
 *   - include_activity (optional, default: true): Include activity-based suggestions
 *   - include_similar (optional, default: true): Include similarity-based suggestions
 * 
 * Response:
 * {
 *   "suggestions": [
 *     {
 *       "tag": "github",
 *       "score": 0.95,
 *       "source": "domain",
 *       "reason": "95% of github.com bookmarks use this tag"
 *     },
 *     ...
 *   ],
 *   "domain_info": {
 *     "domain": "github.com",
 *     "category": "development",
 *     "bookmark_count": 128,
 *     "tag_distribution": {
 *       "github": 45,
 *       "development": 38
 *     }
 *   }
 * }
 */

app.get('/api/tags/suggest-smart', authenticateToken, (req, res) => {
  const { url, limit = 10, include_domain = true, include_activity = true, include_similar = true } = req.query;
  
  if (!url) {
    return res.json({ suggestions: [], domain_info: {} });
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    
    // Get domain category info
    const categoryInfo = smartOrg.getDomainCategory(url);
    const domainStats = smartOrg.getDomainStats(db, req.user.id, domain);
    
    // Collect all possible tags to score
    const tagsToScore = new Set();
    
    // Add domain category tags
    if (include_domain && categoryInfo.tags) {
      categoryInfo.tags.forEach(t => tagsToScore.add(t));
    }
    
    // Add existing tags from user's bookmarks
    const userTags = db.prepare('SELECT DISTINCT name FROM tags WHERE user_id = ?').all(req.user.id);
    userTags.forEach(row => tagsToScore.add(row.name));
    
    // Add tags from domain bookmarks
    const domainTags = db.prepare(`
      SELECT DISTINCT tags FROM bookmarks 
      WHERE user_id = ? AND url LIKE ?
    `).all(req.user.id, `%${domain}%`);
    
    domainTags.forEach(row => {
      if (row.tags) {
        smartOrg.tokenizeText(row.tags).forEach(t => tagsToScore.add(t));
      }
    });
    
    // Score all tags
    const suggestions = [];
    tagsToScore.forEach(tag => {
      const scores = smartOrg.calculateTagScore(db, req.user.id, url, tag, {
        domain: include_domain ? 0.35 : 0,
        activity: include_activity ? 0.40 : 0,
        similarity: include_similar ? 0.25 : 0
      });
      
      if (scores.score > 0.1) {
        suggestions.push({
          tag,
          score: Math.round(scores.score * 100) / 100,
          source: smartOrg.getTopSource(scores),
          reason: smartOrg.generateReason(tag, domain, scores, db, req.user.id)
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
        ...domainStats
      }
    });
  } catch (err) {
    res.json({ suggestions: [], domain_info: {}, error: err.message });
  }
});

// ============== SMART COLLECTIONS ==============

/**
 * GET /api/smart-collections/suggest
 * 
 * Get automatic collection suggestions based on:
 * - Domain grouping
 * - Activity patterns
 * - Tag clustering
 * 
 * Query Parameters:
 *   - type (optional): Filter by type ('domain', 'activity', 'tag_cluster')
 *   - limit (optional, default: 5): Max collections to suggest
 * 
 * Response:
 * {
 *   "collections": [
 *     {
 *       "name": "Frontend Development",
 *       "type": "tag_cluster",
 *       "icon": "palette",
 *       "color": "#3b82f6",
 *       "tags": ["react", "vue", "angular"],
 *       "bookmark_count": 42,
 *       "reason": "Clustering of frontend-related tags"
 *     },
 *     ...
 *   ]
 * }
 */

app.get('/api/smart-collections/suggest', authenticateToken, (req, res) => {
  const { type, limit = 5 } = req.query;

  try {
    let suggestions = [];
    
    // Get tag clusters
    if (!type || type === 'tag_cluster') {
      const clusters = smartOrg.getTagClusters(db, req.user.id);
      suggestions = suggestions.concat(clusters.slice(0, 2));
    }
    
    // Get activity-based collections
    if (!type || type === 'activity') {
      const activityCollections = smartOrg.getActivityCollections(db, req.user.id);
      suggestions = suggestions.concat(activityCollections.slice(0, 2));
    }
    
    // Get domain-based collections
    if (!type || type === 'domain') {
      const domainCollections = smartOrg.getDomainCollections(db, req.user.id);
      suggestions = suggestions.concat(domainCollections.slice(0, 2));
    }
    
    // Deduplicate by name and limit
    const seen = new Set();
    const unique = suggestions.filter(s => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
    
    res.json({
      collections: unique.slice(0, parseInt(limit))
    });
  } catch (err) {
    res.json({ collections: [], error: err.message });
  }
});

/**
 * POST /api/smart-collections/create
 * 
 * Create a smart collection from suggestions
 * 
 * Request Body:
 * {
 *   "name": "Frontend Development",
 *   "type": "tag_cluster",
 *   "icon": "palette",
 *   "color": "#3b82f6",
 *   "tags": ["react", "vue"],
 *   "domain": null,
 *   "filters": null
 * }
 * 
 * Response:
 * {
 *   "id": "uuid",
 *   "name": "Frontend Development",
 *   "type": "tag_cluster",
 *   ...
 * }
 */

app.post('/api/smart-collections/create', authenticateToken, (req, res) => {
  const { name, type = 'tag_cluster', icon, color, tags, domain, filters } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    const id = uuidv4();
    
    // Convert to filters object for smart_collections table
    let filterObj = {};
    
    if (type === 'tag_cluster' && tags && tags.length) {
      filterObj = { tags };
    } else if (type === 'domain' && domain) {
      filterObj = { domain };
    } else if (type === 'activity' && filters) {
      filterObj = filters;
    }
    
    db.prepare(`
      INSERT INTO smart_collections (id, user_id, name, icon, color, filters)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.user.id, name, icon || 'filter', color || '#6366f1', JSON.stringify(filterObj));
    
    res.json({
      id,
      name,
      type,
      icon: icon || 'filter',
      color: color || '#6366f1',
      filters: filterObj,
      created: true
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create collection: ' + err.message });
  }
});

/**
 * GET /api/smart-collections/domain-stats
 * 
 * Get statistics for a specific domain
 * 
 * Query Parameters:
 *   - domain (required): Domain to analyze
 * 
 * Response:
 * {
 *   "domain": "github.com",
 *   "bookmark_count": 128,
 *   "tag_distribution": {
 *     "github": 45,
 *     "development": 38,
 *     "code": 22
 *   },
 *   "recent_bookmarks": 12,
 *   "most_clicked": [...],
 *   "category": "development"
 * }
 */

app.get('/api/smart-collections/domain-stats', authenticateToken, (req, res) => {
  const { domain } = req.query;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain parameter required' });
  }

  try {
    const stats = smartOrg.getDomainStats(db, req.user.id, domain);
    const category = smartOrg.getDomainCategory(`https://${domain}`);
    
    // Get recent bookmarks
    const recentBookmarks = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? AND url LIKE ? AND datetime(created_at) > datetime('now', '-7 days')
    `).get(req.user.id, `%${domain}%`).count;
    
    // Get most clicked
    const mostClicked = db.prepare(`
      SELECT title, click_count FROM bookmarks
      WHERE user_id = ? AND url LIKE ?
      ORDER BY click_count DESC
      LIMIT 5
    `).all(req.user.id, `%${domain}%`);
    
    res.json({
      ...stats,
      category: category.category,
      recentBookmarks,
      mostClicked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smart-collections/tag-clusters
 * 
 * Get suggested tag clusters for creating grouped collections
 * 
 * Response:
 * {
 *   "clusters": [
 *     {
 *       "name": "Frontend Development",
 *       "tags": ["react", "vue", "angular"],
 *       "bookmark_count": 42,
 *       "suggested_icon": "palette",
 *       "suggested_color": "#3b82f6"
 *     },
 *     ...
 *   ]
 * }
 */

app.get('/api/smart-collections/tag-clusters', authenticateToken, (req, res) => {
  try {
    const clusters = smartOrg.getTagClusters(db, req.user.id);
    res.json({ clusters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/smart-insights
 * 
 * Get overall smart insights about user's bookmark collection
 * 
 * Response:
 * {
 *   "total_bookmarks": 256,
 *   "total_tags": 42,
 *   "top_domains": [
 *     { "domain": "github.com", "count": 128, "percentage": 50 }
 *   ],
 *   "top_tags": [
 *     { "tag": "javascript", "count": 89, "percentage": 35 }
 *   ],
 *   "recent_activity": {
 *     "bookmarks_this_week": 12,
 *     "bookmarks_this_month": 45,
 *     "last_bookmark_added": "2024-01-15T10:30:00Z"
 *   },
 *   "engagement": {
 *     "total_clicks": 523,
 *     "unread_bookmarks": 45,
 *     "frequently_used": 23
 *   },
 *   "suggestions": {
 *     "create_these_collections": [...],
 *     "organize_these_tags": [...]
 *   }
 * }
 */

app.get('/api/smart-insights', authenticateToken, (req, res) => {
  try {
    const totalBookmarks = db.prepare(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?'
    ).get(req.user.id).count;
    
    const totalTags = db.prepare(
      'SELECT COUNT(*) as count FROM tags WHERE user_id = ?'
    ).get(req.user.id).count;
    
    // Top domains
    const topDomains = db.prepare(`
      SELECT 
        SUBSTR(url, INSTR(url, '://') + 3, INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1) as domain,
        COUNT(*) as count
      FROM bookmarks
      WHERE user_id = ?
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 5
    `).all(req.user.id);
    
    // Top tags
    const topTags = db.prepare(`
      SELECT name, COUNT(bt.tag_id) as count
      FROM tags t
      LEFT JOIN bookmark_tags bt ON t.id = bt.tag_id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
      LIMIT 5
    `).all(req.user.id);
    
    // Recent activity
    const thisWeek = db.prepare(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND datetime(created_at) > datetime("now", "-7 days")'
    ).get(req.user.id).count;
    
    const thisMonth = db.prepare(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND datetime(created_at) > datetime("now", "-30 days")'
    ).get(req.user.id).count;
    
    const lastAdded = db.prepare(
      'SELECT created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.user.id);
    
    // Engagement
    const totalClicks = db.prepare(
      'SELECT COALESCE(SUM(click_count), 0) as total FROM bookmarks WHERE user_id = ?'
    ).get(req.user.id).total;
    
    const unread = db.prepare(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count = 0'
    ).get(req.user.id).count;
    
    const frequentlyUsed = db.prepare(
      'SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND click_count > 5'
    ).get(req.user.id).count;
    
    // Suggestions
    const suggestedCollections = smartOrg.getActivityCollections(db, req.user.id).slice(0, 2);
    const suggestedClusters = smartOrg.getTagClusters(db, req.user.id).slice(0, 2);
    
    res.json({
      total_bookmarks: totalBookmarks,
      total_tags: totalTags,
      top_domains: topDomains.map(d => ({
        domain: d.domain,
        count: d.count,
        percentage: Math.round((d.count / totalBookmarks) * 100)
      })),
      top_tags: topTags.map(t => ({
        tag: t.name,
        count: t.count,
        percentage: Math.round((t.count / totalBookmarks) * 100)
      })),
      recent_activity: {
        bookmarks_this_week: thisWeek,
        bookmarks_this_month: thisMonth,
        last_bookmark_added: lastAdded?.created_at || null
      },
      engagement: {
        total_clicks: totalClicks,
        unread_bookmarks: unread,
        frequently_used: frequentlyUsed
      },
      suggestions: {
        create_these_collections: suggestedCollections,
        organize_these_tags: suggestedClusters
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
