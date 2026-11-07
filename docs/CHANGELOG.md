# Changelog

All notable changes to AnchorMarks are documented here.

---

## [Unreleased]

### Fixed

- **Plain-HTTP deployments no longer forced to HTTPS** — the CSP header no longer includes `upgrade-insecure-requests` when `SSL_ENABLED` is false, so browsers stop rewriting every `http://` subresource request to `https://` (breaking API calls and assets on non-TLS installs)
- **Add-bookmark page now saves top-level bookmarks** — bookmark create/update validation and the update model now accept `folder_id: null`, so the `/addbookmark` flow can save bookmarks with no folder selected instead of returning "Expected string, received null"
- **Add-bookmark folder dropdown is populated again** — the page read `GET /api/folders` as a bare array, but that endpoint returns `{ folders: [...] }`; the resulting error left the folder `<select>` empty. The response is now unwrapped, and a failing shared option builder correctly falls back to the local builder instead of clearing the dropdown
- **Search box now actually filters the bookmark grid** — typing in the omnibar only updated the filter state without reloading bookmarks, so the server-side FTS search never ran and the grid did not update. Typing now triggers a debounced reload with the search term, and clearing the search restores the full list
- **Tag filtering no longer creates case-duplicate tags** — tag lookups and creation were case-sensitive while filtering was case-insensitive, so tagging "React" on one bookmark and "react" on another produced two separate sidebar tags with split counts. Tag resolution, create/rename conflict checks, and the rename/merge path are now case-insensitive, and a migration merges any existing case-duplicate tags
- **Tag counts now match what filtering shows** — the `/api/tags` counts previously included archived bookmarks while the filtered views exclude them, so a tag badge could show a higher number than the results returned. Tag counts now exclude archived bookmarks
- **Startup backfill keeps the full-text index in sync** — the standalone FTS5 index is now backfilled on startup with any bookmarks missing from it, so search stops silently missing bookmarks after an upgrade or FTS table recreation
- **Sidebar tag filtering is consistent with the rest of the UI** — clicking tags in the sidebar forced `AND` matching while the filter dropdown and card clicks default to `OR`; sidebar tag clicks now preserve the user's selected tag mode
- **Search now works in the favorites, archived, most-used, and recent views** — the server ignored the `search` parameter in those views, so the UI could only filter the already-loaded page and search appeared to "miss" matches. Search is now applied in every list view, and the omnibar searches favorites/recent too instead of silently doing nothing
- **Per-user rate limiting instead of per-IP** — every client behind a shared IP (Docker NAT, reverse proxy, CGNAT) drew from one shared 60 req/min bucket, so a single heavy tab (or several users) exhausted the limit for everyone — the "unreliable search hitting rate limits" symptom. The limiter now keys authenticated traffic on the session's user id (API keys on a keyed hash of the key) and falls back to the client IP only for anonymous traffic
- **Rate-limit responses are consistent and honored by the client** — the limiter and the auth middleware now both answer `429 {"error":"Rate limit exceeded"}` with a `Retry-After` header; the client raises a typed `ApiError` that parses `Retry-After`, shows a visible toast ("Rate limited — try again shortly"), and backs off for the indicated period instead of blind-firing retries
- **Duplicate bookmark-list requests removed** — the App-level view effect reloaded on every filter-config change (each keystroke's state update), and the legacy `#filter-search-input` had no debounce; the view effect now depends only on the view/auth state and the filter input is debounced by 300 ms
- **Folder cycles are rejected** — moving or creating a folder with a parent that is itself, belongs to another user, or would create a loop now returns 422 (`updateFolder`/`createFolder` and the sync push path all validate). The `include_children` recursive query is additionally scoped to the requesting user and depth-capped, so even a database that already contains a cycle (legacy data) can no longer hang the synchronous SQLite call and freeze the whole event loop
- **Import no longer drops folders whose children are listed first** — the folder pass counted re-queued folders (waiting on parents) as attempts, so an export listing deep subfolders before their parents exhausted the 1000-attempt budget after a handful of inserts and silently lost the rest; progress is now counted per pass instead
- **Metadata queue can no longer stall permanently** — a failure outside the per-item guards (e.g. `db.prepare` throwing while the database closes) used to leave `isProcessing` stuck at `true` until restart; the batch loop is now wrapped in `try/catch/finally`, the queue is capped at 5,000 entries, and duplicate detection is an O(1) `Set`
- **Mid-body network drops no longer crash the server** — metadata and favicon fetch responses now attach an `error` handler, and the WebSocket upgrade listener rejects malformed requests (`400`) instead of letting a `TypeError`/`URIError` escape and kill the process
- **`smart-org` cluster ordering fixed** — cluster sorting read `bookmarkCount` while the clusters were built with `bookmark_count`, producing a `NaN` comparator; clusters now sort by actual bookmark count
- **AI tag suggestions no longer hang indefinitely** — OpenAI requests time out after 30 s and Ollama after 120 s

### Security

- **`javascript:` and `data:` URLs rejected on bookmark update** — the update schema accepted any string as a URL while create required http/https/`bookmark-view`, so an XSS payload could be injected through an update of an existing bookmark; update now applies the same rule as create
- **SSRF guard covers IPv6 forms that embed IPv4** — WHATWG URL parsing rewrites `http://[::ffff:127.0.0.1]/` to `[::ffff:7f00:1]`, which the previous dotted-only check let through to loopback; the IP guard now expands IPv6 (mapped, translated, and compatible forms) and applies the IPv4 rules, plus blocks `0.0.0.0/8` and the exact CGNAT range `100.64.0.0/10`. Favicon fetching also pins the verified IP via a custom DNS lookup, closing the DNS-rebinding window
- Rate-limit bookkeeping and the auth attempt counter no longer grow without bound in long-running dev/staging deployments (periodic cleanup runs everywhere except tests; the timer is `unref()`ed)

### Changed

- `make test-docker`, `make test-docker-backend`, `make test-docker-frontend`, `make test-backend-local`, `make test-frontend-local`, and `make test-coverage` now abort on a failing test instead of unconditionally printing "✓ … completed" (the `.ONESHELL` recipes lacked `set -e`, so the Docker targets reported success even when the suite failed)
- Fixed the test Docker image build: it copied the workspace root `package.json` together with the nested `apps/server` lockfile and no root lockfile, which crashed npm's resolver; the image now installs the workspace tree from the root lockfile. The workspace root lives at `/anchormarks` (not the filesystem root `/`, where npm silently skips workspace dependencies — only root devDependencies were installed and `vitest` went missing), the `Makefile`/`docker-compose.yml` container paths were updated to match, and a root `.dockerignore` keeps host-built `node_modules` (e.g. a glibc `better-sqlite3`) from shadowing the container's own native modules. The image's default `CMD` also actually runs both suites now instead of `npm test` at a package with no scripts
- **The production Docker image can be built again** — it had been failing at several separate steps, which is why deployments silently stayed on an old image: (1) the frontend stage's `npm install` hit an npm 10 arborist crash (`Cannot read properties of null (reading 'edgesOut')`) resolving the client dependency set, now installed with `--legacy-peer-deps`; (2) the root lockfile was stale (`apps/server` locked `puppeteer ^24` while the manifest asked for `^25.7.0`), so `npm ci` refused to run — the lockfile is regenerated; (3) the `npm audit --audit-level=high` gate then failed on transitive advisories in `undici`, `qs`, `proxy-addr`, `compression`, `fast-uri`, `js-yaml`, `body-parser`, and `brace-expansion` — all updated (`brace-expansion` via an explicit override) and `npm audit --omit=dev` now reports 0 vulnerabilities; (4) installing at the filesystem root made npm silently skip workspace dependencies, so the server started without `dotenv`/`express` — the production app now lives at `/anchormarks` and installs from the workspace root (`/apps/database`, `/apps/ssl`, and `/apps/.env` are unchanged). `make start-docker`, `make build-docker`, `make rebuild-docker`, and `make build-frontend` now stop on a failed step instead of printing "✓ … completed" after a failed build, which is what hid these failures
- `build-frontend`/`make help` and the user's custom `check`/`validate` targets are unchanged

### Performance

- **Bookmark list queries are dramatically faster on large libraries** — the tags aggregation previously computed `GROUP_CONCAT`/`json_group_array` for every bookmark the user owned on every page load. It is now scoped to only the returned page via a CTE, and the `COUNT` query no longer materializes tags at all. With a 5,000-bookmark library the plain list query dropped from ~24 ms to ~0.7 ms, tag-filtered lists from ~26 ms to ~4 ms, and FTS search from ~31 ms to ~7 ms
- **View tag counts are ~12× faster** — `listViewTags` (the filtered tag sidebar returned with every list load) was rewritten to count bookmarks per tag first and then join back to tags instead of aggregating the full tag × bookmark cross product (~39 ms → ~3 ms at 5,000 bookmarks)
- **`/api/tags` counts are ~2× faster** — `listTags` uses the same grouped-count pattern as the view tag list
- **Sidebar nav badges no longer refetch counts on every bookmarks change** — the `/bookmarks/counts` request is now debounced (400 ms) and skipped when the counts are unchanged, so pagination and reloads no longer hammer the endpoint while scrolling
- **Duplicate `loadBookmarks` requests are deduplicated** — a view change triggered by both the sidebar handler and the App-level `currentView` effect (plus every filterConfig change that recreated the loader callback) resulted in two identical network requests; an in-flight cache-key guard now collapses them into one
- **Search now matches folder names** — the full-text index previously indexed only title, URL, description, and tags, so searching a folder name found nothing. The FTS index now includes a `folder` column (kept in sync on bookmark create/update/tag changes and folder rename), `/api/quick-search` also matches folder names, and the client-side fallback/omnibar search now matches description text too. Added search-coverage regression tests

---

## [1.0.11] - 2026-05-25

### Added

- **Open Graph image auto-fetch** — rich bookmark cards automatically fetch and persist `og_image` when none is stored; image fades in with a smooth load transition and the result is saved back to the bookmark so subsequent renders use the cached value
- **Sidebar flyout menus** — folders and tags sections now show a flyout panel when the sidebar is collapsed, keeping navigation accessible without expanding the sidebar
- **Folder bookmark counts** — the folders API now returns a `bookmark_count` field for each folder, enabling count display without extra queries
- Added integration coverage for settings APIs, including default settings retrieval, update flows, flexible `settings_json` merge behavior, and bookmark reset behavior

### Fixed

- **Backoff on rate-limited pagination** — `loadMore` now backs off for 60 seconds after receiving a rate-limit error, preventing repeated failed requests when scrolling
- **Pagination respects active filters** — "load more" requests now forward the current folder, tag, sort, and search filters so paginated results match the visible bookmark list
- **AI service unavailability handled gracefully** — `suggestTagsAI` now catches service errors and returns an empty suggestion list instead of propagating the exception
- **Widget "Show in Bookmarks" filter** — fixed `showWidgetInBookmarksView` to read the current filter configuration via the bookmarks bridge rather than an outdated local copy
- **Dashboard/commands view switching** — folder and tag widgets now switch to `all` view (showing all bookmarks) before applying the widget filter, preventing empty results when the user is on an unrelated view
- Fixed `user_settings` insert coercion so boolean-style settings values are stored safely as SQLite-compatible integers
- Fixed `user_settings` insert path to persist `current_view` and `snap_to_grid` on first-time settings creation
- Improved wording and formatting in in-app help documentation

### Security

- Updated `qs` dependency to address a reported security advisory

### Changed

- Sidebar collapsed state is now tracked reactively via a `MutationObserver` on `document.body`, keeping the React tree in sync with external toggle actions
- Sidebar icons now have consistent padding and smooth transition effects for improved hover UX
- Bookmarks context enhanced with view cache management to reduce redundant re-renders
- Removed unused `onEdit` props from `DashboardGrid` and `DashboardWidget` components
- Improved type safety and error handling across server controllers and services
- Docker Compose configuration refactored; added tests for `GeneralSettings` and the `useSettings` hook

---

## [1.0.10] - 2026-05-16

### Fixed

- **Favicon refresh is now non-blocking** — the `/maintenance/refresh-favicons` endpoint responds immediately and runs favicon fetching in the background, preventing request timeouts on large bookmark collections
- **Folder filter applies across all views** — folder filtering now consistently uses `currentFolder` regardless of active view, so bookmarks are correctly scoped when navigating outside the dedicated "folder" view
- **Child bookmark inclusion no longer restricted to folder view** — `include_children` is now sent whenever the option is enabled, not only when the current view is "folder"

---

## [1.0.9] - 2026-05-16

### Security

- Escaped folder and collection color values in filter dropdown HTML to prevent XSS via crafted color strings
- Added `escapeHtml` utility to `htmlUtils.js` and applied it to bookmark URLs, titles, tags, and colors in Netscape HTML export output
- Replaced `z.any()` with a typed `importedFolder` schema in sync-push and JSON import endpoints, enforcing field-level validation on folder data
- Added `hexColor` validator to constrain folder `color` fields to valid hex codes (`#RGB` / `#RGBA` / `#RRGGBB` / `#RRGGBBAA`) on create and update routes

### Changed

- **AI tag suggestion status in Bookmark modal** — the "Fetch Info" button now shows `Fetch Info · AI…` while AI tags are loading and `Fetch Info · AI` once results arrive, giving live feedback without blocking the form
- Added `onAIStatusChange` callback prop to `SmartTagSuggestions` so parent components can observe AI loading and result state
- Capped AI tag prompt inputs: URL truncated to 500 characters, title to 200 characters, and preferred tags list to 30 entries; added `max_tokens: 256` ceiling on OpenAI calls to bound response cost
- Fixed TypeScript path aliases in `tsconfig.json` to use relative `./src/*` prefixes; removed redundant `baseUrl: "."` that caused resolution inconsistencies
- Added `network_mode: host` to Docker Compose service configuration

---

## [1.0.8] - 2026-03-07

### Added

- **Dashboard drag-and-drop with @dnd-kit** — Dashboard widgets now use `@dnd-kit/core` for smooth, React-native drag-and-drop functionality with visual feedback and position snapping
- **Theme switching via omnibar** — quick commands using `>` now support all 7 themes: System, Light, Dark, Ocean, Sunset, Midnight, and High Contrast
- **App-specific cookie prefixes** — `COOKIE_PREFIX` support added to prevent auth cookie collisions when multiple apps share a domain
- Public auth config endpoint at `/api/auth/config/public` to expose deployment-specific client auth settings
- Dashboard helper coverage expanded with implementations for drag/drop initialization, bookmark filtering, and layout stats updates

### Fixed

- Dashboard rendering regression from the layout refactor by aligning widget rendering with `.dashboard-freeform` structure and updated class names
- Dashboard view menu/button initialization timing so controls reliably register after header render and on startup
- Tag deletion cleanup now scoped to the tag owner

### Security

- CSRF protection applied to auth mutation routes with corresponding test updates
- SSRF protections hardened for link checks, dead-link scans, and thumbnail-related URL handling
- Cookie read/write/clear paths updated to consistently use prefixed auth cookie names

### Changed

- React Dashboard components now handle widget dragging natively without relying on legacy DOM manipulation
- Dashboard widget drag handles show grab cursor in edit mode for better UX
- Dashboard widget resizing now flows through React callbacks with persisted dimensions and snap-to-grid behavior
- Removed unused legacy dashboard drag/resize state fields from `state.ts` and `DashboardContext` after React interaction migration
- Removed the temporary `features/bookmarks/tag-cloud.ts` compatibility bridge; tag cloud now routes through React AppShell view rendering
- **TypeScript compilation cleanup** — Fixed 40+ critical compile blockers: removed legacy `updateHeaderContent` calls from imperative views (replaced with React Context-based header updates), added missing bulk action function exports to bookmarks.ts, corrected bookmark property references (`click_count` vs `visit_count`), fixed dom property access for React-owned empty states
- Removed legacy imperative header update code from keyboard shortcuts and command handlers
- Bookmarks module now properly exports bulk action stubs (`bulkArchive`, `bulkDelete`, etc.) for type compatibility with Header component
- Finalized client TypeScript strictness pass by fixing nullable dataset IDs in folder/filter/dashboard handlers, narrowing API refresh/error payload types, and removing unused test imports
- Updated API settings behavior to read regenerated API key from shared state after regeneration
- Stabilized Omnibar test typing by aligning mocked command factory signature with `Command[]` expectations
- Documentation updates for cookie prefix behavior across install, security, and in-app help docs
- Dashboard unit/integration tests expanded to cover new helper behavior and menu wiring

---

## [1.0.7] - 2026-03-02

### Added

- **AI tag suggestions** — Claude-powered endpoint analyses bookmark content and proposes relevant tags; configurable via `ANTHROPIC_API_KEY` in `.env`
- **Fuzzy search** — server-side fuzzy matching for bookmarks using a custom Levenshtein-distance implementation, improving results for typos and partial queries
- **Dashboard widget actions** — per-widget options menu with Sort A-Z / Z-A, Add Bookmark, Open All, and Show in Bookmarks actions
- **Dashboard widget color theming** — widgets now display a subtle background tint derived from their assigned color
- **Help page dedicated stylesheet** — `help.css` extracted with responsive layout and full theme support (light, dark, high-contrast)

### Changed

- API routes refactored to use Express Router modules; folders and tags controllers merged into their respective route files, eliminating ~2 600 lines of duplication
- Bookmark modal layout updated for improved field arrangement
- Docker Compose template updated to document `JWT_REFRESH_SECRET` environment variable
- Docker entrypoint simplified by removing redundant user-switching logic

---

## [1.0.6] - 2026-03-02

### Added

- **Favicon display in bookmarks list** — favicons are fetched and shown inline; a per-bookmark refresh button lets users update stale icons
- **Most-used view** — dedicated sidebar view showing bookmarks ranked by click count
- **Tag picker dialog** — inline dialog for quickly applying tags without opening the full bookmark modal
- **Registration form improvements** — password visibility toggle and real-time password-strength indicator
- **Enhanced modal behaviour** — modals track dirty state, prompt before discarding unsaved changes, and persist user preferences across sessions

### Fixed

- Most-used badge count now always reflects the true server total (bookmarks with at least one click) instead of switching to the rendered page count when on the most-used view, which was capped at the 50-item page size
- Modal height set to `auto` for better responsiveness on smaller screens
- DOM reference handling in render functions to prevent stale-element errors
- `userId` validation added to metadata fetch and route handlers to prevent unauthorised access

### Security

- Persist auth rate-limit counters in SQLite so limits survive server restarts
- Run `npm audit` during Docker production builds to catch vulnerable dependencies
- Gate Swagger API docs behind authentication in production (`fix(sec-003)`)
- Eliminate SSRF DNS-rebinding TOCTOU window in metadata fetch (`fix(sec-004)`)
- Narrow API key scope and add a dedicated write rate-limit tier (`fix(sec-005)`)
- Sign refresh tokens with a separate `JWT_REFRESH_SECRET` (`fix(sec-006)`)
- Run server process as an unprivileged `node` user in Docker (`fix(sec-007)`)

### Changed

- Bookmarks list layout and styling overhauled for improved readability
- Login form UI refreshed; `updateCounts` logic streamlined
- Favicon settings UI text updated for clarity
- Moved project documentation to `docs/` directory

---

## [1.0.5] - 2026-02-23

### Fixed

- Mobile responsiveness and layout issues across views
- Dashboard view menu display on mobile screens

---

## [1.0.4] - 2026-02-22

### Added

- **FTS5 full-text search** — SQLite FTS5 index for significantly faster bookmark search
- **WebSocket real-time updates** — live sync of bookmarks, folders, and tags across tabs
- **Advanced analytics dashboard** — usage metrics, click tracking, and bookmark insights
- **OpenAPI/Swagger documentation** — interactive API docs at `/api/docs`
- **PWA support** — web app manifest, icons, and offline fallback page
- **Image optimization** — WebP thumbnail generation, cache headers, and progressive loading
- **Rate limiting** — configurable rate limiting with Docker environment support

### Fixed

- Security audit vulnerabilities: XSS, SSRF, CSRF token handling, and JWT edge cases
- CSRF protection extended to authentication routes
- FTS5 migration: auto-recreate virtual table if `id` column is missing
- Filter chips: server-side search, single search chip, and case-insensitive tag matching
- Production favicon handling and security header hardening

### Security

- CSRF token validation middleware applied across all state-changing routes
- Enhanced JWT handling with security audit logging
- CORS origin validation tightened for production environments
- Eliminated all `any` TypeScript annotations to improve type-safety surface

---

## [1.0.3] - 2026-01-31

### Added

- **Accessibility** — comprehensive ARIA attributes and focus management throughout the UI
- **Event listener cleanup** — system to prevent memory leaks on view transitions
- **HTML sanitization** — utility functions with security audit coverage
- **Logger integration** — structured logging with API timeout and request cleanup
- **App version display** — version fetched from API and shown in the UI
- TypeScript return type annotations added across all exported functions

### Fixed

- Omnibar filter application now correctly updates the filter menu and switches to bookmarks view
- Bookmark action handling updated to refresh dashboard widgets after changes
- Tag filtering normalization made more robust to handle edge cases
- View state management and filter clearing logic streamlined
- Duplicate keyboard event listener registrations removed

### Performance

- Keyboard event handling consolidated to reduce overhead
- Async sidebar tag filtering to avoid blocking the main thread

---

## [1.0.2] - 2026-01-25

### Added

- **Bookmarklet** — one-click bookmarking shortcut with prefilled fields for mobile and desktop
- **Omnibar filter integration** — filters applied via omnibar now update the filter menu and switch views
- **Tag filtering AND/OR semantics** — toggle between requiring all or any selected tags
- **Nested folder dropdown** — addbookmark extension popup now shows alphabetically-sorted, indented folder hierarchy
- **Playwright E2E tests** — tag cloud and filter bar test coverage; E2E targets added to Makefile
- **API health endpoint** — now includes `database_location` and app `version` fields
- All npm scripts consolidated into Makefile

### Fixed

- Omnibar panel no longer overlaps the filter button (centered positioning with max-width)
- Duplicate filter button removed from individual views (header canonical button used)
- Duplicate search event listeners prevented
- Database path doubled in Docker due to relative path handling
- Absolute database path used in production configuration
- HTTPS forced-redirect and HSTS behaviour corrected

---

## [1.0.1] - 2026-01-09

### Added

- **Omnibar command palette** — unified search and command palette with category badges, recent searches, tag suggestions, and Escape-to-close
- **Bookmark archiving** — archive view, bulk archive/restore actions, and database migration
- **Rich link previews** — Open Graph card component with `og_image` support, toggle in user settings
- **Tag Cloud view** — interactive canvas-based tag visualization with controls and sorting
- **Hierarchical folders** — `parent_id` tree structure with nested display in sidebar and modals
- **Dashboard widget enhancements** — options menu, widget sorting, and lazy-loaded bookmark lists
- **Skeleton loading states** — entrance animations for bookmarks and dashboard widgets
- **User profile menu** — profile dropdown in header with settings and bulk selection UI
- **Bulk actions** — select multiple bookmarks for delete, archive, tag, and move operations
- **Favorites toggle** — per-bookmark star button with favorites view in sidebar
- **Recent view** — dedicated view showing recently added bookmarks, bypassing active filters
- **Client-side pagination** — virtualized bookmark list with debounced scroll and IntersectionObserver
- **Thumbnail generation** — Puppeteer-based screenshot capture with background metadata queue
- **High contrast theme** — added as a selectable theme option alongside light and dark
- **Multiple color themes** — theme selector with corresponding CSS variables
- **Import/Export** — Netscape HTML and JSON bookmark import with folder hierarchy, duplicate detection, and auto-tagging; export of bookmark views
- **API key support** — read-only API key authentication for browser extension and Flow Launcher sync endpoints
- **CSRF token rotation** — token rotated on each state-changing request for improved security
- **Flexible user settings** — preferences stored in a JSON blob to avoid schema migrations
- **Prompt dialog component** — custom prompt for inline folder creation within the bookmark modal
- **Password manager compatibility** — authentication and profile forms dynamically injected to avoid autofill conflicts
- **Server-side account deletion** — users can delete their own account from settings
- **SSL support** — self-signed certificate generation and HTTPS redirect for development
- **Multi-stage Docker build** — client assets built in a separate stage; Docker environment variable support via build-time ARGs
- **Automated screenshot pipeline** — Playwright-based UI screenshot capture for documentation

### Fixed

- Bookmark import HTML parser made robust with case-insensitive regex, sibling `<DL>` handling, and cheerio fallback
- Import/export routes not registered in API configuration
- Maintenance module not initialized (broken link checker and favicon refresh buttons)
- Internal view URLs excluded from dead link checks
- Sidebar collapsed state correctly synced with server settings
- Dashboard view shortcuts and sidebar active state after navigation
- Rate limiter memory leak fixed with periodic cleanup
- CSP directives consolidated and corrected
- Cross-browser text truncation using `line-clamp`

### Changed

- Frontend migrated from JavaScript to **TypeScript** with strict mode
- Frontend restructured as a Vite client application (`apps/client`) with path aliases
- App.ts split into modular UI components (Header, Sidebar, Bookmarks, Dashboard, etc.)
- Server-side tests migrated from Jest to **Vitest**
- Quick Launch feature removed and replaced by Omnibar
- Infinite scroll replaced with client-side pagination

---

## [1.0.0] - 2025-12-12

### Added

- Initial release of AnchorMarks
- Express.js backend with SQLite (better-sqlite3) in WAL mode
- JWT authentication with httpOnly cookies and CSRF protection
- Bookmark CRUD with tags, folders, favorites, and click tracking
- Normalized tag system with `bookmark_tags` junction table
- Smart Collections — saved filters with JSON rules
- Smart Organization API — domain-based tag suggestions and tag co-occurrence analysis
- Dashboard with configurable widgets
- Folder management with color and icon support
- User profile management and tag editing
- Multiple color themes with theme selector
- Server status banner on auth screen
- Docker Compose setup with environment variable support
- CI configuration with GitHub Actions
- ESLint configuration for code quality enforcement
- Comprehensive unit and integration tests for auth, config, smart-organization, and utilities
