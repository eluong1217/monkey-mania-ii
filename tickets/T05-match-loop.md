# T05 — Authoritative match loop

- **Assignee:** Opus
- **Depends on:** T04, T08
- **Status:** done

## Goal
The server runs one mini-game round for a room, driven by human inputs and bots, and streams snapshots.

## Scope (`packages/server`)
- Per-room loop at 30 Hz using a drift-corrected timer; never more than a few catch-up steps per wake.
- Latest-input-wins buffer per human seat; a silent client keeps its last input briefly, then goes neutral.
- Bot seats call the bot framework from T08 each tick.
- Broadcast `snapshot` at 20 Hz. Send `roundIntro` before and `roundResult` after, with placements.
- Runs any registered mini-game by id; use `sandbox` for now. The seed is chosen by the server and never sent before the round ends.
- Loop stops and cleans up when the room empties. One room's exception must not take down other rooms.

## Done when
- Test with a fake clock: a sandbox round with 2 scripted humans and 2 bots finishes with correct placements and the expected number of snapshots.
- Test: an input flood or garbage input from one client does not change another player's state or stall the loop.
- 50 simultaneous bot-only rooms run on a laptop without tick drift (log tick time; include the numbers in Handoff).

## Out of scope
Multi-round party flow (T09), reconnection (T21), client code.

## Handoff

**Built** (`packages/server/src/`):
- `ticker.ts`: `Ticker`, a fixed-rate loop on an injectable `Clock` (`realClock` = `performance.now` + unref'd `setTimeout`). Tick n is due at `origin + n·period`, so jitter never becomes drift. A late wake runs at most `MAX_CATCH_UP` (3) ticks, then skips ahead. Keeps `stats` (ticks, skipped, lateness, tick cost).
- `match.ts`: `Match` runs one round: INTRO (3 s, sends `roundIntro`) → PLAYING (30 Hz steps, `snapshot` broadcast on 2 of every 3 ticks = 20 Hz) → RESULTS (sends `roundResult`, 4 s) → PODIUM (sends `matchResult`), then stops. `startMatch(room, miniGameId = 'sandbox', options)` resolves any registered mini-game by id. `InputBuffer` is latest-input-wins, one entry per slot; a human's input is held 0.25 s (8 ticks), then goes neutral. Bot seats use `withDifficulty(createBotFor(id), DIFFICULTIES.normal, botSeed(seed, slot))`. The seed comes from `crypto.randomInt` and is never sent. Bots see the snapshot from before the step, as in `runRound`. An exception in a tick (mini-game or bot) is caught: that match logs `matchError`, stops, and its room goes to PODIUM. Other rooms are unaffected because each has its own timer.
- `room.ts`: `MatchHandle` interface and a `room.match` field. `connection.ts` routes `input` to `room.match?.input(this.slot, …)`. The slot always comes from the connection, never the message. `rooms.ts` stops a room's match when the room is deleted and on `close()`. `app.ts` now uses `startMatch(room, 'sandbox')` by default. `startMatchStub` is gone.
- `bench.ts` + `npm run bench -w @monkey-mania-2/server [-- rooms]`: N bot-only rooms on the real clock. Every message is JSON-encoded as though it were sent to 4 sockets.

**Verified:** `npm test` (98 pass), `npm run build`, `npm run lint`. `match.test.ts` (fake clock):
- 2 scripted humans through real `Connection`s and 2 bots finish in exactly 90 + 300 + 120 ticks. Each client gets 200 snapshots. The final snapshot and placements equal `runRound` with the same seed and inputs. Messages arrive in order, phases go LOBBY→INTRO→PLAYING→RESULTS→PODIUM, and the seed never appears in any message.
- Run twice, once with one client flooding 400+ garbage, oversized, wrong-phase and out-of-range messages per tick through its `Connection`: the result is identical to the calm run (same final state for everyone, same tick count, 200 snapshots). The rate limiter (2 messages per tick) drops most of the flood, so the test also sends a spoofed-`slot` message that gets through and calls `Match.input` directly with garbage (non-objects, NaN/Infinity, out-of-range values, non-boolean action) every tick. If sanitising is removed from `InputBuffer`, this test fails.
- A round that ends off the 20 Hz cadence still sends its final state as a snapshot, right before `roundResult`.
- The loop stops (`empty`) and leaves no timers when all humans disconnect.
- A mini-game that throws mid-round stops only its own room.
- Also covered: the input hold/neutral logic, no drift under timer jitter, and catch-up capped after a 500 ms stall.

**Bench numbers** (this laptop, real clock, sandbox: 3 s intro + 10 s play + 4 s results = 510 ticks per room):

| rooms | wall time | ticks per room | skipped | mean / max tick lateness | mean / max tick cost |
|---|---|---|---|---|---|
| 50 | 17.00 s | 510 / 510 | 0 | 0.74 / 5.4 ms | 0.010 / 1.7 ms |
| 200 (headroom check) | 17.01 s | 510 / 510 | 0 | 1.12 / 8.9 ms | 0.008 / 2.5 ms |

The first bench run found a bug, now fixed: an early wake could count as a skipped tick. Skips now happen only after the catch-up budget is spent.

**For the next tickets:**
- T07: snapshots are `{type:'snapshot', tick, miniGameId, state}`. `tick` is the sim tick after the step (1..300 for sandbox), and the first one arrives at tick 2. The round's last tick always sends one, even off the cadence. No snapshot is sent during INTRO, so position monkeys from the first snapshot. The server ignores the `tick` field of `input` messages. Input sent during INTRO is dropped, so send input every tick (not only on change) or a key held into PLAYING is lost.
- T07/T09: if a match throws, the room goes to PODIUM with no `matchResult` message. The podium screen must handle having no result.
- T09: `Match` runs a single round (`round: 1, totalRounds: 1`). `roundScores` is a placeholder (3/2/1/0, ties share the higher value, no double, total = this round). Replace it with the shared scoring and drive several rounds; `MATCH_TIMING` holds the intro and results lengths. Seats are assumed to be 0..3, all filled, which `Room.start` guarantees.
- T21: when every human leaves, the match stops at once (`empty`), and the room stays in its current phase until `RoomManager` deletes it 30 s later. A human who disconnects mid-round is left in their seat and just goes neutral; replacing them with a bot is T09/T21. Out-of-order or future-dated input ticks are not checked yet.
- Still open from T04, and out of scope here: `app.ts` `decodeURIComponent` throws on `GET /%`. Also, `Connection` sends an `error` reply for every rate-limited message (about 51k replies in 20 s to a flooding client); throttle the `rateLimited` reply.

