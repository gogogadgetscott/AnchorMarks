# Security Assessment Report — Pre-Flight Production Audit

**Product:** AnchorMarks (TypeScript/Express codebase)  
**Audit Type:** Pre-Flight Production Security (SOC2/ISO 27001–oriented)  
**Date:** February 22, 2025  
**Role:** Lead Security Auditor & Compliance Officer  

---

## Executive Summary

This report documents a production-readiness security audit of the AnchorMarks Express server application. The audit covered **production hardening** (middleware, headers, process management, environment/secrets), **logic and data flow** (tenant isolation, mass assignment, dependency health), and **Docker/deployment** configuration.

**Summary of findings:** 4 Critical/High, 5 Medium, 3 Low. Key strengths include: Helmet with CSP and HSTS (when SSL is enabled), strict CORS in production, custom rate limiting with auth hardening, JWT secret validation in production, and process running as non-root in Docker. Key risks: default secrets in Docker Compose/Dockerfile, optional tenant scoping in model APIs, and dependency vulnerabilities (minimatch/glob ReDoS) in transitive dependencies.

---

## 1. Production Hardening Audit

### 1.1 Middleware Chain

| Control | Status | Notes |
|--------|--------|--------|
| Helmet | ✅ Present | `apps/server/app.js` L164–179: contentSecurityPolicy, HSTS (when SSL), COOP, referrerPolicy, frameguard |
| CORS | ✅ Strict in production | `config.resolveCorsOrigin()` enforces whitelist; `CORS_ORIGIN=*` throws in production (`config/index.js` L55–56) |
| Rate limiting | ⚠️ Custom (not `express-rate-limit`) | `apps/server/middleware/rateLimiter.js`: in-memory; auth 10/min, general 60/min, maintenance 20/min per IP; health exempt; `RATE_LIMIT_DISABLED` can disable |
| HSTS | ✅ When SSL | `helmet({ hsts: config.SSL_ENABLED ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false })` |
| CSP | ✅ Present | Environment-aware; production uses `scriptSrc: ["'self']`; development allows unsafe-inline/unsafe-eval for Vite HMR |

---

## 2. Detailed Findings

---

### SEC-001

**Severity:** Critical  

**Finding:** Docker Compose supplies default values for `JWT_SECRET` and `CORS_ORIGIN` that are insecure or placeholder.

**Technical Deep-Dive:**  
In `tooling/docker/docker-compose.yml` (L11–12, L20–21), the `anchormarks` service sets:

- `JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-key-change-this-to-a-random-string}`
- `CORS_ORIGIN: ${CORS_ORIGIN:-https://yourdomain.com}`

If the operator does not set `JWT_SECRET` or `CORS_ORIGIN` in the environment (e.g. no `.env` or empty env), the container runs with these defaults. The app’s `config.validateSecurityConfig()` rejects known-insecure JWT values and missing CORS in production (`config/index.js` L35–44), so the process will throw at startup—but the **image and Compose file still encode and expose insecure defaults**, encouraging misconfiguration and failing closed only at runtime.

**Business Impact:** If a deployment ever ran without validation (e.g. validation bypassed or NODE_ENV mis-set), attackers could forge JWTs or abuse permissive CORS, leading to **session hijack, account takeover, and cross-origin data exposure**.

**Remediation:**

1. **Remove default secrets from Compose.** Do not use `:-default` for `JWT_SECRET` or `CORS_ORIGIN`; pass them through from the host (e.g. `.env`). When unset, they will be empty and the app’s `validateSecurityConfig()` will throw at startup in production. Docker Compose does not support required-variable syntax (e.g. `${VAR?message}`) in the `environment` section, so relying on app startup validation is the correct approach.

```yaml
# tooling/docker/docker-compose.yml — no defaults for secrets
environment:
  NODE_ENV: ${NODE_ENV:-production}
  PORT: ${PORT:-3000}
  HOST: ${HOST:-0.0.0.0}
  DB_PATH: ${DB_PATH:-/apps/database/anchormarks.db}
  JWT_SECRET: ${JWT_SECRET}   # no :-default; set in .env or host env
  CORS_ORIGIN: ${CORS_ORIGIN} # no :-default; app fails at startup if unset
```

2. **Document** in README or runbook: “For production, set `JWT_SECRET` and `CORS_ORIGIN`; never rely on defaults.” *(Done: README.md and INSTALL.md.)*

**Verification:**  
- Start stack without `JWT_SECRET`/`CORS_ORIGIN`: app must fail fast with a clear error.  
- Start with strong `JWT_SECRET` and valid `CORS_ORIGIN`: app starts and only allowed origins can access the API.

