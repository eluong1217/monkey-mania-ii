# @monkey-mania-2/shared

Pure TypeScript simulation code shared by server, client, bots and tests. No DOM, no Node APIs, no `Math.random`, no clock.

## Writing a mini-game

1. Make a folder `src/minigames/<id>/` with an `index.ts`.
2. Export a `tuning` object holding **every** balance number (flat `name: number` pairs; speeds in px/s, durations in seconds).
3. Export an object implementing `MiniGame<State, Snapshot>` (see `src/minigame.ts`):

```ts
export const myGame: MiniGame<MyState, MySnapshot> = {
  id: 'my-game', displayName: 'My Game', controlsHint: 'Move to X. Action: Y.', view: 'top', tuning,
  init(seed, playerSlots) { return { rng: createRng(seed), tick: 0, players: /* ... */ }; },
  step(state, inputs, tick) { /* advance one tick */ state.tick = tick + 1; return state; },
  isOver(state) { return state.tick >= secondsToTicks(tuning.durationSeconds); },
  placements(state) { return rankBy(state.players.map((p) => p.slot), (s) => score(state, s)); },
  snapshot(state) { return { tick: state.tick, players: /* fresh objects */ [] }; },
};
```

4. Register it: add one line to `src/minigames/index.ts`. Do not touch any other mini-game.

## Writing a bot

A bot is `{ decide(snapshot, mySlot, tick, rng) → PlayerInput }` (`src/bots/types.ts`). It sees only the snapshot, so it can never know more than a human. Use the `rng` argument for randomness, and closure variables for per-seat memory.

```ts
export const createMyGameBot = (): Bot => ({
  decide(snapshot, me, tick, rng) {
    const self = snapshot.players.find((p) => p.slot === me)!;
    const fruit = pickNearest(self, snapshot.entities ?? []);
    return toInput(fruit ? seek(self, fruit) : { x: 0, y: 0 });
  },
});
```

Register it with one line in `src/bots/registry.ts`: `botFactories['my-game'] = createMyGameBot;`. Games without a bot get the wander bot (`createBotFor(id)`).

Write the bot at full strength; difficulty is applied on top. `withDifficulty(bot, DIFFICULTIES.normal, seed)` returns an `InputFn` (usable in `runRound` and by the server) that decides from a snapshot `reactionTicks` old, rotates the move direction by seeded noise, and sometimes freezes. Presets: `easy`, `normal`, `hard`. Call it exactly once per tick. Steering helpers: `seek`, `flee`, `keepAwayFromEdge`, `pickNearest`, `distance`, `toInput`. Names: `pickBotNames(count, rng)`.

## Rules

- **Determinism.** `step` may mutate `state` and returns the next state. Its result may depend only on its arguments and the RNG stored in state (`createRng(seed)`, then `nextFloat`, `nextInt`, `nextRange`, `chance`, `pick`). Same seed + same inputs must give identical snapshots.
- **Ticks.** 30 per second (`TICK_RATE`). `tick` passed to `step` starts at 0. Per-tick movement is `speed * DT`. Convert seconds with `secondsToTicks`.
- **Inputs.** `inputs[slot]` is already sanitised (`moveX`, `moveY` in -1..1, length ≤ 1; `action` boolean, true while held). Track the previous `action` in state if you need a press edge.
- **Snapshots** are plain JSON and must extend `BaseSnapshot`: `tick`, `players: {slot, x, y, r}[]`, optional `timeLeft` (seconds) and `entities: {kind, x, y, r}[]`. The client's fallback renderer and generic bots rely on those fields. Build new objects; never return references into state. Bots see only the snapshot, so put in it everything a human could see.
- **Placements** list every slot exactly once, in ordered groups (`[[2], [0, 3], [1]]` = tie for 2nd). `rankBy(slots, score)` does this; for survival games use the elimination tick as the score and `Infinity` for still alive.

## Helpers

- `arena.ts`: `ARENA` (640×360), `Body` (`x, y, r, vx, vy`), `integrate(body, damping)`, `clampToBounds`, `resolveCircles`, `resolveAll`, `circlesOverlap`, `knockback(body, fromX, fromY, speed)`.
- `cooldown.ts`: `createCooldown()`, `tryUse(cd, tick, durationTicks)`, `isReady`, `remainingTicks`.
- `run-round.ts`: `runRound(miniGame, seed, inputFns, { maxTicks, onSnapshot })` runs a whole round headlessly. Each `InputFn` is `(snapshot, slot, tick) => PlayerInput`.

## Testing

Put `*.test.ts` next to the code. Every mini-game should have a determinism test via `runRound` plus rule tests that build a state with `init`, edit it, and call `step`. See `src/sim.test.ts` for examples.
