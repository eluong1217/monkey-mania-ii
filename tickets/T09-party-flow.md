# T09 — Party flow

- **Assignee:** Sonnet
- **Depends on:** T07
- **Status:** todo

## Goal
A complete match: five rounds, points, podium, rematch.

## Scope
- `shared`: a small party state machine (`LOBBY → INTRO → PLAYING → RESULTS → … → PODIUM`), mini-game picker (random, no repeats until the pool is used up, seeded), party-point scoring per `docs/DESIGN.md` including ties and the double final round.
- `server`: drive the state machine from the match loop; timers for intro (3 s) and results (4 s); `rematch` returns the same players to a fresh match; anyone leaving mid-match is replaced by a bot.
- `client`: intro card (mini-game name, controls hint, countdown), results card (round placements, running totals), podium screen with Rematch and Leave, and a compact always-visible scoreboard during play.
- The `sandbox` mini-game is excluded from the pool unless no other mini-game is registered.

## Done when
- Milestone M2: one human plus three bots can play a full five-round match and a rematch without reloading.
- Tests for scoring (ties, double final), the picker, and every state transition.
- A bot-only match runs headlessly to `PODIUM` in a test.

## Out of scope
Final visuals (T18), reconnection (T21).

## Handoff
