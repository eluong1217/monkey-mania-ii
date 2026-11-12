# T02 — Simulation core and MiniGame contract

- **Assignee:** Opus
- **Depends on:** T01
- **Status:** done

## Goal
The deterministic simulation foundation and the plug-in interface every mini-game implements. This is the most depended-on contract in the project; favour a small, obvious API.

## Scope (all in `packages/shared`)
- `PlayerInput`: `{ moveX: -1..1, moveY: -1..1, action: boolean }`, with a clamp/sanitise function.
- Seeded RNG (small, no dependency). Fixed step `TICK_RATE = 30`.
- Arena: 640×360 bounds, circle bodies, circle–circle and circle–bounds resolution, a knockback helper, a cooldown helper.
- `MiniGame<State>` interface, roughly:
  - `id`, `displayName`, `controlsHint`, `view: 'side' | 'top'`
  - `init(seed, playerSlots) → State`
  - `step(state, inputs, tick) → State` (pure with respect to its arguments plus the RNG held in state)
  - `isOver(state) → boolean`
  - `placements(state) → slot[][]` (ordered groups, to express ties)
  - `snapshot(state) → JSON-serialisable view` for clients and bots
  - one exported `tuning` object holding every balance number
- A mini-game registry keyed by id.
- A `sandbox` mini-game: four circles move around for 10 s, placements by slot order. It exists so T05/T07 can be built before real mini-games.
- A headless `runRound(miniGame, seed, inputFns)` helper used by tests, bots and the balance harness.

## Done when
- Determinism test: the same seed and input sequence produces byte-identical final snapshots across two runs.
- Tests cover bounds, collision resolution, cooldowns and input sanitising (including NaN and out-of-range values).
- `runRound` completes a sandbox round with scripted inputs.
- A short `packages/shared/README.md` explains how to write a mini-game in under a page.
- Update `docs/DESIGN.md` if the final interface differs from the sketch above.

## Out of scope
Networking, rendering, real mini-games, bots.

## Handoff
Built (all in `packages/shared/src`): `constants.ts` (`TICK_RATE = 30`, `DT`, `MAX_PLAYERS`, `secondsToTicks`), `input.ts` (`PlayerInput`, `NEUTRAL_INPUT`, `sanitizeInput(unknown)`: NaN/Infinity/non-numbers become 0, axes clamped, diagonal length capped at 1, `action` only for literal `true`), `rng.ts` (mulberry32 as a plain `{ s }` object: `createRng`, `nextFloat`, `nextRange`, `nextInt`, `chance`, `pick`), `arena.ts` (`ARENA` 640×360, `Body {x,y,r,vx,vy}`, `integrate`, `clampToBounds`, `circlesOverlap`, `resolveCircles`, `resolveAll`, `knockback`), `cooldown.ts` (tick-based `{ readyAt }`: `tryUse`, `isReady`, `remainingTicks`), `minigame.ts` (`MiniGame<State, Snapshot>`, `BaseSnapshot`, `Placements`, `AnyMiniGame`, `rankBy`), `run-round.ts` (`runRound(miniGame, seed, inputFns, { maxTicks, onSnapshot })`), `minigames/index.ts` (registry: `miniGames`, `getMiniGame`, `listMiniGameIds`), `minigames/sandbox/` (10 s, four circles, action = small push, placements by slot order). Everything is re-exported from `src/index.ts`. `packages/shared/README.md` explains writing a mini-game; DESIGN.md has a new "MiniGame contract" section.

Verified: `npm test` (22 tests, 19 new in `src/sim.test.ts`: input sanitising incl. NaN/out-of-range/garbage, RNG reproducibility, bounds, collision incl. coincident centres, knockback/damping, cooldowns, `rankBy` ties, registry, sandbox round via `runRound`, byte-identical snapshots across two runs at every tick, snapshot does not alias state), `npm run build`, `npm run lint` all pass.

Differences from the sketch / things to know:
- `step` may mutate `state` in place (and must return it). Don't keep references to an old state expecting it unchanged. If T07 ever needs client-side prediction, clone with `structuredClone` first.
- `tuning` is a field on the `MiniGame` object as well as an export, typed flat `Record<string, number>`, so T14 can read and override it generically.
- Every snapshot must extend `BaseSnapshot` (`tick`, `players: {slot,x,y,r}[]`, optional `timeLeft`, `entities: {kind,x,y,r}[]`). T07's fallback renderer and T08's wander bot should rely only on these fields.
- `InputFn` is `(snapshot, slot, tick) => PlayerInput`, so T08 bots can be adapted into it; `runRound` sanitises every input, the same as the server should.
- `action` is "held". Mini-games that want a press edge track the previous value themselves.
- The registry holds `sandbox`; T09 must filter it out of the party pool.
- Shared imports use `.js` suffixes, matching the server's convention.
- Packaging (review fix): `shared` builds to `dist/` (JS + `.d.ts`) and its `exports` map has a `source` condition pointing at `src/index.ts`. Plain Node (`npm start`) and the server's `tsc` use `dist`, so `npm run build` must run before `npm start` (the workspace order builds shared first). Vite, Vitest, the client's typecheck and `tsx` (server `dev`, run with `--conditions=source`) use `src` directly, so no shared build is needed during development. Anything new that runs shared code from source, such as T14's balance script under tsx, needs `--conditions=source` as well, or a shared build first.
