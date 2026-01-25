# 🔗 AnchorMarks

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](INSTALL.md#system-requirements)
[![Docker Compose](https://img.shields.io/badge/docker-compose-blue.svg)](tooling/docker/docker-compose.yml)
[![Tests: Vitest](https://img.shields.io/badge/tests-Vitest-%2344a833.svg)](apps/server/vitest.config.ts)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![CI](https://github.com/gogogadgetscott/AnchorMarks/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gogogadgetscott/AnchorMarks/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/gogogadgetscott/AnchorMarks/branch/main/graph/badge.svg)](https://codecov.io/gh/gogogadgetscott/AnchorMarks)

A modern, self-hosted bookmark manager with browser sync, Flow Launcher integration, REST API, and SQLite backend.

<p>
	<img src="apps/client/public/images/anchormarks_demo.gif" alt="Quick demo" width="720">
</p>

If the animation doesn’t load, see the [Live Tour](#live-tour) below.

See a quick visual tour below, or jump to Quick Start.

## ❓ Why AnchorMarks

Most bookmark managers focus on either personal archiving or team knowledge bases. AnchorMarks optimizes everyday personal workflows:

- **Fast daily use**: Instant search, keyboard-first filtering, and a clean UI you can live in.
- **Self-hosted and simple**: SQLite backend, single Express app, optional Docker — no heavy infra.
- **Works with your tools**: Browser extensions for sync and a Flow Launcher plugin for quick lookup.

Compared to Linkwarden/Linkding/Shaarli, AnchorMarks emphasizes minimal setup, responsive UI, and smooth browser + launcher integration over heavy archiving pipelines.

## ✨ Features at a Glance

| Capability            | Details                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| 🔄 Browser Sync       | Chrome / Edge / Firefox extension included                                  |
| 🚀 Flow Launcher      | Plugin integration for quick search                                         |
| 🔌 REST API           | Read/write endpoints with JWT + CSRF                                        |
| 🗃️ SQLite DB          | better-sqlite3 with WAL                                                     |
| 🐳 Docker             | Compose setup, helper scripts provided                                      |
| 🔒 SSL                | Reverse proxy ready (sample nginx.conf)                                     |
| 📥 Import/Export      | Netscape HTML + JSON                                                        |
| 🏷️ Tags & Folders     | Nested folders, tag analytics & suggestions                                 |
| 🖼️ Favicons           | Automatic fetching and local caching                                        |
| 🌙 Dark Mode          | Beautiful light and dark themes                                             |
| 📱 Responsive         | Works on desktop, tablet, and mobile                                        |
| ⭐ Favorites          | Quick access to important bookmarks                                         |
| 🎯 Advanced Filtering | Full-width filter bar with folder/tag counts, persistent search filters, & tag mode toggle (see [Help](help.html#search)) |
| 💬 Smart Omnibar      | Unified search + command palette with recent searches, tag suggestions, & filter application |

## 🎥 Live Tour

- Dashboard: configurable widgets and quick-access favorites.
  <img src="apps/client/public/images/anchormarks_dashboard_1765737807089.png" width="720" alt="Dashboard">

- Search: fast, ranked results with filter bar.
  <img src="apps/client/public/images/anchormarks_search_1765737823968.png" width="720" alt="Search">

- Mobile: responsive layout with the same features on-the-go.
  <img src="apps/client/public/images/anchormarks_mobile_1765737840238.png" width="360" alt="Mobile">

### Typical Workflow

1. Sign up and create your account.
2. Import bookmarks (HTML/JSON) and auto-fetch favicons.
3. Organize with folders and tags; use suggestions to speed up categorization.
4. Search and filter by folder/tag; pin favorites for quick access.

## 🚀 Quick Start

### Local Install

```bash
# From repo root
npm install

# Option A: Full stack (backend + Vite frontend) using Makefile
make dev-full
# Backend on http://localhost:3000, Frontend on http://localhost:5173

# Option B: Backend only (serve classic UI)
make dev
# Visit http://localhost:3000

# Option C: Frontend-only HMR during UI work
make dev-vite
# Visit http://localhost:5173 (API must be running: make dev)

# Alternative: Using npm scripts directly
npm run dev          # Backend only
npm run dev:vite     # Frontend Vite dev server
```

### Docker Deploy

```bash
# Build and start the stack
npm run docker:build
npm run docker:up

# Logs and shell
npm run docker:logs
npm run docker:shell
```

Compose file: tooling/docker/docker-compose.yml. The stack reads variables from .env.

### Production Hardening

- Set strong `JWT_SECRET` and a correct `CORS_ORIGIN`.
- Enable rate limiting on auth endpoints.
- Run behind an SSL-terminating reverse proxy (see tooling/deploy/nginx.conf).
- Block private/loopback SSRF targets; production code already enforces this.
  📘 **[View full documentation →](help.html)** · [Installation Guide](INSTALL.md) · [Vite Migration](VITE_MIGRATION.md)

## 🔧 Configuration

### Minimal .env (Production)

```ini
# Required (production)
NODE_ENV=production
JWT_SECRET=change-me
CORS_ORIGIN=https://yourdomain.tld

# Optional
PORT=3000
DB_PATH=apps/database/anchormarks.db
ENABLE_RATE_LIMIT=true
VITE_PORT=5173
```

Then run:

```bash
npm run prod
```

See [INSTALL.md](INSTALL.md) for advanced deployment options.

## 📝 Documentation

- **[Help & Documentation](help.html)** - Complete user guide with all features (in-app)
- **[INSTALL.md](INSTALL.md)** - Installation and quick start guide
- **[VITE_MIGRATION.md](VITE_MIGRATION.md)** - ✨ Vite build system and migration guide
- **[SECURITY.md](SECURITY.md)** - Security policy and best practices
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Development guidelines
- **Auth & CSRF Flow** - Developer reference: [help.html#developer-auth-csrf](help.html#developer-auth-csrf)

### Testing

The project uses [Vitest](https://vitest.dev/) for testing across both client and server workspaces.

```bash
# Run all tests
npm test

# Run tests for a specific workspace
npm run test:server
npm run test:client
```

## 🔐 Security

- **Password Hashing** - bcryptjs
- **JWT Authentication** - Secure token-based auth
- **CSRF Protection** - Tokens for state mutations
- **User Isolation** - Per-user data filtering
- **Input Validation** - URLs, names, tags sanitized
- **SSRF Guard** - Private IP blocking

See [SECURITY.md](SECURITY.md) for details.

## 🖥️ System Requirements

- Node.js 18 or newer
- SQLite available on host (bundled with better-sqlite3)
- Recommended: 1 vCPU, 512MB RAM for small datasets
- Tested browsers: Chrome, Firefox, Edge (latest)

## 🧱 Architecture Overview

- Monorepo with workspaces: `apps/server` (Express + SQLite) and `apps/client` (Vite + TypeScript).
- Single API app handles auth, bookmarks, folders, tags, smart collections, and health tools.
- Frontend is a vanilla JS/TS app with stateful views and API helper.
- Background helpers: favicon/metadata fetchers with SSRF guards.

## 🛠️ Developer Workflows

- Start backend only: `npm run dev`
- Start frontend HMR: `npm run dev:vite` (requires backend)
- Full stack dev: `npm run dev:full`
- Run tests: `npm test`, coverage: `npm run test:coverage`
- Lint & format: `npm run lint` (or `npm run lint-check`)
- Docker during local dev: `npm run docker:up` then `npm run docker:logs`

## 🙋 Support / Questions

- Open an issue: https://github.com/gogogadgetscott/AnchorMarks/issues
- Feature ideas and feedback welcome — see [CONTRIBUTING.md](CONTRIBUTING.md)

## 📜 License

MIT License - use, modify, and distribute freely.

---

**[View full documentation in Help →](help.html)**

## 🛳️ Deployment Notes

- Docker compose file: `tooling/docker/docker-compose.yml` (use from project root)
- Environment file: `.env` — `docker:up` parses `PORT` from this file and the compose stack uses `env_file` to inject runtime variables.
- If host bind-mounted `data/` directory lacks correct permissions, run the helper before starting:

```bash
npm run docker:fix-perms   # requires sudo
npm run docker:up
```

- For production servers, prefer fixing host permissions (chown to UID 1001) and removing the need for sudo in automation.

### Running tests in container

To run the test suite inside a container (installs dev dependencies temporarily):

```bash
docker compose -f tooling/docker/docker-compose.yml run --rm anchormarks sh -c "npm install && npm test"
```

### Database settings_json (auto-migrated)

- AnchorMarks now stores flexible user preferences in a JSON column `settings_json` within the `user_settings` table. This avoids schema changes for each new setting.
- On startup, the server auto-migrates existing databases by adding the `settings_json` column if it does not exist. No manual action is required.
- Known settings continue using dedicated columns for backward compatibility. New settings are saved under `settings_json` and merged into `/api/settings` responses transparently.

### Next Steps
Make server tag matching exact (avoid substring matches)

Replace GROUP_CONCAT + LIKE approach with a proper JOIN + GROUP BY + HAVING implementation. This avoids false positives when tags are substrings of other tags.
Files to change: bookmark.js (+ controller tests).
Add unit tests covering edge cases (e.g., tags a, ab, multiple tags with AND mode).
Add an E2E Playwright test for Tag Cloud → Bookmarks flow

Verify clicking a tag updates header and renders bookmark cards in the Bookmarks view (real DOM/visual check).
Files to add: e2e/tag-cloud.spec.ts (Playwright config/update if not present).
Make legend height/reserve dynamic

Measure the legend element at runtime instead of using a hard-coded legendReserve (88px). Improves robustness across UIs and zoom levels.
Files: tag-cloud.ts.
Silence/resolve test noise about relative API URLs

Observed warnings (ERR_INVALID_URL) from tests calling /api/... in Node environment. Options:
Mock those endpoints in tests, or
Make api() tolerate relative paths in test env by using a safe base (e.g., http://localhost) when globalThis.location is undefined.
This is low-risk cleanup to improve test output clarity.
📋 Implementation Plan (if you want me to implement)
Create branch: feature/bookmark-tag-matching (server fix) or feature/tag-cloud-e2e (E2E) depending on priority.
Implement server-side JOIN + GROUP BY + HAVING in bookmark.js.
Add/adjust unit tests in __tests__ to verify exact matches and AND/OR behaviors.
Add Playwright E2E test and CI job (if you want E2E in CI).
Update PROGRESS.md and run:
npm --workspace=apps/server test
npm --workspace=apps/client test
npm run lint
Open a PR with summary, changes, tests, and screenshots (if UI affected).
Would you like me to start with (A) the server tag-matching fix, (B) adding E2E tests, or (C) the dynamic legend measurement (or all of them)? 🔧💡

Note: I can implement and run the tests locally and push a feature branch + PR per the repo workflow if you say “Go ahead — implement X”.