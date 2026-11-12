# T03 — Network protocol

- **Assignee:** Sonnet
- **Depends on:** T02
- **Status:** todo

## Goal
Typed messages shared by server and client, with validation, so T04 and T06 can be built in parallel.

## Scope (`packages/shared/src/protocol`)
- Client → server: `createRoom {name}`, `joinRoom {code, name, rejoinToken?}`, `setReady`, `startMatch` (host only), `setBotCount`/seat fill option, `input {tick, PlayerInput}`, `rematch`, `leave`.
- Server → client: `roomState` (code, seats with name / human-or-bot / ready / connected, host slot, phase), `joined {slot, rejoinToken}`, `roundIntro`, `snapshot {tick, miniGameId, state}`, `roundResult`, `matchResult`, `error {code, message}`.
- Room phases: `LOBBY | INTRO | PLAYING | RESULTS | PODIUM`.
- `parseClientMessage(raw)` and `parseServerMessage(raw)` that return a typed message or a rejection. Hand-written validation; no schema library unless it clearly saves code.
- Constants: room code format (4 uppercase letters, no ambiguous characters), name length limit, max message size, protocol version.

## Done when
- Round-trip tests for every message type.
- Malformed, oversized, wrong-type and unknown messages are rejected without throwing.
- A one-page `PROTOCOL.md` lists each message and when it is sent.

## Out of scope
Sockets, rooms, any I/O.

## Handoff
