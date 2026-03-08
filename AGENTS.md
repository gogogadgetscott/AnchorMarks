# AGENTS.md

## 1) Quick Start

AnchorMarks is a self-hosted bookmark manager (Node.js/Express/SQLite backend, Vanilla TS frontend).

- **Setup**: `npm install`
- **Dev**: `make dev-full` (Full stack with HMR)
- **Help**: `make help` for all commands.
- **Reference**: See [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for full setup and workflow details.

---

## 2) Architecture Essentials

### Backend (`apps/server`)

- **Entry**: `index.js` → `app.js`
- **DB**: `models/database.js`. **No ORM**; use **parameterized SQL only**.
- **Pattern**: Routes in `routes/`, handlers in `controllers/`, logic in `models/`, utils in `helpers/`.

### Frontend (`apps/client`)

- **Entry**: `src/main.ts` → `src/App.ts` (Vanilla TypeScript + DOM).
- **API**: `src/services/api.ts`.
- **Aliases**: `@features`, `@components`, `@utils`, `@services`.
- **Build**: Output goes to `apps/server/public/`.

---

## 3) Security & Data Rules (Mandatory)

1. **Auth**: httpOnly JWT cookie (no localStorage).
2. **CSRF**: Token required on all state-changing requests.
3. **Isolation**: **Every DB query must scope by `user_id`.**
4. **Validation**: Sanitize user input and use SSRF protections for external URLs.
5. **SQL**: Never build SQL with string concatenation.
6. **API Format**: Always return `{ success: true, data: [...] }` or `{ error: "reason" }`.

---

## 4) Frontend State Rule

After any mutation:

1. Reload data from server.
2. Re-render UI.
   **Do not assume local state equals DB state.**

---

## 5) Submission Checklist

1. **Tests**: Run `make test`. Add tests for new logic (see `apps/server/__tests__/`).
2. **Lint**: Run `make lint`.
3. **Docs**: Update `apps/server/public/help.html` for UI changes.
4. **Log**: Update `docs/CHANGELOG.md` with your changes.
5. **Git**: Use feature branches (`feature/...`, `bugfix/...`).

Refer to [CONTRIBUTING.md](CONTRIBUTING.md) for detailed PR requirements.
