# T14 — Balance harness

- **Assignee:** Haiku
- **Depends on:** T10, T11, T12, T13
- **Status:** todo

## Goal
One command that plays thousands of bot-only rounds and prints numbers to tune against.

## Scope
- A script run as `npm run balance -- --game <id|all> --rounds 1000 --difficulty normal`.
- Uses `runRound` from `packages/shared` with the registered bots. No server, no sockets.
- Prints per mini-game: win rate per seat, median and 10th/90th percentile round length, score spread between first and last, and tie frequency.
- Optional `--mixed` flag: one hard bot against three easy bots, reporting how often the hard bot wins.

## Done when
- The command finishes 1000 rounds of each mini-game and prints a readable table.
- Running it twice with the same `--seed` gives identical output.
- Output from a real run is pasted into Handoff.

## Out of scope
Changing any tuning values (that is P01 and follow-up tickets).

## Handoff
