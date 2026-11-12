# T04 — Rooms and lobby server

- **Assignee:** Sonnet
- **Depends on:** T03
- **Status:** done

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

**Built** (`packages/server/src/`): `room.ts` (`Room`: seats, host, ready, start, rematch; no sockets or timers), `rooms.ts` (`RoomManager`: unique 4-letter codes, empty-room deletion after 30 s), `connection.ts` (`Connection`: per-socket handler that parses via `parseClientMessage`, rate-limits, and dispatches), `rate-limit.ts` (token bucket, burst 90, 60/s), `match.ts` (`startMatchStub`), `app.ts` (now serves `/healthz` and wires `/ws`). Tests: `room.test.ts` (unit, fake sockets), `integration.test.ts` (four real `ws` clients reach all-ready and start).

**Verified:** `npm test` (all pass), `npm run build`, `npm run lint`.

**Notes for next tickets:**
- T05: replace `startMatchStub` by passing `hooks: { onMatchStart }` to `createApp`. The room is already in `INTRO` with bots seated when it is called. Use `room.broadcast`, `room.sendTo`, `room.seatInfo()` and set `room.phase` then `room.broadcastState()`. `input` messages are parsed but dropped in `Connection.handle` (marked "T05 routes inputs"); add routing there.
- `setBotCount` is validated (host, lobby) and stored in `room.botCount`, but `start` always fills every empty seat with a bot. Decide in T05/T06 whether it should do more.
- Lobby disconnect frees the seat; in later phases the seat stays, marked `connected: false`, and `rejoinToken` is issued but not yet honoured (T21). `rematch` (PODIUM) returns to LOBBY, removes bots and disconnected humans, and clears ready.
- Joining after the lobby is rejected with `badPhase`. "Everyone must be ready" is also `badPhase` (no dedicated code exists).
- WebSocket `maxPayload` is 4 KB.
- T05: `RoomManager` deletes a room 30 s after its last human disconnects, with no close hook. Add one (for example `onRoomClosed`) so a running match loop can be stopped.
- Known gap from T01: `app.ts` calls `decodeURIComponent` on the request path, so `GET /%` throws an uncaught `URIError`. Wrap it in try/catch and return 400.