---

### SEC-002

**Severity:** High  

**Finding:** Dockerfile build args set insecure default values for `JWT_SECRET` and `CORS_ORIGIN`.

**Technical Deep-Dive:**  
`tooling/docker/Dockerfile` (L58–59):

```dockerfile
ARG JWT_SECRET=your-super-secret-jwt-key-change-this-to-a-random-string
ARG CORS_ORIGIN=*
```

These are baked into the image as default `ENV` (L65–70). Any run that does not override them (e.g. `docker run image` without `-e JWT_SECRET=...`) will use these values. Production validation will still throw on `CORS_ORIGIN=*` and on the known-insecure JWT list, but **defaults should not be insecure**.

**Business Impact:** Same as SEC-001: risk of **credential/session compromise** and **CORS misuse** if validation is ever bypassed or misconfigured.

**Remediation:**

- Do not set default `ARG`/`ENV` for secrets. Only set non-secret defaults (e.g. `PORT`, `NODE_ENV`):

```dockerfile
ARG NODE_ENV=production
ARG PORT=3000
ARG HOST=0.0.0.0
ARG DB_PATH=/apps/database/anchormarks.db
# Do not default JWT_SECRET or CORS_ORIGIN
ARG JWT_SECRET
ARG CORS_ORIGIN

ENV NODE_ENV=$NODE_ENV PORT=$PORT HOST=$HOST DB_PATH=$DB_PATH \
    JWT_SECRET=$JWT_SECRET CORS_ORIGIN=$CORS_ORIGIN \
    SSL_ENABLED=$SSL_ENABLED SSL_CERT=$SSL_CERT WORKDIR=/apps/server
```

- Ensure runtime always provides `JWT_SECRET` and `CORS_ORIGIN` (e.g. via Compose `environment` or orchestration secrets).

**Verification:**  
Build image without passing `JWT_SECRET`/`CORS_ORIGIN` and run with `NODE_ENV=production`: app should fail at startup. Build/run with proper env: app starts and CORS/JWT behave as configured.

---

### SEC-003

**Severity:** Medium  

**Finding:** Model helpers `getFolderById` and `getDashboardView` can return another tenant’s data when `userId` is omitted.

**Technical Deep-Dive:**  
- `apps/server/models/folder.js` (L16–24): `getFolderById(db, id, userId)` — when `userId` is `undefined` or `null`, it runs `SELECT * FROM folders WHERE id = ?` with no user filter.  
- `apps/server/models/dashboard.js` (L26–32): `getDashboardView(db, id, userId)` — same pattern: fallback `SELECT * FROM dashboard_views WHERE id = ?` without `user_id`.

Current route usage passes `req.user.id` (e.g. `controllers/folders.js` L87, L146; `routes/dashboard.js` L86–88), so **today’s API is tenant-safe**. The risk is **API contract**: any future or internal caller that passes only `id` (e.g. `getFolderById(db, id)`) would receive **cross-tenant data**.

**Business Impact:** **Cross-tenant data leakage** (PII, bookmarks, folder structure) if a developer or new code path calls these helpers without `userId`.

**Remediation:**

1. **Require `userId`** and remove the unscoped branch:

```javascript
// apps/server/models/folder.js
function getFolderById(db, id, userId) {
  if (userId === undefined || userId === null) {
    throw new Error("getFolderById requires userId for tenant isolation");
  }
  const row = db.prepare("SELECT * FROM folders WHERE id = ? AND user_id = ?").get(id, userId);
  return row || null;
}
```

2. Apply the same pattern to `getDashboardView` in `apps/server/models/dashboard.js`.  
3. Audit all call sites (sync, controllers, routes) and ensure they pass `req.user.id` or the correct user context.

**Verification:**  
- Unit tests: call `getFolderById(db, id)` without `userId` and expect an error.  
- Integration test: as User A, request folder by ID that belongs to User B; expect 404 or equivalent, never User B’s data.

---

### SEC-004

**Severity:** Medium  

**Finding:** Bookmark and folder update paths that omit `user_id` in `WHERE` clauses reduce defense-in-depth for tenant isolation.

