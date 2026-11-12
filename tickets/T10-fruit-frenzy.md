# T10 — Mini-game: Fruit Frenzy

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** done

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

**Built**
- `packages/shared/src/minigames/fruit-frenzy/index.ts`: the `MiniGame` (side view, 40 s) with the exported `tuning`; `bot.ts`: the bot, registered in `bots/registry.ts`. The game is registered in `minigames/index.ts` and exported from the shared index (`fruitFrenzy`, `FruitFrenzySnapshot`, `FruitView`).
- `packages/client/src/render/fruit-frenzy.ts`: placeholder renderer (fruit sprites or labelled shapes, scores along the top, shove-ready halo), registered in `render/index.ts`.
- Monkeys sit at `tuning.groundY` (298) and move on x only; `moveY` is ignored.
- Fruit spawn from a shuffled bag of 8 lanes across the width, so spawns spread out. Spawn interval goes 1.0 s to 0.35 s linearly. Fall time times `moveSpeed` stays at least half the arena width for every fruit kind (asserted in tests). Golden pineapples drift sideways and bounce off the spawn margins.
- Snapshot extras: `scores`, `stunnedUntil`, `shoveReadyAt` (per slot index); fruit entities carry `vx`, `vy`. The bot uses them to predict where fruit will land.
- Rotten fruit can take a score below zero (no floor). Stunned monkeys cannot catch. Shove is a dash in the facing direction that bumps overlapped rivals.

**Verified**
- `npm test` (9 new sim/bot tests: scoring, rotten penalty and stun, shove displacement and cooldown, 40 s end, ties, spawn spread and reachability, speed-up, determinism, 100 seeded 4-bot rounds with a positive top score), `npm run build` and `npm run lint` pass.
- One round played in the browser by the user with the id forced; looked fine. Shove (Space) was not separately checked online.

**For later tickets**
- Because the game is in the registry, T09's mini-game pool will include it automatically; T14 balance numbers all live in `tuning`.
