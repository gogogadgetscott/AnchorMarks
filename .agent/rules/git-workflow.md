---
trigger: always_on
---

# Git Branching Policy

## Trigger

**ALWAYS** apply this rule when the user assigns a new coding task, bug fix, or feature request.

## Instructions

Before writing any code or modifying any files, you MUST perform the following steps:

1.  **Check Status**: Ensure the repo is clean and up to date with `main`.
2.  **Create Branch**: Create and switch to a new branch. **Do not** work on `main`.
3.  **Naming Convention**:
    - Use `feature/short-description` for new capabilities.
    - Use `bugfix/short-description` for error corrections.
    - Use `chore/short-description` for maintenance/config.
    - Use `hotfix/short-description` for urgent production fixes.
    - _Example:_ `feature/user-login-page` or `bugfix/fix-header-alignment`.

## Post-Task

- Once you have completed the code changes and tests pass, ask the user if they are ready for a Pull Request.
- If yes, push the branch and provide the link.
