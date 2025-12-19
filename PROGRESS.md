# AnchorMarks Development Progress

## Help.html Improvements - Completed

**Task**: Improve help.html for better scannability, visual hierarchy, and role-based onboarding.

**Files Modified**:

- `apps/client/public/help.html` - Added user journey cards, "At a glance" callouts with icons, FAQ section, "For developers" block, improved visual hierarchy with callout icons.

**Summary**:

- Added three user journey cards (New User, Power User, Self-host/Admin) with checklists linking to relevant sections.
- Added "At a glance" callouts to Search & Filter and Tag Analytics sections.
- Standardized callout visual hierarchy by adding icons (👁️ for At a glance, 💡 for tips, 🚀 for pro tips) to all tip-box and help-at-a-glance elements.
- Added FAQ section with collapsible details for common questions.
- Added "For developers" section highlighting the tech stack and architecture.
- All changes maintain existing functionality and pass linting/tests.

**Validation**:

- ESLint: Passed (warnings only, no errors)
- Jest tests: 85/85 passed
- Vitest client tests: 28/28 passed with coverage
- Help page renders correctly with new sections and styling.
