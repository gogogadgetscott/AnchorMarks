# Progress Log

Track work completed and in progress for AnchorMarks.

## Done (Recent)
- 2026-02-22: CSRF hardening for auth mutations, SSRF guards, and tag cleanup scoping.

## 2026-02-22
- Added CSRF protection to auth mutation routes and updated related tests.
- Hardened SSRF protections for link checks, deadlink scans, and thumbnails.
- Scoped tag deletion cleanup to the tag owner.
