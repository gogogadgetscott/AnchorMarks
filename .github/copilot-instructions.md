# AnchorMarks Copilot Instructions

**Project**: Self-hosted bookmark manager with browser sync, REST API, Flow Launcher integration, and SQLite backend.

## Architecture Overview

### Technology Stack
- **Backend**: Node.js 18+ / Express.js on SQLite (better-sqlite3)
- **Frontend**: Vanilla JS (no frameworks) with responsive HTML/CSS
- **Security**: bcryptjs (passwords), JWT (auth tokens), CSRF tokens (state mutations), SSRF guards
- **Extensions**: Chrome/Edge/Firefox browser extension, Flow Launcher plugin

### Core Components
1. **`server/index.js`** (2385 lines) – Single monolithic Express app handling:
   - Authentication endpoints (`/api/auth/*`)
   - Bookmark CRUD (`/api/bookmarks/*`)
   - Folder management (`/api/folders/*`)
   - Tags system (`/api/tags/*`)
   - Smart Collections (`/api/smart-collections/*`)
   - Health tools (duplicate detection, dead link checker)
   - Settings persistence (`/api/settings`)

2. **`public/js/app.js`** (3418 lines) – Frontend state machine:
   - UI rendering (grid/list/compact views)
   - Dashboard with freeform widgets
   - Search, filtering, sorting logic
   - Local state: `bookmarks[]`, `folders[]`, `currentUser`, `dashboardConfig`, `filterConfig`
   - API calls via `api()` helper (handles CSRF tokens, JWT via cookies)

3. **`server/smart-organization.js`** – Tag suggestion engine:
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
1. User logs in/registers → `POST /api/auth/login` or `/api/auth/register`
2. Server sets **httpOnly cookie** with JWT (no localStorage)
3. Frontend receives **CSRF token** in response, stores in memory
4. All state-changing requests include `X-CSRF-Token` header
5. API key (for Flow Launcher, third-party tools) sent as query param or header, whitelisted to read-only endpoints

### Data Flow
- **GET requests** – Fetch from DB, serialize to JSON, serve to frontend
- **POST/PUT/DELETE** – Validate CSRF token, validate user ownership (check `user_id`), mutate DB, return updated record
- **Error handling** – Return HTTP status codes + JSON `{ error: "reason" }`; frontend catches 401 → logs out

### Frontend State Management
- No Redux/Vue/React; state lives in module-level variables
- Views: `'dashboard'` (widgets), `'bookmarks'` (folder/filtered list), `'settings'`, etc.
- Rendering: `renderBookmarks()`, `renderDashboard()`, `renderFolders()` (DOM manipulation via `innerHTML`)
- User action → API call → reload state → re-render
- **Sidebar**: folder tree (nested); click folder → `currentFolder = folderId` → re-render bookmarks

### Database Access Pattern
- All queries in `server/index.js` use `db.prepare().all()` or `db.prepare().run()` (synchronous)
- No ORM; raw SQL with parameterized queries (prevent SQL injection)
- User isolation: **every query filters by `user_id`** (critical for security)
- Transactions for multi-step operations (e.g., bulk tag rename)

## Critical Developer Workflows

### Running the Application
```bash
npm install                # Install deps (Express, bcryptjs, better-sqlite3, JWT, etc.)
npm run dev                # Start server on http://localhost:3000 (NODE_ENV=development)
npm run prod               # Production mode (requires JWT_SECRET, CORS_ORIGIN env vars)
```

### Testing
```bash
npm test                   # Run Jest suite (api.test.js, security.test.js)
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

**Test patterns**:
- Use `supertest` + `request.agent(app)` for cookie/session persistence
- Tests create unique users (timestamp-based) to avoid conflicts
- Use isolated test database (`DB_PATH=anchormarks-test.db`)
- Clean up test DB files in `afterAll` hook

### Syntax Validation
```bash
node --check server/index.js
node --check public/js/app.js
```

### Docker
```bash
npm run docker:build       # Build image
npm run docker:compose     # Start containers (docker-compose.yml)
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
5. **Rate limiting** – Implement for auth endpoints in production (skeleton in security.test.js)
6. **No API key logging** – Filter from logs; use `NODE_ENV=production` checks

### Common Code Patterns

**API Endpoint (server)**:
```javascript
app.post('/api/bookmarks', requireAuth, validateCsrf, (req, res) => {
    const { url, title, tags, folder_id } = req.body;
    const userId = req.user.id;  // From JWT middleware
    
    // Validate ownership if updating existing
    if (req.body.id) {
        const existing = db.prepare('SELECT * FROM bookmarks WHERE id = ? AND user_id = ?')
            .get(req.body.id, userId);
        if (!existing) return res.status(403).json({ error: 'Not found' });
    }
    
    // Insert/update
    const result = db.prepare(`INSERT INTO bookmarks (id, user_id, url, title, tags)
        VALUES (?, ?, ?, ?, ?)`)
        .run(uuidv4(), userId, url, title, JSON.stringify(tags));
    
    return res.json({ id: result.lastInsertRowid, ...req.body });
});
```

**Frontend API Call (public/js/app.js)**:
```javascript
async function saveBookmark(bookmark) {
    try {
        const result = await api('/bookmarks', {
            method: 'POST',
            body: JSON.stringify(bookmark)
        });
        // Reload bookmarks and re-render
        await loadBookmarks();
        renderBookmarks();
    } catch (err) {
        alert('Failed: ' + err.message);
    }
}
```

**URL/SSRF Validation**:
```javascript
// In server/index.js before fetching favicon:
const isSafe = !(await isPrivateAddress(req.body.url));
if (!isSafe && NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Private networks not allowed' });
}
```

## File Organization
- `server/index.js` – All API routes, middleware, DB logic (monolithic by design)
- `server/smart-organization.js` – Pluggable tag suggestion module
- `server/__tests__/` – Jest test files
- `public/js/app.js` – All frontend logic, rendering, state
- `public/css/styles.css` – UI styles
- `public/index.html` – Single HTML entry point (SPA-style)

## Before Making Changes
1. **Read ROADMAP.md** – Understand planned features and blocked tasks
2. **Read CONTRIBUTING.md** – Code style, commit conventions
3. **Run `npm test`** – Verify existing tests pass
4. **Plan changes** – List files to touch, functions to add/modify
5. **Update PROGRESS.md** – Document task, files, and summary after completion
6. **Test thoroughly** – Add tests for new endpoints; run `npm test` + `npm run dev` + manual UI testing

## Common Pitfalls
- **Missing user_id filter** – Always check user owns bookmark/folder before responding
- **Forgetting CSRF validation** – POST/PUT/DELETE without token → 403
- **Hardcoded secrets** – Use `process.env.*`; check for `JWT_SECRET` in production
- **Breaking existing API endpoints** – Check ROADMAP.md before renaming routes
- **Frontend state divergence** – After API call, reload from server; don't assume local state matches DB
- **SQL injection** – Always use parameterized queries (`db.prepare().run(...)`), never string concatenation
