# T23 — CI

- **Assignee:** Haiku
- **Depends on:** T01
- **Status:** review

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

**What was built**
- `.github/workflows/ci.yml`: one job, `ubuntu-latest`, on every push and pull request. Steps: checkout, setup-node with npm cache, `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- `.nvmrc` containing `22`, the same major version the Dockerfile uses. The workflow reads it through `node-version-file`, so it is the single source for the Node version.
- `README.md` at the root, created because none existed. It holds only the title, the CI badge and a one-line description. T24 owns the full README and should extend this file rather than replace the badge.

**How it was verified**
- Locally: `npm run lint`, `npm test` (210 passing) and `npm run build` all pass. `npm ci --dry-run` succeeds against the lockfile.
- Prettier parses `ci.yml` and `README.md` without changes.
- Not verified: the workflow has not run on GitHub. Nothing was pushed, per the no-commit rule. The "passes on main" and "failing test turns the check red" items need a push to confirm.

**Notes for the next ticket (T22, T24)**
- T22 can add its Playwright step after `npm run build` in `ci.yml`. It will need `npx playwright install` with browser caching.
- The badge URL assumes the repo is `eluong1217/monkey-mania-ii` (taken from `git remote`) and the workflow file is `ci.yml`. Renaming either breaks the badge.
