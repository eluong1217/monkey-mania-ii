# T22 — End-to-end smoke test

- **Assignee:** Sonnet
- **Depends on:** T20, T21
- **Status:** todo

## Goal
One automated test that proves the whole thing works together.

## Scope
- A Playwright test that starts the built server, opens two browser contexts, creates a room in one, joins by invite link in the other, readies up, starts with two bots, and plays to the podium while sending random inputs.
- A server env flag for tests that shortens rounds and timers so the test finishes in under a minute.
- Asserts: both pages reach the podium, totals match on both pages, no console errors, no server errors.
- A second short test: one context disconnects mid-round and rejoins.

## Done when
- `npm run e2e` passes locally three times in a row.
- The test runs in CI (extend the workflow from T23).

## Out of scope
Visual regression testing, load testing.

## Handoff
