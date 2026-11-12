# T10 — Mini-game: Fruit Frenzy

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** todo

## Goal
The original Monkey Mania, as a four-way scramble. Rules are in `docs/DESIGN.md`.

## Scope
- `packages/shared/src/minigames/fruit-frenzy/`: implement `MiniGame`. Side view; monkeys move horizontally along the ground. Fruit spawns from the top on a seeded schedule that speeds up over the 40 s. Apple 1, banana 2 (falls faster), golden pineapple 5 (rare, drifts sideways), rotten fruit −2 and a 0.5 s stun. Shove on a 2 s cooldown bumps a rival sideways.
- Spawns must be fair: spread across the width, never unreachable.
- All numbers in the exported `tuning` object.
- A bot: go to the best reachable fruit by value over travel time, avoid rotten fruit, shove when a rival is about to take a pineapple.
- A placeholder renderer in `packages/client` using labelled coloured shapes.

## Done when
- Sim tests: catch scoring, rotten penalty and stun, shove cooldown and displacement, round ends at 40 s, tie placements.
- Four normal bots complete 100 seeded rounds headlessly with no errors; every round has a positive top score.
- Playable in the browser by temporarily forcing this mini-game id.

## Out of scope
Final art, sound, changes to other mini-games or shared core.

## Handoff
