/**
 * Smart Organization API Implementation
 * 
 * This module provides intelligent tag and collection suggestions based on:
 * - Domain/URL analysis
 * - Recent activity patterns
 * - Content clustering
 * - Tag co-occurrence
 */

// Domain category classification - can be extended with more domains
const DOMAIN_CATEGORIES = {
  'github.com': {
    tags: ['github', 'development', 'code', 'opensource', 'repository'],
    category: 'development',
    priority: 0.95
  },
  'stackoverflow.com': {
    tags: ['stackoverflow', 'reference', 'code-help', 'qa', 'programming'],
    category: 'reference',
    priority: 0.92
  },
  'medium.com': {
    tags: ['medium', 'articles', 'reading', 'tech-blogs', 'learning'],
    category: 'content',
    priority: 0.85
  },
  'dev.to': {
    tags: ['dev.to', 'articles', 'tutorials', 'development', 'learning'],
    category: 'content',
    priority: 0.85
  },
  'hashnode.com': {
    tags: ['hashnode', 'articles', 'tutorials', 'development', 'learning'],
    category: 'content',
    priority: 0.85
  },
  'docs.python.org': {
    tags: ['python', 'documentation', 'reference', 'official'],
    category: 'documentation',
    priority: 0.95
  },
  'nodejs.org': {
    tags: ['nodejs', 'javascript', 'documentation', 'reference', 'backend'],
    category: 'documentation',
    priority: 0.95
  },
  'docker.com': {
    tags: ['docker', 'devops', 'containerization', 'deployment'],
    category: 'devops',
    priority: 0.9
  },
  'kubernetes.io': {
    tags: ['kubernetes', 'devops', 'orchestration', 'deployment'],
    category: 'devops',
    priority: 0.9
  },
  'npmjs.com': {
    tags: ['npm', 'javascript', 'packages', 'nodejs', 'libraries'],
    category: 'development',
    priority: 0.88
  },
  'pypi.org': {
    tags: ['pypi', 'python', 'packages', 'libraries'],
    category: 'development',
    priority: 0.88
  },
  'youtube.com': {
    tags: ['youtube', 'video', 'tutorial', 'learning', 'educational'],
    category: 'content',
    priority: 0.75
  },
  'udemy.com': {
    tags: ['udemy', 'course', 'learning', 'tutorial', 'educational'],
    category: 'learning',
    priority: 0.8
  },
  'coursera.org': {
    tags: ['coursera', 'course', 'learning', 'educational', 'certification'],
    category: 'learning',
    priority: 0.8
  },
  'reddit.com': {
    tags: ['reddit', 'discussion', 'community', 'forum'],
    category: 'community',
    priority: 0.7
  },
  'hackernews.com': {
    tags: ['hackernews', 'news', 'tech-news', 'discussion', 'community'],
    category: 'news',
    priority: 0.8
  },
  'twitter.com': {
    tags: ['twitter', 'social', 'news', 'discussion'],
    category: 'social',
    priority: 0.65
  },
  'wikipedia.org': {
    tags: ['wikipedia', 'reference', 'knowledge', 'educational'],
    category: 'reference',
    priority: 0.85
  },
  'mdn.mozilla.org': {
    tags: ['mdn', 'documentation', 'web', 'javascript', 'css', 'html', 'reference'],
    category: 'documentation',
    priority: 0.95
  },
  'aws.amazon.com': {
    tags: ['aws', 'cloud', 'devops', 'infrastructure'],
    category: 'cloud',
    priority: 0.9
  },
  'azure.microsoft.com': {
    tags: ['azure', 'cloud', 'devops', 'microsoft'],
    category: 'cloud',
    priority: 0.9
  },
  'gcp.google.com': {
    tags: ['gcp', 'cloud', 'devops', 'google'],
    category: 'cloud',
    priority: 0.9
  },
  'linkedin.com': {
    tags: ['linkedin', 'professional', 'networking', 'social'],
    category: 'professional',
    priority: 0.7
  }
};

/**
 * Get domain category and base tags
 * @param {string} url - The URL to analyze
 * @returns {Object} Domain info with tags and category
 */
