/**
 * Performance monitoring and analytics
 * Tracks API response times, database query performance, and user metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiRequests: [],
      dbQueries: [],
      errors: [],
      slowQueries: [],
    };
    this.maxMetrics = 1000; // Keep last 1000 entries
  }

  /**
   * Track API request
   */
  trackRequest(req, res, duration) {
    const metric = {
      method: req.method,
      path: req.path,
      duration,
      timestamp: Date.now(),
      statusCode: res.statusCode,
      userId: req.user?.id || "anonymous",
    };

    this.metrics.apiRequests.push(metric);
    if (this.metrics.apiRequests.length > this.maxMetrics) {
      this.metrics.apiRequests.shift();
    }

    // Track slow requests (>1s)
    if (duration > 1000) {
      this.metrics.slowQueries.push({
        ...metric,
        type: "slow_request",
      });
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries.shift();
      }
    }
  }

  /**
   * Track database query
   */
  trackQuery(query, duration, params = {}) {
    const metric = {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      timestamp: Date.now(),
      params: Object.keys(params).length,
    };

    this.metrics.dbQueries.push(metric);
    if (this.metrics.dbQueries.length > this.maxMetrics) {
      this.metrics.dbQueries.shift();
    }

    // Track slow queries (>500ms)
    if (duration > 500) {
      this.metrics.slowQueries.push({
        ...metric,
        type: "slow_query",
      });
      if (this.metrics.slowQueries.length > 100) {
        this.metrics.slowQueries.shift();
      }
    }
  }

  /**
   * Track error
   */
  trackError(error, context = {}) {
    const metric = {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      timestamp: Date.now(),
      context,
    };

    this.metrics.errors.push(metric);
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
  }

  /**
   * Get performance stats
   */
  getStats(timeWindow = 3600000) {
    // Last hour by default
    const cutoff = Date.now() - timeWindow;

    const recentRequests = this.metrics.apiRequests.filter(
      (m) => m.timestamp > cutoff,
    );
    const recentQueries = this.metrics.dbQueries.filter(
      (m) => m.timestamp > cutoff,
    );
    const recentErrors = this.metrics.errors.filter(
      (m) => m.timestamp > cutoff,
    );

    const avgRequestTime =
      recentRequests.length > 0
        ? recentRequests.reduce((sum, m) => sum + m.duration, 0) /
          recentRequests.length
        : 0;

    const avgQueryTime =
      recentQueries.length > 0
        ? recentQueries.reduce((sum, m) => sum + m.duration, 0) /
          recentQueries.length
        : 0;

    // Group by endpoint
    const endpointStats = {};
    recentRequests.forEach((req) => {
      const key = `${req.method} ${req.path}`;
      if (!endpointStats[key]) {
        endpointStats[key] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          errors: 0,
        };
      }
      endpointStats[key].count++;
      endpointStats[key].totalDuration += req.duration;
      endpointStats[key].avgDuration =
        endpointStats[key].totalDuration / endpointStats[key].count;
      if (req.statusCode >= 400) {
        endpointStats[key].errors++;
      }
    });

    return {
      requests: {
        total: recentRequests.length,
        avgDuration: avgRequestTime,
        p95: this.percentile(
          recentRequests.map((r) => r.duration),
          95,
        ),
        p99: this.percentile(
          recentRequests.map((r) => r.duration),
          99,
        ),
        byEndpoint: endpointStats,
      },
      queries: {
        total: recentQueries.length,
        avgDuration: avgQueryTime,
        p95: this.percentile(
          recentQueries.map((q) => q.duration),
          95,
        ),
        p99: this.percentile(
          recentQueries.map((q) => q.duration),
          99,
        ),
      },
      errors: {
        total: recentErrors.length,
        recent: recentErrors.slice(-10),
      },
      slowQueries: this.metrics.slowQueries.slice(-20),
    };
  }

  /**
   * Calculate percentile
   */
  percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(maxAge = 86400000) {
    // 24 hours
    const cutoff = Date.now() - maxAge;
    this.metrics.apiRequests = this.metrics.apiRequests.filter(
      (m) => m.timestamp > cutoff,
    );
    this.metrics.dbQueries = this.metrics.dbQueries.filter(
      (m) => m.timestamp > cutoff,
    );
    this.metrics.errors = this.metrics.errors.filter(
      (m) => m.timestamp > cutoff,
    );
  }
}

// Create singleton instance
const monitor = new PerformanceMonitor();

// Cleanup old metrics every hour
setInterval(() => {
  monitor.clearOldMetrics();
}, 3600000);

/**
 * Middleware to track request performance
 */
function performanceMiddleware(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    monitor.trackRequest(req, res, duration);
  });

  next();
}

/**
 * Wrap database query to track performance
 */
function trackQuery(db, query, params = []) {
  const start = Date.now();
  const result = db.prepare(query).all(...params);
  const duration = Date.now() - start;
  monitor.trackQuery(query, duration, params);
  return result;
}

function trackQueryGet(db, query, params = []) {
  const start = Date.now();
  const result = db.prepare(query).get(...params);
  const duration = Date.now() - start;
  monitor.trackQuery(query, duration, params);
  return result;
}

function trackQueryRun(db, query, params = []) {
  const start = Date.now();
  const result = db.prepare(query).run(...params);
  const duration = Date.now() - start;
  monitor.trackQuery(query, duration, params);
  return result;
}

module.exports = {
  monitor,
  performanceMiddleware,
  trackQuery,
  trackQueryGet,
  trackQueryRun,
};
