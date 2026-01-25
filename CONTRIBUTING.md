# Contributing to AnchorMarks

Thanks for your interest in improving AnchorMarks!

> **About this project**: AnchorMarks was built with AI-assisted development using GitHub Copilot. All contributions are welcome—whether human or AI-assisted!

## Quick Start

- Fork and clone the repo
- `npm install`
- `make dev-full` to start development environment
- `make test` to run the test suite
- Make changes in a feature branch and add tests when possible
- Use `make lint` to format and lint code
- Run `make help` to see all available commands

## Code Style

- Keep code readable and self-explanatory; add small comments only where logic is non-obvious.
- Favor small, focused commits with descriptive messages.

## Testing

- Add or update tests for new behaviors.
- Ensure `make test` passes before opening a PR.
- Use `make test-backend-watch` or `make test-frontend-watch` for development.

## Security

- Do not include secrets in commits.
- Report vulnerabilities privately (see SECURITY.md).

## Pull Requests

- Describe the change and rationale.
- Note any user-facing changes and manual steps to verify.

## Good First Issues

We label beginner-friendly tasks with `good first issue`. If you're new:

- Comment on the issue to request assignment.
- Ask clarifying questions — maintainers are happy to help.
- Start small: docs, tests, or focused bug fixes are perfect.

## Development Commands

Use the Makefile for all development tasks:

```bash
make dev-full           # Start full dev stack (backend + Vite frontend with HMR)
make dev                # Start backend only
make dev-vite           # Start Vite frontend only (requires separate backend)
make test               # Run all tests
make test-backend-watch # Run backend tests in watch mode
make test-frontend-watch # Run frontend tests in watch mode
make test-coverage      # Generate test coverage reports
make lint               # Format and lint all code
make clean              # Clean build artifacts
make help               # Show all available commands
```

All build, test, and development tasks are now centralized in the Makefile. See `make help` for complete list of targets.

## PR Checklist

- **Branch**: Create a feature branch (`feature/description`), bugfix branch (`bugfix/description`), or chore branch (`chore/description`)
- **Tests**: add/adjust unit tests for new behavior (run `make test`)
- **Lint/format**: run `make lint` and keep diffs focused
- **Docs**: update README/help where user-facing changes occur
- **Help HTML**: If adding UI features, update [apps/client/public/help.html](apps/client/public/help.html) with documentation
- **Security**: avoid secrets, follow JWT/CSRF patterns
- **Scope**: keep changes minimal and targeted to the problem
- **Scope**: keep changes minimal and targeted to the problem
