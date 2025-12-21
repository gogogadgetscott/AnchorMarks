# AnchorMarks Copilot Instructions

**Project**: Self-hosted bookmark manager with browser sync, REST API, Flow Launcher integration, and SQLite backend.

## Architecture Overview

### Technology Stack

- **Backend**: Node.js 18+ / Express.js on SQLite (better-sqlite3)
- **Frontend**: TypeScript + Vite (apps/client) producing a static `public/` bundle
- **Security**: bcryptjs (passwords), JWT (auth tokens), CSRF tokens (state mutations), SSRF guards
- **Extensions**: Chrome/Edge/Firefox browser extension, Flow Launcher plugin

### Core Components

1. **`apps/server/app.js`** (entry) – Express app handling:
   - Authentication endpoints (`/api/auth/*`)
   - Bookmark CRUD (`/api/bookmarks/*`)
   - Folder management (`/api/folders/*`)
   - Tags system (`/api/tags/*`)
   - Smart Collections (`/api/smart-collections/*`)
   - Health tools (duplicate detection, dead link checker)
   - Settings persistence (`/api/settings`)

2. **Frontend (apps/client)** – Vite + TypeScript app under `apps/client/src`:
   - **Build System**: Vite for fast HMR and optimized production builds
   - **Language**: TypeScript (strict mode) with type definitions in `apps/client/src/types.ts`
   - **Entry Points**: `apps/client/src/main.ts` (initializes components) → `apps/client/src/App.ts` (main app logic)
   - **Module System**: ES modules with path aliases (`@features/`, `@components/`, `@utils/`, `@services/`)
   - **State Management**: Module-level variables in `apps/client/src/features/state.ts` (no framework state management)
   - **UI Rendering**: DOM manipulation via `innerHTML` (grid/list/compact views), dashboard widgets, search, filtering, sorting
   - **API Communication**: `apps/client/src/services/api.ts` helper function (handles CSRF tokens, JWT via cookies, TypeScript generics)
   - **Build Output**: Static bundle in `apps/server/public/` (served by Express in production)

3. **`apps/server/helpers/smart-organization.js`** – Tag suggestion engine:
   - Domain-based categorization (GitHub → dev tags)
   - Tag co-occurrence analysis
   - Used in bookmark creation/import workflows

4. **Database Schema**:
   - `users` – id, username, email, password (hashed), api_key, settings
   - `bookmarks` – id, user_id, folder_id, url, tags, favicon, content_type, is_favorite, click_count
   - `folders` – id, user_id, parent_id, name, color, icon, position (tree structure)
   - `tags` – id, user_id, name, color, icon (separate from bookmark_tags junction)
   - `bookmark_tags` – junction table (many-to-many)
   - `smart_collections` – saved filters with JSON rules
   - `user_settings` – theme, view_mode, dashboard_config, widget_order (JSON stored)
   - Indexes on user_id, folder_id for query performance; WAL mode enabled

## Key Architectural Patterns

### Authentication Flow

1. User logs in/registers → `POST /api/auth/login` or `POST /api/auth/register`
2. Server sets **httpOnly cookie** with JWT (no localStorage)
3. Frontend receives **CSRF token** in response, stores in memory
4. All state-changing requests include `X-CSRF-Token` header
5. API key (for Flow Launcher, third-party tools) sent as query param or header, whitelisted to read-only endpoints

### Data Flow

- **GET requests** – Fetch from DB, serialize to JSON, serve to frontend
- **POST/PUT/DELETE** – Validate CSRF token, validate user ownership (check `user_id`), mutate DB, return updated record
- **Error handling** – Return HTTP status codes + JSON `{ error: "reason" }`; frontend catches 401 → logs out

### Frontend State Management

- No Redux/Vue/React; state lives in module-level variables inside `apps/client/src`
- Views: `'dashboard'` (widgets), `'bookmarks'` (folder/filtered list), `'settings'`, etc.
- Rendering: `renderBookmarks()`, `renderDashboard()`, `renderFolders()` (DOM manipulation via `innerHTML`)
- User action → API call → reload state → re-render
- **Sidebar**: folder tree (nested); click folder → `currentFolder = folderId` → re-render bookmarks

### Database Access Pattern

- All server-side queries in `apps/server/**/*.js` use `db.prepare().all()` or `db.prepare().run()` (synchronous)
- No ORM; raw SQL with parameterized queries (prevent SQL injection)
- User isolation: **every query filters by `user_id`** (critical for security)
- Transactions for multi-step operations (e.g., bulk tag rename)

## Critical Developer Workflows

### Running the Application

```bash
npm install                # Install deps at project root (or run in subfolders as needed)
npm run dev                # Start dev server(s) (see root and apps/client package scripts)
npm run prod               # Production build (requires JWT_SECRET, CORS_ORIGIN env vars)
```

**Development Options**:
- `npm run dev` - Backend only (serves built frontend from `apps/server/public/`)
- `npm run dev:vite` - Frontend only with Vite HMR (requires backend running on port 3000)
- `npm run dev:full` - Both backend and frontend with HMR (uses concurrently)
- `npm run build` - Build frontend for production (outputs to `apps/server/public/`)

If you need to run only the server or client, use the `package.json` in `apps/server/` or `apps/client/` respectively.

### Testing

