# AGENTS.md

Universal AI agent instructions for AnchorMarks. Applies to Claude Code, GitHub Copilot, Cursor, and any other AI coding assistant.

## Project Overview

AnchorMarks is a self-hosted bookmark manager with browser extensions (Chrome/Edge/Firefox), a REST API, Flow Launcher plugin, and SQLite backend. It is a monorepo with two apps: `apps/server` (Express.js) and `apps/client` (Vite + TypeScript).

---

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

---

## Architecture

### Technology Stack

- **Backend**: Node.js 22+ / Express.js on SQLite (better-sqlite3)
- **Frontend**: TypeScript + Vite (`apps/client`) producing a static `public/` bundle
- **Security**: bcryptjs (passwords), JWT (auth tokens), CSRF tokens (state mutations), SSRF guards
- **Extensions**: Chrome/Edge/Firefox browser extension, Flow Launcher plugin

### Backend (`apps/server`)

- **Entry**: `apps/server/index.js` → `apps/server/app.js` (Express app)
- **Database**: SQLite via `better-sqlite3`. Schema in `apps/server/models/database.js`. WAL mode enabled.
- **No ORM** — raw parameterized SQL only. Never use string concatenation in queries.
- **Config**: `apps/server/config/index.js` validates and exposes all env vars.
- **Routes/Controllers**: `apps/server/routes/` wires routes; `apps/server/controllers/` contains handlers.
- **Helpers**: `apps/server/helpers/` — favicon, metadata, import, fuzzy search, SSRF guards, smart-organization (tag suggestion engine).

### Frontend (`apps/client`)

- **Entry**: `apps/client/src/main.ts` → `apps/client/src/App.ts`
- **No framework** — vanilla TypeScript with DOM manipulation via `innerHTML`.
- **State**: Module-level variables in `apps/client/src/features/state.ts`. After any API mutation, reload from server and re-render (never assume local state matches DB).
- **API layer**: `apps/client/src/services/api.ts` — handles CSRF token injection and JWT cookies automatically. Import as `import { api } from "@services/api.ts"`.
- **Path aliases**: `@features/`, `@components/`, `@utils/`, `@services/` (configured in `vite.config.js`).
- **Types**: All shared interfaces (`Bookmark`, `Folder`, `Tag`, `User`, `FilterConfig`, etc.) live in `apps/client/src/types.ts`.
- **Build output**: Static bundle written to `apps/server/public/` and served by Express in production.

### Data Model

| Table               | Key columns                                                                         |
| ------------------- | ----------------------------------------------------------------------------------- |
| `users`             | id, username, email, password (bcrypt), api_key                                     |
| `bookmarks`         | id, user_id, folder_id, url, title, tags (JSON), favicon, is_favorite, click_count  |
| `folders`           | id, user_id, parent_id, name, color, icon, position                                 |
| `tags`              | id, user_id, name, color, icon                                                      |
| `bookmark_tags`     | bookmark_id, tag_id (junction)                                                      |
| `smart_collections` | id, user_id, name, rules (JSON)                                                     |
| `user_settings`     | user_id, theme, view_mode, dashboard_config (JSON)                                  |

### File Organization

- `apps/server/app.js` – All API routes, middleware, DB logic (monolithic by design)
- `apps/server/controllers/` – Route handlers (`auth.js`, `bookmarks.js`, `folders.js`, `tags.js`)
- `apps/server/helpers/` – Helpers (favicon.js, import.js, metadata.js, smart-organization.js, etc.)
- `apps/server/models/` – Data access models and DB helpers
- `apps/server/routes/` – Express route wiring
- `apps/server/__tests__/` – Test files
- `apps/client/` – Frontend source (Vite + TypeScript), `public/` assets
- `apps/server/public/` – Generated favicons and thumbnails (`public/favicons/`, `public/thumbnails/`)

---

## Authentication & Security

1. Login → server sets **httpOnly JWT cookie** (no localStorage).
2. Response includes a **CSRF token** stored in frontend memory.
3. All POST/PUT/DELETE requests include `X-CSRF-Token` header.
4. **API keys** (for Flow Launcher / third-party tools) are whitelisted to read-only endpoints only.
5. **Every DB query must filter by `user_id`** — this is the core multi-tenancy security control.
6. **SSRF guards**: call `isPrivateAddress()` before fetching any external URL (favicon, metadata).
7. **No secrets in code** — use `process.env.*`; never hardcode credentials.
8. **Input validation** — sanitize URLs, folder names, tag names before DB insert.
9. **No API key logging** — filter from logs; use `NODE_ENV=production` checks.

---

## Git Workflow Policy

**ALWAYS** follow the Feature Branch Workflow. **NEVER** commit directly to `main`.

### Before Writing Any Code

1. Ensure the repo is clean and up to date with `main`.
2. Create and switch to a new branch. **Do not** work on `main`.

### Branch Naming Convention

| Type        | Pattern                     | Example                        |
| ----------- | --------------------------- | ------------------------------ |
| New feature | `feature/short-description` | `feature/user-login-page`      |
| Bug fix     | `bugfix/short-description`  | `bugfix/fix-header-alignment`  |
| Maintenance | `chore/short-description`   | `chore/update-dependencies`    |
| Urgent fix  | `hotfix/short-description`  | `hotfix/patch-auth-bypass`     |

### Post-Task

Once code changes are complete and tests pass, ask the user if they are ready for a Pull Request. If yes, push the branch and provide the link.

---

## Before Submitting Changes

1. **Git Workflow Policy** — follow the Feature Branch Workflow.
2. **Read `docs/ROADMAP.md`** — understand planned features and blocked tasks.
3. **Read `CONTRIBUTING.md`** — code style and commit conventions.
4. **Run `make test`** — all tests must pass.
5. **Run `make lint`** — no lint errors.
6. **Add/update tests** for any new endpoints.
7. **Update `apps/server/public/help.html`** after adding or changing user-facing features.
8. **Update `docs/PROGRESS.md`** — document the task, files touched, and a summary.

---

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
renderBookmarks();     // re-render
```

---

## Testing Patterns

- Tests live in `apps/server/__tests__/`.
- Use `supertest` + `request.agent(app)` for cookie/session persistence across requests.
- Create unique users per test (timestamp-based names) to avoid conflicts.
- Set `DB_PATH=anchormarks-test.db` and clean it up in `afterAll`.

---

## Common Pitfalls

- **Missing `user_id` filter** — always check the user owns the resource before responding (security issue).
- **Missing `validateCsrf`** — POST/PUT/DELETE without the middleware returns 403.
- **SQL injection** — always use parameterized queries (`db.prepare().run(...)`), never string concatenation.
- **Frontend state divergence** — after an API call, reload from server; never assume local state matches DB.
- **Hardcoded secrets** — use `process.env.*`; check for `JWT_SECRET` in production.
- **Breaking existing API endpoints** — check `docs/ROADMAP.md` before renaming routes.
