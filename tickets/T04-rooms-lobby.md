# T04 — Rooms and lobby server

- **Assignee:** Sonnet
- **Depends on:** T03
- **Status:** todo

## Goal
Players can create a room, share its code, and gather in a lobby.

## Scope (`packages/server`)
- `ws` server on `/ws`; HTTP health endpoint at `/healthz`.
- Create room → unique 4-letter code. Join by code. Four seats. First player is host.
- Lobby state broadcast on every change. Ready toggles. Host can start when all humans are ready; empty seats become bots at start.
- Disconnect in lobby frees the seat. If the host leaves, the next human becomes host. Empty rooms are deleted after a short timeout.
- All inbound messages go through `parseClientMessage`; invalid ones get an `error` reply. Per-connection rate limit. Names trimmed, length-limited and stripped of control characters.
- Room logic written as plain classes/functions that are testable without real sockets.

## Done when
- Unit tests: create, join, full room rejection, bad code, host handover, room cleanup, rate limit.
- An integration test opens four real `ws` clients against the server and reaches "all ready".
- Starting the match switches phase to `INTRO` and calls a stub that T05 will replace.

## Out of scope
Running the simulation, reconnect during a match (T21), persistence.

## Handoff
