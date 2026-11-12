# T23 — CI

- **Assignee:** Haiku
- **Depends on:** T01
- **Status:** todo

## Goal
Every push and pull request is checked automatically.

## Scope
- One GitHub Actions workflow: install with the lockfile, then `npm run lint`, `npm test`, `npm run build`.
- Node version read from a single place (`.nvmrc` or `engines`).
- Dependency caching.
- A status badge in the root README.

## Done when
- The workflow passes on `main`.
- A deliberately failing test on a branch turns the check red.

## Out of scope
Deploy steps (T20), end-to-end tests (T22 extends this workflow).

## Handoff