function getDomainCategory(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.replace(/^www\./, '');
    
    // Check exact match first
    if (DOMAIN_CATEGORIES[hostname]) {
      return DOMAIN_CATEGORIES[hostname];
    }
    
    // Check for subdomain matches (e.g., docs.python.org matches python category)
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length; i++) {
      const variant = parts.slice(i).join('.');
      if (DOMAIN_CATEGORIES[variant]) {
        return DOMAIN_CATEGORIES[variant];
      }
    }
    
    // Return generic domain-based tags
    return {
      tags: [hostname.split('.')[0]],
      category: 'web',
      priority: 0.6
    };
  } catch {
    return { tags: [], category: 'unknown', priority: 0.3 };
  }
}

/**
 * Calculate domain-based tag score
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} domain - Domain to analyze
 * @param {string} tag - Tag to score
 * @returns {number} Score between 0 and 1
 */
function getDomainScore(db, userId, domain, tag) {
  try {
    // Get all bookmarks on this domain
    const domainBookmarks = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks 
      WHERE user_id = ? AND url LIKE ?
    `).get(userId, `%${domain}%`);
    
    if (!domainBookmarks.count) return 0;
    
    // Count how many of those have this tag
    const taggedCount = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? AND url LIKE ? AND tags LIKE ?
    `).get(userId, `%${domain}%`, `%${tag}%`);
    
    const frequency = taggedCount.count / domainBookmarks.count;
    // Scale by log of total count to avoid over-weighting rare domains
    const scale = Math.min(domainBookmarks.count / 100, 1.0);
    
    return frequency * scale;
  } catch {
    return 0;
  }
}

/**
 * Calculate activity-based tag score (recent bookmarks)
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} tag - Tag to score
 * @param {number} days - Look back this many days
 * @returns {number} Score between 0 and 1
 */
function getActivityScore(db, userId, tag, days = 7) {
  try {
    // Get recent bookmarks
    const recentQuery = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? 
      AND datetime(created_at) > datetime('now', ? || ' days')
    `).get(userId, -days);
    
    if (!recentQuery.count) return 0;
    
    // Count recent bookmarks with this tag
    const recentTagged = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? 
      AND tags LIKE ?
      AND datetime(created_at) > datetime('now', ? || ' days')
    `).get(userId, `%${tag}%`, -days);
    
    const frequency = recentTagged.count / recentQuery.count;
    
    // Apply recency boost
    const recencyBoost = days <= 7 ? 1.2 : (days <= 14 ? 0.9 : 0.5);
    
    return Math.min(frequency * recencyBoost, 1.0);
  } catch {
    return 0;
  }
}

/**
 * Calculate similarity score based on TF-IDF
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} url - URL to compare against
 * @param {string} tag - Tag to score
 * @returns {number} Score between 0 and 1
 */
function getSimilarityScore(db, userId, url, tag) {
  try {
    // Tokenize the input URL
    const tokens = tokenizeText(url);
    if (!tokens.length) return 0;
    
    // Find similar bookmarks (simplified - check if tokens appear in title/URL)
    const similarBookmarks = db.prepare(`
      SELECT id, tags FROM bookmarks
      WHERE user_id = ?
      LIMIT 100
    `).all(userId);
    
    let matchCount = 0;
    let tagCount = 0;
    
    similarBookmarks.forEach(bm => {
      const bmTokens = tokenizeText(bm.id); // In real impl, use title
      const matches = tokens.filter(t => 
        bm.id.includes(t) || (bm.tags || '').toLowerCase().includes(t)
      );
      
      if (matches.length > 0) {
        matchCount++;
        if ((bm.tags || '').includes(tag)) {
          tagCount++;
        }
      }
    });
    
    if (!matchCount) return 0;
    
    const tagFrequency = tagCount / matchCount;
    const logBoost = Math.log(tagCount + 1);
    
    return Math.min(tagFrequency * logBoost / 10, 1.0);
  } catch {
    return 0;
  }
}

/**
 * Tokenize text for similarity matching
 * @param {string} text - Text to tokenize
 * @returns {Array<string>} Array of tokens
 */
function tokenizeText(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-/]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 2 && t.length < 30);
}

/**
 * Calculate combined score for a tag suggestion
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} url - Bookmark URL
 * @param {string} tag - Tag to score
 * @param {Object} weights - Score weights { domain, activity, similarity }
 * @returns {Object} Score details with total score
 */
