/**
 * Fuzzy search implementation for better bookmark search
 * Uses Levenshtein distance and multiple scoring factors
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarityScore(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Tokenize text into words
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Calculate fuzzy match score for a bookmark
 */
function calculateFuzzyScore(bookmark, searchTerm) {
  const searchTokens = tokenize(searchTerm);
  const titleTokens = tokenize(bookmark.title || '');
  const urlTokens = tokenize(bookmark.url || '');
  const descTokens = tokenize(bookmark.description || '');
  const tagTokens = bookmark.tags
    ? tokenize(bookmark.tags.replace(/,/g, ' '))
    : [];

  let totalScore = 0;
  let maxPossibleScore = 0;

  // Title matches (highest weight: 0.4)
  const titleWeight = 0.4;
  maxPossibleScore += titleWeight;
  let titleScore = 0;
  searchTokens.forEach((searchToken) => {
    let bestMatch = 0;
    titleTokens.forEach((titleToken) => {
      const sim = similarityScore(searchToken, titleToken);
      if (sim > bestMatch) bestMatch = sim;
      // Exact match bonus
      if (titleToken.startsWith(searchToken) || titleToken === searchToken) {
        bestMatch = Math.max(bestMatch, 1.0);
      }
    });
    titleScore += bestMatch;
  });
  totalScore += (titleScore / searchTokens.length) * titleWeight;

  // URL matches (weight: 0.3)
  const urlWeight = 0.3;
  maxPossibleScore += urlWeight;
  let urlScore = 0;
  searchTokens.forEach((searchToken) => {
    let bestMatch = 0;
    urlTokens.forEach((urlToken) => {
      const sim = similarityScore(searchToken, urlToken);
      if (sim > bestMatch) bestMatch = sim;
      if (urlToken.startsWith(searchToken) || urlToken === searchToken) {
        bestMatch = Math.max(bestMatch, 1.0);
      }
    });
    // Also check if search term appears in URL string
    if (bookmark.url && bookmark.url.toLowerCase().includes(searchToken)) {
      bestMatch = Math.max(bestMatch, 0.8);
    }
    urlScore += bestMatch;
  });
  totalScore += (urlScore / searchTokens.length) * urlWeight;

  // Description matches (weight: 0.2)
  const descWeight = 0.2;
  maxPossibleScore += descWeight;
  let descScore = 0;
  if (descTokens.length > 0) {
    searchTokens.forEach((searchToken) => {
      let bestMatch = 0;
      descTokens.forEach((descToken) => {
        const sim = similarityScore(searchToken, descToken);
        if (sim > bestMatch) bestMatch = sim;
      });
      descScore += bestMatch;
    });
  }
  totalScore += (descScore / searchTokens.length) * descWeight;

  // Tag matches (weight: 0.1)
  const tagWeight = 0.1;
  maxPossibleScore += tagWeight;
  let tagScore = 0;
  if (tagTokens.length > 0) {
    searchTokens.forEach((searchToken) => {
      let bestMatch = 0;
      tagTokens.forEach((tagToken) => {
        const sim = similarityScore(searchToken, tagToken);
        if (sim > bestMatch) bestMatch = sim;
        if (tagToken === searchToken) {
          bestMatch = 1.0;
        }
      });
      tagScore += bestMatch;
    });
  }
  totalScore += (tagScore / searchTokens.length) * tagWeight;

  // Normalize score
  const normalizedScore = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

  // Boost for exact substring matches
  const exactMatchBoost = 0.2;
  const titleLower = (bookmark.title || '').toLowerCase();
  const urlLower = (bookmark.url || '').toLowerCase();
  const searchLower = searchTerm.toLowerCase();

  if (titleLower.includes(searchLower) || urlLower.includes(searchLower)) {
    return Math.min(1.0, normalizedScore + exactMatchBoost);
  }

  return normalizedScore;
}

/**
 * Fuzzy search and rank bookmarks
 */
function fuzzySearch(bookmarks, searchTerm, options = {}) {
  const { minScore = 0.1, limit = null } = options;

  if (!searchTerm || searchTerm.trim().length === 0) {
    return bookmarks;
  }

  // Calculate scores for all bookmarks
  const scoredBookmarks = bookmarks.map((bookmark) => ({
    bookmark,
    score: calculateFuzzyScore(bookmark, searchTerm),
  }));

  // Filter by minimum score and sort by score
  let results = scoredBookmarks
    .filter((item) => item.score >= minScore)
    .sort((a, b) => {
      // Sort by score (descending), then by click_count, then by created_at
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const clickA = bookmark.click_count || 0;
      const clickB = bookmark.click_count || 0;
      if (clickB !== clickA) {
        return clickB - clickA;
      }
      return new Date(b.bookmark.created_at) - new Date(a.bookmark.created_at);
    })
    .map((item) => item.bookmark);

  // Apply limit if specified
  if (limit && limit > 0) {
    results = results.slice(0, limit);
  }

  return results;
}

module.exports = {
  fuzzySearch,
  calculateFuzzyScore,
  similarityScore,
  levenshteinDistance,
};
