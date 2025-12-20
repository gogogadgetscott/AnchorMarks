/**
 * Security Audit Logger
 * 
 * Logs security-relevant events for compliance, debugging, and incident response.
 * Events are stored in the database and can optionally be written to a file.
 * 
 * Event Types:
 * - AUTH_LOGIN_SUCCESS: Successful login
 * - AUTH_LOGIN_FAILURE: Failed login attempt
 * - AUTH_LOGOUT: User logout
 * - AUTH_REGISTER: New user registration
 * - AUTH_PASSWORD_CHANGE: Password changed
 * - AUTH_API_KEY_REGENERATE: API key regenerated
 * - AUTH_SESSION_EXPIRED: Session expired/invalidated
 * - ACCESS_DENIED: Authorization failure
 * - RATE_LIMIT_EXCEEDED: Rate limit triggered
 * - CSRF_VALIDATION_FAILURE: CSRF token validation failed
 * - SUSPICIOUS_ACTIVITY: Potentially malicious behavior detected
 */

const fs = require('fs');
const path = require('path');

// Event type constants
const SecurityEventType = {
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_REGISTER: 'AUTH_REGISTER',
  AUTH_PASSWORD_CHANGE: 'AUTH_PASSWORD_CHANGE',
  AUTH_API_KEY_REGENERATE: 'AUTH_API_KEY_REGENERATE',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CSRF_VALIDATION_FAILURE: 'CSRF_VALIDATION_FAILURE',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
};

// Severity levels
const Severity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
};

// Map event types to severity
const eventSeverity = {
  [SecurityEventType.AUTH_LOGIN_SUCCESS]: Severity.INFO,
  [SecurityEventType.AUTH_LOGIN_FAILURE]: Severity.WARNING,
  [SecurityEventType.AUTH_LOGOUT]: Severity.INFO,
  [SecurityEventType.AUTH_REGISTER]: Severity.INFO,
  [SecurityEventType.AUTH_PASSWORD_CHANGE]: Severity.INFO,
  [SecurityEventType.AUTH_API_KEY_REGENERATE]: Severity.WARNING,
  [SecurityEventType.AUTH_SESSION_EXPIRED]: Severity.INFO,
  [SecurityEventType.ACCESS_DENIED]: Severity.WARNING,
  [SecurityEventType.RATE_LIMIT_EXCEEDED]: Severity.WARNING,
  [SecurityEventType.CSRF_VALIDATION_FAILURE]: Severity.CRITICAL,
  [SecurityEventType.SUSPICIOUS_ACTIVITY]: Severity.CRITICAL,
};

/**
 * Initialize the security audit log table in the database
 * @param {object} db - Database instance
 */