function calculateTagScore(db, userId, url, tag, weights = {}) {
  const w = {
    domain: weights.domain ?? 0.35,
    activity: weights.activity ?? 0.40,
    similarity: weights.similarity ?? 0.25
  };
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    
    const domainScore = getDomainScore(db, userId, domain, tag);
    const activityScore = getActivityScore(db, userId, tag, 7);
    const similarityScore = getSimilarityScore(db, userId, url, tag);
    
    const totalScore = 
      (domainScore * w.domain) +
      (activityScore * w.activity) +
      (similarityScore * w.similarity);
    
    return {
      score: Math.min(totalScore, 1.0),
      domainScore,
      activityScore,
      similarityScore,
      sources: {
        domain: domainScore > 0.1,
        activity: activityScore > 0.1,
        similarity: similarityScore > 0.1
      }
    };
  } catch {
    return { score: 0, domainScore: 0, activityScore: 0, similarityScore: 0, sources: {} };
  }
}

/**
 * Get top suggestion source for reasoning
 * @param {Object} scores - Score object with sources
 * @returns {string} Source name
 */
function getTopSource(scores) {
  if (scores.domainScore >= scores.activityScore && scores.domainScore >= scores.similarityScore) {
    return 'domain';
  } else if (scores.activityScore >= scores.similarityScore) {
    return 'activity';
  }
  return 'similar';
}

/**
 * Generate reason string for a suggestion
 * @param {string} tag - Tag name
 * @param {string} domain - Domain
 * @param {Object} scores - Score details
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @returns {string} Human-readable reason
 */
function generateReason(tag, domain, scores, db, userId) {
  const source = getTopSource(scores);
  
  if (source === 'domain') {
    const domainBookmarks = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks 
      WHERE user_id = ? AND url LIKE ?
    `).get(userId, `%${domain}%`);
    
    const taggedCount = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? AND url LIKE ? AND tags LIKE ?
    `).get(userId, `%${domain}%`, `%${tag}%`);
    
    const percent = Math.round((taggedCount.count / domainBookmarks.count) * 100);
    return `${percent}% of ${domain} bookmarks use this tag`;
  } else if (source === 'activity') {
    const recentTagged = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? 
      AND tags LIKE ?
      AND datetime(created_at) > datetime('now', '-7 days')
    `).get(userId, `%${tag}%`);
    
    return `Added ${recentTagged.count} bookmarks with this tag in the last 7 days`;
  } else {
    return `Similar to other bookmarks you\'ve tagged with "${tag}"`;
  }
}

/**
 * Get domain statistics
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} domain - Domain to analyze
 * @returns {Object} Domain statistics
 */