**Technical Deep-Dive:**  
- `apps/server/models/bookmark.js` (L379–390): `setThumbnailLocal(db, bookmarkId, localPath, userId)` — when `userId` is falsy, it runs `UPDATE bookmarks SET thumbnail_local = ? WHERE id = ?` with no `user_id`. Call site in `routes/bookmarks.js` (L518–522) does pass `req.user.id`, so current behavior is scoped; the **model** still allows unscoped updates.  
- `apps/server/helpers/utils.js` (L63–65, L89–91): `fetchFavicon` updates favicon with `UPDATE bookmarks SET favicon_local = ?, favicon = ? WHERE id = ?` — no `user_id`. Callers pass `bookmarkId` from in-request flows that are user-scoped; a bug or new code path could pass another user’s ID.  
- `apps/server/models/sync.js` (L75–77): `UPDATE folders SET name = ?, color = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?` — no `user_id`. Preceding code ensures the folder was fetched with `user_id`, so the row is tenant-scoped; the statement itself is not.

**Business Impact:** **Cross-tenant data modification** (overwriting another user’s bookmark/folder metadata) if any caller ever passes an ID without verifying ownership or if a bug introduces the wrong ID.

**Remediation:**

1. **setThumbnailLocal:** Always require `userId` and use it in the update:

```javascript
function setThumbnailLocal(db, bookmarkId, localPath, userId) {
  if (!userId) throw new Error("setThumbnailLocal requires userId");
  return db
    .prepare("UPDATE bookmarks SET thumbnail_local = ? WHERE id = ? AND user_id = ?")
    .run(localPath, bookmarkId, userId);
}
```

2. **utils.js fetchFavicon:** Add an optional `userId` parameter and, when provided, use `WHERE id = ? AND user_id = ?` for the bookmark update. Prefer passing `userId` from all call sites that have it.  
3. **sync.js folder update:** Use `WHERE id = ? AND user_id = ?` and pass `userId` in `.run(..., folder.id, userId)`.

**Verification:**  
- Tests: call `setThumbnailLocal` without `userId` and expect throw.  
- Test sync with two users; ensure folder updates only affect the correct user’s row.

---

### SEC-005

**Severity:** Medium  

**Finding:** Metadata queue processor reads bookmark by `id` only, without `user_id` check.

**Technical Deep-Dive:**  
`apps/server/helpers/metadata-queue.js` (L86–88): the processor does `db.prepare("SELECT id, url FROM bookmarks WHERE id = ?").get(bookmarkId)`. Queue entries are pushed from in-process flows (e.g. bookmark creation) that are user-scoped, so in practice `bookmarkId` belongs to the current context. There is no **defense-in-depth** check that the bookmark belongs to a given user before fetching metadata or updating state.

**Business Impact:** Low under current design; risk increases if the queue is ever shared across tenants or if IDs from one user are enqueued in error—**potential cross-tenant metadata association or information disclosure**.

**Remediation:**  
Store `(bookmarkId, userId)` in the queue (or resolve `userId` from DB before processing) and use `SELECT id, url FROM bookmarks WHERE id = ? AND user_id = ?` so processing is explicitly tenant-scoped.

**Verification:**  
- Enqueue a bookmark ID from User A in a context that should be User B; ensure the processor does not use it, or that the DB query returns no row.

---

### SEC-006

**Severity:** Medium  

**Finding:** Request body used as fallback when validation is optional (`req.validated || req.body`), increasing mass-assignment risk on routes that omit or misapply validation.

**Technical Deep-Dive:**  
Multiple routes use `req.validated || req.body` (e.g. `routes/collections.js` L50, L71; `routes/dashboard.js` L30, L51; `routes/bookmarkViews.js` L29, L50; `routes/maintenance.js` L47; `routes/sync.js` L32; `routes/importExport.js` L49, L113; `routes/smartOrganization.js` L161). When `validateBody(schema)` is present, `req.validated` is set from Zod `.strict()` output, which limits fields. When validation is optional (`...(validateBody ? [validateBody(schemas.xyz)] : [])`), a missing or misconfigured schema leaves **raw `req.body`** in use, allowing extra fields to be passed through to models or DB.

**Business Impact:** **Mass assignment**: attackers could send additional JSON fields (e.g. `user_id`, `id`, internal flags) and potentially influence backend behavior or persistence if any layer spreads the object into updates.

**Remediation:**

1. **Explicit DTOs:** For every state-changing route, define a small TypeScript/JS type or Zod schema and **never** pass `req.body` directly into `create*`/`update*` model calls. Map only allowed fields from `req.validated` (or from a parsed body that was validated) into a DTO object.  
2. **No fallback to raw body for updates:** Use `req.validated` only when validation is applied; if validation is not applied, respond 400 or require validation. Example:

```javascript
// Instead of: const { name, config } = req.validated || req.body;
const data = req.validated;
if (!data) return res.status(400).json({ error: "Validation required" });
const { name, config } = data;
```