function initializeAuditLog(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      user_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      endpoint TEXT,
      method TEXT,
      details TEXT,
      success INTEGER DEFAULT 1
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON security_audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON security_audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_severity ON security_audit_log(severity);
  `);
}

/**
 * Extract client IP from request (handles proxies)
 * @param {object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         'unknown';
}

/**
 * Create the security audit logger
 * @param {object} db - Database instance
 * @param {object} options - Configuration options
 * @returns {object} - Logger instance with log methods
 */
function createSecurityAuditLogger(db, options = {}) {
  const {
    enableFileLogging = process.env.SECURITY_LOG_FILE === 'true',
    logFilePath = path.join(__dirname, '../../logs/security-audit.log'),
    retentionDays = 90,
  } = options;

  // Ensure log directory exists if file logging is enabled
  if (enableFileLogging) {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Prepared statement for inserting logs
  const insertStmt = db.prepare(`
    INSERT INTO security_audit_log 
    (event_type, severity, user_id, ip_address, user_agent, endpoint, method, details, success)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  /**
   * Log a security event
   * @param {string} eventType - Type of security event
   * @param {object} context - Event context
   */
  function log(eventType, context = {}) {
    const {
      userId = null,
      req = null,
      details = {},
      success = true,
    } = context;

    const severity = eventSeverity[eventType] || Severity.INFO;
    const ipAddress = req ? getClientIp(req) : null;
    const userAgent = req?.headers?.['user-agent'] || null;
    const endpoint = req?.originalUrl || req?.url || null;
    const method = req?.method || null;

    // Sanitize details - remove sensitive data
    const sanitizedDetails = { ...details };
    delete sanitizedDetails.password;
    delete sanitizedDetails.token;
    delete sanitizedDetails.apiKey;
    delete sanitizedDetails.api_key;

    try {
      // Write to database
      insertStmt.run(
        eventType,
        severity,
        userId,
        ipAddress,
        userAgent,
        endpoint,
        method,
        JSON.stringify(sanitizedDetails),
        success ? 1 : 0
      );

      // Write to file if enabled
      if (enableFileLogging) {
        const logEntry = {
          timestamp: new Date().toISOString(),
          eventType,
          severity,
          userId,
          ipAddress,
          userAgent: userAgent?.substring(0, 100), // Truncate long user agents
          endpoint,
          method,
          details: sanitizedDetails,
          success,
        };
        fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
      }

      // Console log for critical events
      if (severity === Severity.CRITICAL) {
        console.error(`[SECURITY CRITICAL] ${eventType}:`, {
          userId,
          ipAddress,
          endpoint,
          details: sanitizedDetails,
        });
      }
    } catch (err) {
      console.error('Failed to write security audit log:', err);
    }
  }

  /**
   * Query audit logs
   * @param {object} filters - Query filters
   * @returns {array} - Matching log entries
   */
  function query(filters = {}) {
    const {
      eventType = null,
      userId = null,
      severity = null,
      startDate = null,
      endDate = null,
      limit = 100,
      offset = 0,
    } = filters;

    let sql = 'SELECT * FROM security_audit_log WHERE 1=1';
    const params = [];

    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  /**
   * Get failed login attempts for a user/IP
   * @param {string} identifier - User ID or IP address
   * @param {number} windowMinutes - Time window in minutes
   * @returns {number} - Count of failed attempts
   */
  function getFailedLoginAttempts(identifier, windowMinutes = 15) {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM security_audit_log
      WHERE event_type = ?
      AND (user_id = ? OR ip_address = ?)
      AND success = 0
      AND timestamp > datetime('now', '-' || ? || ' minutes')
    `).get(SecurityEventType.AUTH_LOGIN_FAILURE, identifier, identifier, windowMinutes);
    
    return result?.count || 0;
  }

  /**
   * Cleanup old audit logs
   * @param {number} days - Delete logs older than this many days
   */
  function cleanup(days = retentionDays) {
    const result = db.prepare(`
      DELETE FROM security_audit_log
      WHERE timestamp < datetime('now', '-' || ? || ' days')
    `).run(days);
    
    return result.changes;
  }

  /**
   * Get summary statistics
   * @param {number} hours - Time window in hours (default 24)
   * @returns {object} - Summary statistics
   */
  function getStats(hours = 24) {
    const stats = db.prepare(`
      SELECT 
        event_type,
        severity,
        COUNT(*) as count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
      FROM security_audit_log
      WHERE timestamp > datetime('now', '-' || ? || ' hours')
      GROUP BY event_type, severity
      ORDER BY count DESC
    `).all(hours);

    return stats;
  }

  // Convenience methods for common events
  return {
    log,
    query,
    getFailedLoginAttempts,
    cleanup,
    getStats,
    
    // Convenience logging methods
    loginSuccess: (userId, req, details = {}) => 
      log(SecurityEventType.AUTH_LOGIN_SUCCESS, { userId, req, details, success: true }),
    
    loginFailure: (userId, req, details = {}) => 
      log(SecurityEventType.AUTH_LOGIN_FAILURE, { userId, req, details, success: false }),
    
    logout: (userId, req) => 
      log(SecurityEventType.AUTH_LOGOUT, { userId, req, success: true }),
    
    register: (userId, req, details = {}) => 
      log(SecurityEventType.AUTH_REGISTER, { userId, req, details, success: true }),
    
    passwordChange: (userId, req) => 
      log(SecurityEventType.AUTH_PASSWORD_CHANGE, { userId, req, success: true }),
    
    apiKeyRegenerate: (userId, req) => 
      log(SecurityEventType.AUTH_API_KEY_REGENERATE, { userId, req, success: true }),
    
    accessDenied: (userId, req, details = {}) => 
      log(SecurityEventType.ACCESS_DENIED, { userId, req, details, success: false }),
    
    rateLimitExceeded: (req, details = {}) => 
      log(SecurityEventType.RATE_LIMIT_EXCEEDED, { req, details, success: false }),
    
    csrfFailure: (userId, req, details = {}) => 
      log(SecurityEventType.CSRF_VALIDATION_FAILURE, { userId, req, details, success: false }),
    
    suspiciousActivity: (userId, req, details = {}) => 
      log(SecurityEventType.SUSPICIOUS_ACTIVITY, { userId, req, details, success: false }),

    // Export constants
    EventType: SecurityEventType,
    Severity,
  };
}

module.exports = {
  initializeAuditLog,
  createSecurityAuditLogger,
  SecurityEventType,
  Severity,
};
