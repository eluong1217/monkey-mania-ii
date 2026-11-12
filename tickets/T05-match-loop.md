# T05 — Authoritative match loop

- **Assignee:** Opus
- **Depends on:** T04, T08
- **Status:** todo

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
