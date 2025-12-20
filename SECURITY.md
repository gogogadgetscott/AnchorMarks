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

## Security Assessments

### GHSA-3pf9-5cjv-2w7q: Stored XSS via Shared Assets (linkding)

**Date Assessed:** 2024-12-20  
**Status:** ✅ NOT AFFECTED  
**Severity:** N/A (not applicable)

#### Vulnerability Summary
This vulnerability affects linkding versions ≤1.44.1 and allows stored XSS attacks through:
1. Uploading malicious HTML/SVG files as bookmark assets
2. Sharing bookmarks with other users
3. Victim viewing the shared asset, executing malicious scripts

#### Why AnchorMarks is Not Affected

| Attack Prerequisite | linkding | AnchorMarks |
|---------------------|----------|-------------|
| File/Asset Upload | ✅ Yes | ❌ No file upload capability |
| Bookmark Sharing | ✅ Yes | ❌ No sharing feature |
| Multi-user File Access | ✅ Yes | ❌ All data user-isolated |
| User-controlled Static Files | ✅ HTML/SVG served | ❌ Only system PNGs (favicons) |

#### Technical Details

1. **No File Upload Mechanism**
   - No multipart/form-data handling
   - No multer or similar file upload middleware
   - Import/export uses JSON text bodies, not file uploads

2. **No Sharing Features**
   - Database schema has no sharing columns (`is_shared`, `shared_with`, etc.)
   - All queries enforce `WHERE user_id = ?`
   - No public bookmark endpoints

3. **Static Assets are Controlled**
   - Only `/favicons/` (server-fetched PNGs) and `/thumbnails/` directories
   - No user-uploadable content storage
   - Static file serving limited to system-generated assets

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
- [ ] Subresource Integrity (SRI) for external scripts (if any added)
- [ ] Security audit logging (future enhancement)
