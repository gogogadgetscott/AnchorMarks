# Progress Log

Track work completed and in progress for AnchorMarks.

## Done (Recent)

- 2026-02-22: CSRF hardening for auth mutations, SSRF guards, and tag cleanup scoping.

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