3. Ensure all create/update routes use `validateBody(schema)` with a `.strict()` schema and that models receive only the explicit DTO fields.

**Verification:**  
- Send requests with extra body fields (e.g. `user_id`, `id`) to update endpoints; confirm they are ignored or rejected.
- Remove validation from one route and confirm the API returns 400 or does not persist unsanitized body.

---

### SEC-007

**Severity:** Low  

**Finding:** Rate limiting is implemented with a custom in-memory module instead of the industry-standard `express-rate-limit` package.

**Technical Deep-Dive:**  
`apps/server/middleware/rateLimiter.js` implements its own sliding-window style limiter (per-IP maps, cleanup interval). The app does not use the `express-rate-limit` package. Functionally, auth endpoints are capped (e.g. 10/min) and general API is capped (e.g. 60/min), with options to skip static assets, health, maintenance, and some auth read paths.

**Business Impact:** No direct vulnerability. Slight risk of **inconsistent behavior** (e.g. no distributed rate limit, no standard headers like `RateLimit-*`) and **maintenance burden** compared to a well-audited library.

**Remediation:**  
Consider migrating to `express-rate-limit` (with a persistent store if scaling to multiple instances) and aligning options (auth vs general limits, skip list). If retaining custom code, document the design and add tests for limits and bypass conditions; optionally add `RateLimit-Limit` / `RateLimit-Remaining` response headers for clients.

**Verification:**  
- Exceed auth and general limits and confirm 429 and (if applicable) `Retry-After`.  
- Confirm health/maintenance paths are not rate-limited as intended.

---

### SEC-008

**Severity:** Low  

**Finding:** Rate limiter explicitly skips `/api/maintenance` and `/api/health`, allowing unrestricted request volume to those paths.

**Technical Deep-Dive:**  
`apps/server/middleware/rateLimiter.js` (L118–125): requests to `/api/maintenance` and `/api/health` skip the general rate limit. Maintenance endpoints (e.g. check-link, bulk operations) are authenticated but can be resource-intensive; health is often used by load balancers and should be cheap. Unrestricted access to maintenance could allow an authenticated user to **stress the server** or downstream services (e.g. HEAD requests to arbitrary URLs).

**Business Impact:** **Resource exhaustion or DoS** by a single authenticated user repeatedly calling maintenance endpoints; possible abuse of check-link to use the server as a proxy/scanner.

**Remediation:**  
- Apply a **separate, stricter** rate limit to `/api/maintenance` (e.g. 20/min per user or per IP) while keeping health exempt or very high.  
- Ensure maintenance handlers enforce timeouts and (where applicable) private-address checks (already present for check-link in production).

**Status:** Addressed. A separate maintenance rate limit is applied in `rateLimiter.js`: 20/min per IP (configurable via `RATE_LIMIT_MAINTENANCE_MAX`, `RATE_LIMIT_MAINTENANCE_WINDOW_MS`). Health remains exempt. Check-link already enforces a 5s timeout and production private-address checks.

**Verification:**  
- As an authenticated user, send a burst of requests to `/api/maintenance/*`; confirm a cap is enforced or that operational impact is acceptable.

---

### SEC-009

**Severity:** Low  

**Finding:** JWT_SECRET has a development fallback; production correctly rejects missing or weak secrets.

**Technical Deep-Dive:**  
`apps/server/config/index.js` (L67–69): `JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex")`. In production, `validateSecurityConfig()` (L35–40) throws if `JWT_SECRET` is missing or in `INSECURE_SECRETS`. So production never uses the fallback; the fallback only applies in development, where it is acceptable for convenience.

**Business Impact:** None in production. Slight risk if `NODE_ENV` were incorrectly set to non-production while deployed; validation would not run and a weak or missing secret could be used.

**Remediation:**  
- Optional: in production, avoid reading a fallback at all (e.g. `const JWT_SECRET = process.env.JWT_SECRET;` and let it be `undefined` so validation fails).  
- Ensure deployment pipelines set `NODE_ENV=production` and that production images do not rely on fallbacks.

**Verification:**  
- Start app with `NODE_ENV=production` and no `JWT_SECRET`; must throw.  
- Start with `NODE_ENV=development` and no `JWT_SECRET`; app starts (random secret).

---

### SEC-010

**Severity:** High (dependency)

**Finding:** Transitive dependency chain (swagger-jsdoc → glob → minimatch) includes a high-severity ReDoS advisory (minimatch).

