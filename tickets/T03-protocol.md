# T03 — Network protocol

- **Assignee:** Sonnet
- **Depends on:** T02
- **Status:** done

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

**Built** (`packages/shared/src/protocol/`): `constants.ts` (version 1, room-code alphabet without I/L/O, name and message size limits, phases, error codes), `messages.ts` (`ClientMessage` / `ServerMessage` unions, `SeatInfo`, `RoundScore`, `ParseResult`), `parse.ts` (`parseClientMessage`, `parseServerMessage`, `encodeMessage`, `sanitizeName`), `PROTOCOL.md`, `protocol.test.ts`. Exported from `@monkey-mania-2/shared`.

**Verified:** `npm test` (61 pass, incl. round trip for all 8 client and 7 server types, plus junk/oversized/wrong-type/unknown rejection), `npm run build`, `npm run lint`.

**Notes for next tickets:**
- Messages are discriminated by `type`. Parsers return `{ok, message}` or `{ok:false, error:{code,message}}`, never throw; pass the raw WebSocket payload string.
- `parseClientMessage` already sanitises: names (control chars stripped, max 12), room codes (trimmed, uppercased), and `input` (via `sanitizeInput`, so diagonals are clamped to length 1).
- `createRoom` / `joinRoom` carry `v` (protocol version) and are rejected with `badVersion` on mismatch; `joined` echoes it.
- `setBotCount {count 0–3}` is the seat-fill option (host only; the server enforces host/phase, the parser only checks shape).
- `roundResult.scores[].points` is meant to already include the final-round doubling; T05 computes it.
- Server snapshots are only shallow-validated (`tick`, `players` array); the client should trust the server, not re-validate deeply.
- Client messages are capped at 1024 chars, server at 64 K (UTF-16 code units, not bytes).
- Rate limiting is T04/T21; `rateLimited` and other server-side error codes exist in `ERROR_CODES` for them to use.
