# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AnchorMarks is a self-hosted bookmark manager with browser extensions (Chrome/Edge/Firefox), a REST API, Flow Launcher plugin, and SQLite backend. It is a monorepo with two apps: `apps/server` (Express.js) and `apps/client` (Vite + TypeScript).

## Common Commands

All development tasks are managed through `make`. Run `make help` to see all targets.

```bash
# Development
make dev-full              # Start backend + Vite HMR frontend together
make dev                   # Backend only (serves built frontend from apps/server/public/)
make dev-vite              # Frontend only (requires backend running on port 3000)
make build                 # Build frontend for production → apps/server/public/

# Testing
make test                  # Run full test suite
make test-watch            # Watch mode
make test-coverage         # Coverage report
make test-e2e              # Playwright E2E tests (headless)
make test-e2e-ui           # Playwright with UI mode

# Lint
make lint                  # Run ESLint + Prettier (auto-fix)
make lint-check            # Check only, no fix

# Docker
make build-docker          # Build Docker image
make run-docker            # Start via Docker Compose
```

## Architecture

### Backend (`apps/server`)

- **Entry**: `apps/server/index.js` → `apps/server/app.js` (monolithic Express app with all routes)
- **Database**: SQLite via `better-sqlite3`. Schema defined in `apps/server/models/database.js`. WAL mode enabled for concurrency. All queries are synchronous (`db.prepare().all()` / `.run()` / `.get()`).
- **No ORM** — raw parameterized SQL only. Never use string concatenation in queries.
- **Config**: `apps/server/config/index.js` validates and exposes all env vars.
- **Routes/Controllers**: `apps/server/routes/` wires routes; `apps/server/controllers/` contains handlers. Helpers in `apps/server/helpers/` (favicon, metadata, import, fuzzy search, SSRF guards, etc.).

### Frontend (`apps/client`)

- **Entry**: `apps/client/src/main.ts` → `apps/client/src/App.ts`
- **No framework** — vanilla TypeScript with DOM manipulation via `innerHTML`.
- **State**: Module-level variables in `apps/client/src/features/state.ts`. After any API mutation, reload from server and re-render (never assume local state matches DB).
- **API layer**: `apps/client/src/services/api.ts` — handles CSRF token injection and JWT cookies automatically. Import as `import { api } from "@services/api.ts"`.
- **Path aliases**: `@features/`, `@components/`, `@utils/`, `@services/` (configured in `vite.config.js`).
- **Types**: All shared interfaces (`Bookmark`, `Folder`, `Tag`, `User`, `FilterConfig`, etc.) live in `apps/client/src/types.ts`.
- **Build output**: Static bundle written to `apps/server/public/` and served by Express in production.

### Data Model

| Table               | Key columns                                                                        |
| ------------------- | ---------------------------------------------------------------------------------- |
| `users`             | id, username, email, password (bcrypt), api_key                                    |
| `bookmarks`         | id, user_id, folder_id, url, title, tags (JSON), favicon, is_favorite, click_count |
| `folders`           | id, user_id, parent_id, name, color, icon, position                                |
| `tags`              | id, user_id, name, color, icon                                                     |
| `bookmark_tags`     | bookmark_id, tag_id (junction)                                                     |
| `smart_collections` | id, user_id, name, rules (JSON)                                                    |
| `user_settings`     | user_id, theme, view_mode, dashboard_config (JSON)                                 |

### Authentication & Security

1. Login → server sets **httpOnly JWT cookie** (no localStorage).
2. Response includes a **CSRF token** stored in frontend memory.
3. All POST/PUT/DELETE requests include `X-CSRF-Token` header.
4. **API keys** (for Flow Launcher / third-party tools) are whitelisted to read-only endpoints only.
5. **Every DB query must filter by `user_id`** — this is the core multi-tenancy security control.
6. **SSRF guards**: call `isPrivateAddress()` before fetching any external URL (favicon, metadata).

## Key Conventions

### API Response Format

```javascript
// Success (list or single object):
{ success: true, data: [...] }   // or just the object directly
// Error:
{ error: "reason" }             // with appropriate HTTP status code
```

### Adding a Backend Endpoint

```javascript
app.post("/api/bookmarks", requireAuth, validateCsrf, (req, res) => {
  const userId = req.user.id; // always from JWT middleware
  // validate ownership before mutating
  const existing = db.prepare("SELECT id FROM bookmarks WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) return res.status(403).json({ error: "Not found" });
  // use parameterized query
  db.prepare("INSERT INTO bookmarks (id, user_id, ...) VALUES (?, ?, ...)").run(uuidv4(), userId, ...);
  return res.json({ ... });
});
```

### Adding a Frontend API Call

```typescript
import { api } from "@services/api.ts";
import type { Bookmark } from "@types.ts";

const result = await api<Bookmark>("/bookmarks", {
  method: "POST",
  body: JSON.stringify(data),
});
await loadBookmarks(); // reload from server
renderBookmarks(); // re-render
```

## Testing Patterns

- Tests live in `apps/server/__tests__/`.
- Use `supertest` + `request.agent(app)` for cookie/session persistence across requests.
- Create unique users per test (timestamp-based names) to avoid conflicts.
- Set `DB_PATH=anchormarks-test.db` and clean it up in `afterAll`.

## Git Workflow

Use the **Feature Branch Workflow**:

- `feature/description` — new features
- `bugfix/description` — bug fixes
- `chore/description` — maintenance

Never commit directly to `main`. Changes go through a PR.

## Before Submitting Changes

1. Run `make test` — all tests must pass.
2. Run `make lint` — no lint errors.
3. For new features, update `apps/server/public/help.html`.
4. Add/update tests for any new endpoints.

## Common Pitfalls

- Forgetting `user_id` filter in DB queries (security issue).
- Missing `validateCsrf` middleware on state-changing routes (returns 403).
- Using string concatenation in SQL (use parameterized queries).
- Modifying frontend state after an API call without reloading from server.
- Hardcoding secrets — always use `process.env.*`.
