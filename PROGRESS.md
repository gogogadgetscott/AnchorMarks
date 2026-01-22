## feature/omnibar-view-badge-css

- Date: 2026-01-22
- Summary: Added `.command-category.view` CSS rule to style the omnibar "View" badge and fixed `closeOmnibar` to correctly update internal state in environments without an `#omnibar-panel` DOM element (prevents tests from depending on DOM presence).
- Files changed:
  - `apps/client/src/assets/styles.css` (added `.command-category.view` rule in two locations)
  - `apps/client/src/features/bookmarks/omnibar.ts` (closeOmnibar state-fix)
  - `apps/client/src/features/bookmarks/__tests__/omnibar-keyboard.test.ts` (added tests ensuring view vs non-view keyboard behavior)
- Status: committed to `feature/omnibar-view-badge-css` and pushed. CI passes locally (client tests).
