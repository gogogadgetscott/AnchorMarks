# Contributing to AnchorMarks

Thanks for your interest in improving AnchorMarks! This project was built with AI-assisted development (GitHub Copilot, Claude, Antigravity), and we welcome contributions of all kinds—human or AI!

## 🚀 Getting Started

1.  **Fork & Clone**: Pull down the repository.
2.  **Install Dependencies**: Run `npm install` from the root.
3.  **Explore**: Run `make help` to see all available commands.

### Development Commands

Use the `Makefile` for all development tasks:

| Command         | Description                                          |
| :-------------- | :--------------------------------------------------- |
| `make dev-full` | Start full dev stack (backend + Vite frontend HMR)   |
| `make dev`      | Start backend only                                   |
| `make dev-vite` | Start Vite frontend only (requires separate backend) |
| `make test`     | Run all tests                                        |
| `make lint`     | Format and lint all code                             |
| `make build`    | Build for production                                 |
| `make clean`    | Clean build artifacts                                |

---

## 🛠️ Development Guidelines

### Branching Policy

- Never work directly on `main`.
- Start each task on a descriptive branch:
  - `feature/description`
  - `bugfix/description`
  - `chore/description`
  - `hotfix/description`

### Code Style

- **Readability**: Keep code self-explanatory. Add comments only for non-obvious logic.
- **Commits**: Use small, focused commits with clear, descriptive messages.
- **Scope**: Keep changes minimal and targeted to the specific problem.

---

## 🧪 Testing

- **Verify**: Always ensure `make test` passes before opening a PR.
- **Add Tests**: Include or update tests for any new behaviors or bug fixes.
- **Watch Mode**: Use `make test-watch` during active development.
- **Coverage**: Check `make test-coverage` for larger logic changes.

---

## 🛡️ Security

- **Secrets**: Never commit secrets or API keys.
- **Isolation**: Follow project patterns for JWT/CSRF and per-user data isolation.
- **Reporting**: Report vulnerabilities privately (see [SECURITY.md](SECURITY.md)).

---

## ✅ Pull Request Checklist

Before submitting your PR, please ensure:

- [ ] **Branch**: Working on a correctly named non-`main` branch.
- [ ] **Tests**: `make test` passes and new behavior is covered.
- [ ] **Lint**: `make lint` has been run to ensure consistent formatting.
- [ ] **Docs**: Updated `README.md` or `docs/` if there are user-facing changes.
- [ ] **Help**: Updated `apps/client/public/help.html` for new UI features.
- [ ] **Progress**: Updated `docs/PROGRESS.md` with a summary of work.
- [ ] **PR Description**: Includes clear rationale and verification steps.
