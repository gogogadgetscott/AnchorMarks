# Progress Log

Track work completed and in progress for AnchorMarks.

## Done (Recent)

- 2026-03-07: Added theme switching commands to omnibar for quick theme changes via command palette.
- 2026-03-07: Implemented app-specific cookie prefixes to prevent authentication conflicts when multiple apps share the same domain.
- 2026-02-22: CSRF hardening for auth mutations, SSRF guards, and tag cleanup scoping.

## 2026-03-07

- Added theme switching to omnibar command palette:
  - Added 7 theme switching commands: System, Light, Dark, Ocean, Sunset, Midnight, and High Contrast.
  - Users can now quickly switch themes using `>` prefix (e.g., `> dark`, `> theme`, etc.).
  - Each theme command has descriptive icons and help text.
  - Updated help documentation to mention theme switching via omnibar.
- Implemented app-specific cookie naming to prevent authentication conflicts:
  - Added `COOKIE_PREFIX` configuration derived from `JWT_SECRET` (or optionally set via environment variable).
  - Updated all cookie operations (set/read/clear) in `authController.js` and `middleware/index.js` to use prefixed names.
  - Created public `/api/auth/config/public` endpoint to expose cookie prefix for frontend (future extensibility).
  - Updated test suite with prefixed cookie names and added `COOKIE_PREFIX` to test mocks.
  - All 320 server tests and 158 client tests passing.
- Updated documentation:
  - Added `COOKIE_PREFIX` configuration to `INSTALL.md` with notes about session invalidation.
  - Updated `SECURITY.md` to explain why app-specific cookies prevent cross-app authentication conflicts.
  - Updated `help.html` to note that cookie names include deployment-specific prefixes.

## 2026-02-22

- Added CSRF protection to auth mutation routes and updated related tests.
- Hardened SSRF protections for link checks, deadlink scans, and thumbnails.
- Scoped tag deletion cleanup to the tag owner.

## 2026-03-01

- Fixed dashboard rendering regression caused by recent layout refactor:
  - Updated `renderDashboard` and `renderDashboardWidget` to use new
    `.dashboard-freeform` structure and correct widget class names.
  - Ensured dashboard views button is initialized after header renders and
    during app startup; added tests for menu behaviour.
  - Added new unit tests for dashboard module and adjusted existing tests.
  - Updated App header logic to call `initDashboardViews` and added
    documentation comments explaining reasoning.
  - Updated styles integration and added new DOM structure for empty state.

- Implemented remaining dashboard helper functions as part of optimization
  task:
  - `initDashboardDragDrop` with basic widget dragging logic (snapping,
    state updates, and modification tracking).
  - `filterDashboardBookmarks` updates search filter and triggers
    bookmark reload; tests verify state and loader call.
  - `updateLayoutStats` computes simple widget count/area summary and writes
    to stats element.
  - Added stub for `initTagAnalyticsWidgets` for future work.
  - Extended dashboard unit tests to cover these helpers.
