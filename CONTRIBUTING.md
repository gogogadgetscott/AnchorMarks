# Contributing to AnchorMarks

Thanks for your interest in improving AnchorMarks!

## Quick Start

- Fork and clone the repo
- `npm install`
- `npm test` to run the suite
- Make changes in a feature branch and add tests when possible

## Code Style

- Keep code readable and self-explanatory; add small comments only where logic is non-obvious.
- Favor small, focused commits with descriptive messages.

## Testing

- Add or update tests for new behaviors.
- Ensure `npm test` passes before opening a PR.

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

## PR Checklist

- Tests: add/adjust unit tests for new behavior (`npm test`).
- Lint/format: run `npm run lint` and keep diffs focused.
- Docs: update README/help where user-facing changes occur.
- Security: avoid secrets, follow JWT/CSRF patterns.
- Scope: keep changes minimal and targeted to the problem.