**Technical Deep-Dive:**  
`npm audit` reports: **minimatch** (GHSA-3ppc-4f35-3m26) ReDoS via repeated wildcards; **glob** and **swagger-jsdoc** affected. Root `package.json` already has overrides (e.g. `"minimatch": ">=10.2.1"`, `"glob": ">=11.0.0"`). Audit may still report the issue depending on workspace resolution; the server app uses `swagger-jsdoc` for API docs.

**Business Impact:** **Denial of service** if an attacker can supply crafted input that is passed into minimatch/glob (e.g. via swagger-jsdoc parsing of path patterns or config). Risk is lower if swagger-jsdoc is only used at build/startup with controlled config.

**Remediation:**

1. Ensure overrides are applied in the workspace where the server is built: in root `package.json`, keep overrides for `minimatch`, `glob`, and `swagger-jsdoc` (e.g. `"swagger-jsdoc": { "glob": "^11.0.0", "minimatch": ">=10.2.1" }`) and run `npm install` from repo root. If `node_modules` was created by Docker/another user, remove it or fix permissions first.  
2. Re-run `npm audit` and fix or accept remaining issues.  
3. Consider replacing or updating `swagger-jsdoc` to a version that depends on patched glob/minimatch, or confine swagger-jsdoc to dev-only if API docs are not needed in production.

**Verification:**  
- `npm audit` shows no high/critical for the server’s dependency tree.  
- Run tests and production build; confirm API docs still generate if used.

---

### SEC-011

**Severity:** Low  

**Finding:** Process and Docker run as non-root; graceful shutdown handles SIGTERM.

**Technical Deep-Dive:**  
- **Process:** `apps/server/app.js` (L331–353) registers handlers for `SIGINT` and `SIGTERM` that stop the audit timer, metadata queue, thumbnail browser, and close the DB before `process.exit(0)`.  
- **Docker:** `tooling/docker/docker-entrypoint.sh` (L19) runs the server with `su-exec node node index.js`. The Dockerfile (L79) sets `chown -R node:node` for app dirs. The process does **not** run as UID 0.

**Business Impact:** Positive. Reduces impact of container compromise and allows orchestrators to signal graceful shutdown (SIGTERM).

**Remediation:**  
None required. Optionally add an explicit `USER node` in the Dockerfile before `ENTRYPOINT` for clarity, and document signal handling in runbooks.

**Verification:**  
- Inside the container, `ps` shows the node process owned by `node`.  
- Send SIGTERM to the process; logs show “Shutting down gracefully (SIGTERM)…” and the process exits after cleanup.

---

## 3. Positive Observations

- **Helmet:** CSP, HSTS (when SSL), COOP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy are configured.  
- **CORS:** Production requires explicit `CORS_ORIGIN` whitelist; `*` is rejected.  
- **Secrets:** Production startup validates JWT_SECRET and CORS_ORIGIN; insecure JWT list is checked.  
- **Auth:** JWT and API-key auth with scoped API key whitelist; CSRF for state-changing browser requests; API key bypass for CSRF is documented.  
- **Tenant isolation:** Most DB access uses `user_id`/`userId`; routes pass `req.user.id` to models.  
- **Validation:** Zod schemas with `.strict()` for many endpoints; validation middleware centralizes body/query parsing.  
- **Docker:** Process runs as non-root (`su-exec node`); entrypoint prepares dirs and starts server cleanly.

---

## 4. Remediation Priority

| Priority | ID       | Action |
|----------|----------|--------|
| P0       | SEC-001  | Remove default JWT_SECRET/CORS_ORIGIN from docker-compose for production. |
| P0       | SEC-002  | Remove or avoid default JWT_SECRET/CORS_ORIGIN in Dockerfile. |
| P1       | SEC-010  | Resolve minimatch/glob ReDoS (overrides or dependency update). |
| P1       | SEC-003  | Require `userId` in getFolderById/getDashboardView; remove unscoped branch. |
| P2       | SEC-004  | Add user_id to setThumbnailLocal, favicon UPDATE, and sync folder UPDATE. |
| P2       | SEC-006  | Use explicit DTOs; avoid `req.validated \|\| req.body` for updates. |
| P2       | SEC-005  | Scope metadata queue bookmark lookup by user_id. |
| P3       | SEC-007  | Consider express-rate-limit and/or standard rate-limit headers. |
| P3       | SEC-008  | Apply a stricter rate limit to /api/maintenance. |

---

## 5. Document Control

| Version | Date       | Author/Role              | Changes |
|---------|------------|---------------------------|---------|
| 1.0     | 2025-02-22 | Lead Security Auditor     | Initial pre-flight assessment |

---

*This report is intended for internal and auditor use to support SOC2/ISO 27001 alignment and production hardening. Findings and remediation should be tracked to closure.*
