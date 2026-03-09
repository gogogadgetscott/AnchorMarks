# Changelog

All notable changes to AnchorMarks are documented here.

---

## [Unreleased]

### Added

- **Dashboard drag-and-drop with @dnd-kit** — Dashboard widgets now use `@dnd-kit/core` for smooth, React-native drag-and-drop functionality with visual feedback and position snapping

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

---

## [1.0.8] - 2026-03-07

### Added

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