```bash
npm test                   # Run Jest suite (server/__tests__)
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

**Test patterns**:

- Use `supertest` + `request.agent(app)` for cookie/session persistence
- Tests create unique users (timestamp-based) to avoid conflicts
- Use isolated test database (`DB_PATH=anchormarks-test.db`)
- Clean up test DB files in `afterAll` hook

### Syntax Validation & Linting

```bash
npm run lint               # Run ESLint to check code style
node --check apps/server/app.js
node --check apps/client/src/main.ts
```

### Docker

```bash
npm run docker:build       # Build image (uses tooling/docker config)
npm run docker:up          # Start containers (docker/docker-compose.yml)
```

## Project-Specific Conventions

### API Response Format

Always return JSON:

```javascript
// Success (GET):
{ success: true, data: {...} }
// OR single object:
{ id: "...", title: "...", ... }

// Creation (POST):
{ id: "...", title: "..." } // Bookmark/folder object

// Error:
{ error: "Invalid request" } // HTTP 400+ with error message
```

### Security Requirements

1. **No secrets in code** – Use environment variables (`.env` for dev; secrets management for prod)
2. **User isolation** – Every query must filter by `user_id` (enforce in middleware + individual handlers)
3. **SSRF guards** – Check `isPrivateAddress()` before fetching favicons/links (block private IPs, loopback)
4. **Input validation** – Sanitize URLs, folder names, tag names before DB insert
5. **Rate limiting** – Implement for auth endpoints in production (skeleton in server/middleware/rateLimiter.js)
6. **No API key logging** – Filter from logs; use `NODE_ENV=production` checks

### Common Code Patterns

**API Endpoint (server)**:

```javascript
app.post("/api/bookmarks", requireAuth, validateCsrf, (req, res) => {
  const { url, title, tags, folder_id } = req.body;
  const userId = req.user.id; // From JWT middleware

  // Validate ownership if updating existing
  if (req.body.id) {
    const existing = db
      .prepare("SELECT * FROM bookmarks WHERE id = ? AND user_id = ?")
      .get(req.body.id, userId);
    if (!existing) return res.status(403).json({ error: "Not found" });
  }

  // Insert/update
  const result = db
    .prepare(
      `INSERT INTO bookmarks (id, user_id, url, title, tags)
        VALUES (?, ?, ?, ?, ?)`,
    )
    .run(uuidv4(), userId, url, title, JSON.stringify(tags));

  return res.json({ id: result.lastInsertRowid, ...req.body });
});
```

**Frontend API Call (apps/client/src)**:

```typescript
import { api } from "@services/api.ts";
import type { Bookmark } from "@types.ts";

async function saveBookmark(bookmark: Bookmark): Promise<void> {
  try {
    // TypeScript generic provides type safety for response
    const result = await api<Bookmark>("/bookmarks", {
      method: "POST",
      body: JSON.stringify(bookmark),
    });
    // Reload bookmarks and re-render
    await loadBookmarks();
    renderBookmarks();
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}
```

**TypeScript Type Definitions** (`apps/client/src/types.ts`):
- `Bookmark`, `Folder`, `Tag`, `User`, `DashboardWidget`, `FilterConfig` interfaces
- All API responses should match these types for type safety

**URL/SSRF Validation**:

```javascript
// In server/app.js before fetching favicon:
const isSafe = !(await isPrivateAddress(req.body.url));
if (!isSafe && NODE_ENV === "production") {
  return res.status(403).json({ error: "Private networks not allowed" });
}
```

## File Organization

- `apps/server/app.js` – All API routes, middleware, DB logic (monolithic by design)
- `apps/server/controllers/` – Route handlers (`auth.js`, `bookmarks.js`, `folders.js`, `tags.js`)
- `apps/server/helpers/` – Helpers (favicon.js, import.js, metadata.js, smart-organization.js, etc.)
- `apps/server/models/` – Data access models and DB helpers
- `apps/server/routes/` – Express route wiring
- `apps/server/__tests__/` – Jest test files
- `apps/client/` – Frontend source (Vite + TypeScript), `public/` assets
- `apps/server/public/` – Generated favicons and thumbnails (`public/favicons/`, `public/thumbnails/`)

## Git Workflow Policy

You must act as a Senior Developer who strictly follows the Feature Branch Workflow.

**When the user asks for a code change (feature, bugfix, refactor):**

1. **NEVER** suggest code directly on the `main` or `master` branch.
2. **ALWAYS** suggest creating a new branch first using the following naming convention:
   - `feature/description` (for new features)
   - `bugfix/description` (for bugs)
   - `chore/description` (for maintenance)
3. **Example Response:** "I can help with that. First, let's create a branch: `git checkout -b feature/user-login`."

## Tone & Style

- Be concise.
- Assume the user wants to merge via Pull Request, not direct push to main.

## Before Making Changes

1. **Git Workflow Policy** - Follow the Feature Branch Workflow.
2. **Read ROADMAP.md** – Understand planned features and blocked tasks
3. **Read CONTRIBUTING.md** – Code style, commit conventions
4. **Run `npm test`** – Verify existing tests pass
5. **Plan changes** – List files to touch, functions to add/modify
6. **Update PROGRESS.md** – Document task, files, and summary after completion
7. **Test thoroughly** – Add tests for new endpoints; run `npm test` + `npm run dev` + manual UI testing
8. **Run `npm run lint`** – Validate code style before committing
9. **Update help documentation** – After adding new features or making changes, update [apps/client/public/help.html](apps/client/public/help.html) to reflect the changes

## Common Pitfalls

- **Missing user_id filter** – Always check user owns bookmark/folder before responding
- **Forgetting CSRF validation** – POST/PUT/DELETE without token → 403
- **Hardcoded secrets** – Use `process.env.*`; check for `JWT_SECRET` in production
- **Breaking existing API endpoints** – Check ROADMAP.md before renaming routes
- **Frontend state divergence** – After API call, reload from server; don't assume local state matches DB
- **SQL injection** – Always use parameterized queries (`db.prepare().run(...)`), never string concatenation
