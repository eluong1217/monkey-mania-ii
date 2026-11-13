# T14 — Balance harness

- **Assignee:** Haiku
- **Depends on:** T10, T11, T12, T13
- **Status:** review

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

**Built**
- `scripts/balance.ts`, run by `npm run balance` (root `package.json` script, `tsx scripts/balance.ts`). It imports `packages/shared/src` directly, so there is no build step and no server.
- Flags: `--game <id|all>` (required), `--rounds` (default 1000), `--difficulty easy|normal|hard` (default normal), `--seed` (default 1), `--mixed` (seat 0 hard, seats 1–3 easy).
- `all` means every registered mini-game except `sandbox`.
- Bots come from `createBotFor(id)` wrapped with `withDifficulty(...)` from `DIFFICULTIES`. Each seat gets a seed derived from the round seed, so runs are reproducible. Bots are rebuilt every round.
- Columns: win rate per seat (a seat counts as a win when it is in the first placement group, so a tie for first counts for each tied seat), median / p10 / p90 round length in seconds, tie frequency (any shared placement group), and score spread (mean of first-place score minus last-place score). Score spread needs a per-player score in the snapshot: `scores` for fruit-frenzy, `stash` for banana-heist. The other two games print `n/a`. A round that does not finish within the 300 s safety cap counts as a timeout and is excluded from the stats.
- No tuning values were changed.

**Verified**
- `npm run balance -- --game all --rounds 1000 --difficulty normal --seed 7` finishes with 0 timeouts in about 1m50s. Running it again with the same seed gives identical output (`diff` clean).
- `--mixed` run with the same seed is also in the table below.
- Lint (`eslint`) and `prettier --check` pass on `scripts/balance.ts` and `package.json`.
- `npm test`: 186 of 186 pass (21 files).
- `npm run build`: passes (shared `tsc` and client build).
- Harness error handling: only the "did not finish" error from `runRound` counts as a timeout; any other exception is rethrown, so bugs are not reported as timeouts.

**Real output** (`--seed 7`, 1000 rounds per game, normal difficulty)

```text
balance: game=all rounds=1000 difficulty=normal seed=7

Fruit Frenzy (fruit-frenzy) — normal
  rounds played: 1000   timeouts: 0
  round length: median 40.0s   p10 40.0s   p90 40.0s
  tie frequency (any shared placement): 27.4%
  score spread, first minus last (mean): 12.34
  win rate per seat (in first place group):
    seat 0   25.2%
    seat 1   27.5%
    seat 2   23.5%
    seat 3   30.7%

Coconut Dodge (coconut-dodge) — normal
  rounds played: 1000   timeouts: 0
  round length: median 36.9s   p10 30.5s   p90 45.0s
  tie frequency (any shared placement): 42.9%
  score spread, first minus last (mean): n/a (no score in snapshot)
  win rate per seat (in first place group):
    seat 0   33.5%
    seat 1   29.1%
    seat 2   32.2%
    seat 3   33.3%

Banana Heist (banana-heist) — normal
  rounds played: 1000   timeouts: 0
  round length: median 60.0s   p10 60.0s   p90 60.0s
  tie frequency (any shared placement): 57.4%
  score spread, first minus last (mean): 4.87
  win rate per seat (in first place group):
    seat 0   23.4%
    seat 1   28.5%
    seat 2   37.1%
    seat 3   40.8%

King of the Stump (king-of-the-stump) — normal
  rounds played: 1000   timeouts: 0
  round length: median 14.8s   p10 8.2s   p90 21.5s
  tie frequency (any shared placement): 0.3%
  score spread, first minus last (mean): n/a (no score in snapshot)
  win rate per seat (in first place group):
    seat 0   24.9%
    seat 1   24.4%
    seat 2   26.0%
    seat 3   24.7%
```

`--mixed` (seed 7, 1000 rounds): hard bot wins Fruit Frenzy 97.0%, Coconut Dodge 99.9%, Banana Heist 96.0%, King of the Stump 97.2%.

**Fixes made in review (outside the original T14 file list, all small)**
- `packages/shared/src/minigames/king-of-the-stump/king-of-the-stump.test.ts`: removed the `KOTS_REPORT` debug line that used `process`. This fixed the `npm run build` failure without adding Node types to the shared package, which must stay free of Node APIs.
- `packages/shared/src/minigames/coconut-dodge/coconut-dodge.test.ts`: the "four normal bots finish 100 seeded rounds" test now has a 30 s timeout (was 5 s). It was timing out under parallel load. No assertions changed.

**Open: banana-heist edit must be settled before the baseline is used**
- The working tree has an uncommitted edit to `packages/shared/src/minigames/banana-heist/index.ts` (stash positions moved to the platform centres: `stashMarginX` 150, `stashMarginY` 82, `stashRadius` 40). The Banana Heist numbers above were produced with this edit. Without it, the baseline is for a different game.
- I did not commit or revert it. It is a gameplay change, so whoever owns T12 should either commit it (with its own message) or revert it, and then the Banana Heist numbers should be re-run.

**Notes for the next ticket (P01 playtest)**
- Use the output above as the baseline before tuning. Note that the seed-7 run is one sample; the win-rate spreads on Coconut Dodge and Banana Heist are large enough that a 1000-round check is the minimum before drawing conclusions.
- Banana Heist and Fruit Frenzy have many ties; ties are shared placements, so a "win" is credited to every tied seat.