function getDomainStats(db, userId, domain) {
  try {
    const bookmarkCount = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks 
      WHERE user_id = ? AND url LIKE ?
    `).get(userId, `%${domain}%`).count;
    
    // Get tag distribution for this domain
    const tagDistribution = db.prepare(`
      SELECT 
        TRIM(value) as tag,
        COUNT(*) as count
      FROM (
        SELECT json_extract(json_array(tags), '$') as value
        FROM bookmarks
        WHERE user_id = ? AND url LIKE ? AND tags IS NOT NULL
      )
      GROUP BY tag
      ORDER BY count DESC
      LIMIT 10
    `).all(userId, `%${domain}%`);
    
    const distribution = {};
    tagDistribution.forEach(row => {
      if (row.tag) distribution[row.tag] = row.count;
    });
    
    return {
      domain,
      bookmarkCount,
      tagDistribution: distribution
    };
  } catch (err) {
    return {
      domain,
      bookmarkCount: 0,
      tagDistribution: {}
    };
  }
}

/**
 * Get tag clusters for smart collections
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @returns {Array<Object>} Array of tag clusters
 */
function getTagClusters(db, userId) {
  try {
    // Simple clustering: group tags that often appear together
    const tagCooccurrence = db.prepare(`
      SELECT tag_id, COUNT(*) as count FROM bookmark_tags
      WHERE bookmark_id IN (
        SELECT id FROM bookmarks WHERE user_id = ?
      )
      GROUP BY tag_id
      ORDER BY count DESC
      LIMIT 100
    `).all(userId);
    
    // Get tag names
    const tagNames = {};
    const tags = db.prepare(`
      SELECT id, name FROM tags WHERE user_id = ?
    `).all(userId);
    
    tags.forEach(tag => {
      tagNames[tag.id] = tag.name;
    });
    
    // Group tags by semantic similarity (simplified - using tag frequency)
    const clusters = [];
    const categories = {};
    
    tagCooccurrence.forEach(row => {
      const tagName = tagNames[row.tag_id];
      if (!tagName) return;
      
      // Simple categorization based on common keywords
      let category = 'other';
      if (tagName.includes('react') || tagName.includes('vue') || tagName.includes('angular')) {
        category = 'frontend';
      } else if (tagName.includes('docker') || tagName.includes('k8s') || tagName.includes('devops')) {
        category = 'devops';
      } else if (tagName.includes('python') || tagName.includes('javascript') || tagName.includes('java')) {
        category = 'language';
      } else if (tagName.includes('tutorial') || tagName.includes('learning') || tagName.includes('course')) {
        category = 'learning';
      }
      
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(tagName);
    });
    
    // Convert to cluster objects
    Object.entries(categories).forEach(([category, tagList]) => {
      if (tagList.length > 1) {
        clusters.push({
          name: `${category.charAt(0).toUpperCase() + category.slice(1)} Topics`,
          type: 'tag_cluster',
          tags: tagList,
          category,
          bookmarkCount: db.prepare(`
            SELECT COUNT(DISTINCT bookmark_id) as count
            FROM bookmark_tags
            WHERE tag_id IN (
              SELECT id FROM tags WHERE user_id = ? AND name IN (${tagList.map(() => '?').join(',')})
            )
          `).get(userId, ...tagList).count || 0
        });
      }
    });
    
    return clusters.sort((a, b) => b.bookmarkCount - a.bookmarkCount);
  } catch {
    return [];
  }
}

/**
 * Get activity-based collections
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @returns {Array<Object>} Activity-based collection suggestions
 */
function getActivityCollections(db, userId) {
  try {
    const collections = [];
    
    // Recent bookmarks (7 days)
    const recent7 = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? AND datetime(created_at) > datetime('now', '-7 days')
    `).get(userId).count;
    
    if (recent7 > 0) {
      collections.push({
        name: 'Recent Bookmarks (7 days)',
        type: 'activity',
        icon: 'clock',
        color: '#f59e0b',
        filters: { addedWithinDays: 7 },
        bookmarkCount: recent7,
        reason: `${recent7} bookmarks added in the last 7 days`
      });
    }
    
    // Frequently used
    const frequentlyUsed = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? AND click_count > 5
    `).get(userId).count;
    
    if (frequentlyUsed > 0) {
      collections.push({
        name: 'Frequently Used',
        type: 'activity',
        icon: 'trending-up',
        color: '#10b981',
        filters: { clickCountMinimum: 5 },
        bookmarkCount: frequentlyUsed,
        reason: `${frequentlyUsed} bookmarks clicked more than 5 times`
      });
    }
    
    // Unread/unclicked
    const unread = db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE user_id = ? AND click_count = 0 AND datetime(created_at) < datetime('now', '-7 days')
    `).get(userId).count;
    
    if (unread > 0) {
      collections.push({
        name: 'Unread',
        type: 'activity',
        icon: 'eye-off',
        color: '#6b7280',
        filters: { unread: true },
        bookmarkCount: unread,
        reason: `${unread} bookmarks you haven't clicked yet`
      });
    }
    
    return collections;
  } catch {
    return [];
  }
}

/**
 * Get domain-based collection suggestions
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @returns {Array<Object>} Domain-based collection suggestions
 */
function getDomainCollections(db, userId) {
  try {
    const collections = [];
    
    // Get top domains
    const topDomains = db.prepare(`
      SELECT 
        SUBSTR(url, INSTR(url, '://') + 3, INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1) as domain,
        COUNT(*) as count
      FROM bookmarks
      WHERE user_id = ?
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 5
    `).all(userId);
    
    topDomains.forEach(row => {
      const domain = row.domain.replace(/^www\./, '');
      const category = getDomainCategory(`https://${domain}`);
      
      collections.push({
        name: `${domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)} Resources`,
        type: 'domain',
        icon: 'link',
        color: '#6366f1',
        domain,
        bookmarkCount: row.count,
        category: category.category,
        reason: `${row.count} bookmarks from ${domain}`
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
  DOMAIN_CATEGORIES
};
