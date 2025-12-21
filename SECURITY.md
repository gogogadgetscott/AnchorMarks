# Security Policy

## Reporting a Vulnerability

- Please email security@anchormarks.app (or open a private security advisory on GitHub) with a clear description, reproduction steps, and potential impact.
- Do not create public issues for vulnerabilities until a fix is available.
- We aim to acknowledge reports within 3 business days and provide a remediation plan or fix within 14 days when feasible.

## Supported Versions

We currently support security fixes on the latest main branch and the most recent tagged release.

## Responsible Disclosure

- Avoid automated scans against production deployments without consent.
- Do not attempt to access another user's data.
- Credit will be given in release notes if desired.

## Auth & CSRF Flow

Developer reference: the authentication and CSRF protection flow is documented in the in-app help page under “Developer: Auth & CSRF”:

- `help.html#developer-auth-csrf`

---

## Security Measures

AnchorMarks implements the following security measures:

### Authentication & Authorization

- Password hashing using bcrypt with appropriate cost factor
- JWT-based session authentication with HTTP-only cookies
- CSRF token validation for state-changing operations
- API key authentication for programmatic access
- All database queries include user_id filtering for data isolation

### Input Validation & Sanitization

- Request body size limits (10MB max)
- URL validation before processing
- SQL injection prevention via parameterized queries (better-sqlite3)

### Network Security

- Helmet.js for security headers (CSP, X-Frame-Options, etc.)
- CORS configuration with credentials support
- SSRF protection: private/loopback IP blocking in production for favicon/metadata fetching
- Rate limiting on API endpoints

### Data Isolation

- Multi-tenant architecture with strict user data isolation
- No bookmark sharing between users
- No user-uploadable file storage

---

## Security Hardening Checklist

- [x] Helmet.js security headers
- [x] CSRF protection on mutations
- [x] Rate limiting
- [x] SSRF protection for outbound requests
- [x] Parameterized SQL queries
- [x] User data isolation
- [x] No file upload functionality
- [x] Content-Type enforcement on static assets
- [x] Subresource Integrity (SRI) infrastructure (see below)
- [x] Security audit logging (see below)

---

## Subresource Integrity (SRI)

**Current Status:** ✅ All scripts and stylesheets are self-hosted. No external CDN dependencies.

If you need to add external scripts or stylesheets from CDNs, use the SRI helper:

```bash
# Generate SRI hash for a URL
node apps/server/helpers/sri.js generate https://cdn.example.com/lib.js

# Output example:
# sha384-abc123...
```

Then add the `integrity` and `crossorigin` attributes:

```html
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous"
></script>
```

For stylesheets:

```html
<link
  rel="stylesheet"
  href="https://cdn.example.com/style.css"
  integrity="sha384-xyz789..."
  crossorigin="anonymous"
/>
```

---

## Security Audit Logging

AnchorMarks includes a comprehensive security audit logging system that tracks security-relevant events.

### Logged Events

| Event Type                | Severity | Description                                             |
| ------------------------- | -------- | ------------------------------------------------------- |
| `AUTH_LOGIN_SUCCESS`      | INFO     | Successful user login                                   |
| `AUTH_LOGIN_FAILURE`      | WARNING  | Failed login attempt (wrong password or user not found) |
| `AUTH_LOGOUT`             | INFO     | User logout                                             |
| `AUTH_REGISTER`           | INFO     | New user registration                                   |
| `AUTH_PASSWORD_CHANGE`    | INFO     | Password successfully changed                           |
| `AUTH_API_KEY_REGENERATE` | WARNING  | API key was regenerated                                 |
| `ACCESS_DENIED`           | WARNING  | Authorization failure                                   |
| `RATE_LIMIT_EXCEEDED`     | WARNING  | Rate limit triggered                                    |
| `CSRF_VALIDATION_FAILURE` | CRITICAL | CSRF token validation failed                            |
| `SUSPICIOUS_ACTIVITY`     | CRITICAL | Potentially malicious behavior detected                 |

### Stored Data

Each log entry includes:

- Timestamp
- Event type and severity
- User ID (if authenticated)
- Client IP address
- User agent
- Endpoint and HTTP method
- Additional context details (sanitized, no passwords/tokens)

### Configuration

Environment variables:

```bash
# Enable file logging (in addition to database)
SECURITY_LOG_FILE=true

# Log retention period in days (default: 90)
SECURITY_LOG_RETENTION_DAYS=90
```

### Querying Logs

The audit logs are stored in the `security_audit_log` table. Example queries:

```sql
-- Recent failed login attempts
SELECT * FROM security_audit_log
WHERE event_type = 'AUTH_LOGIN_FAILURE'
ORDER BY timestamp DESC LIMIT 50;

-- Security events by user
SELECT * FROM security_audit_log
WHERE user_id = 'user-uuid-here'
ORDER BY timestamp DESC;

-- Critical events in last 24 hours
SELECT * FROM security_audit_log
WHERE severity = 'CRITICAL'
AND timestamp > datetime('now', '-24 hours');
```
