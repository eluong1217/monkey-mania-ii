# T08 — Bot framework

- **Assignee:** Sonnet
- **Depends on:** T02
- **Status:** done

## Goal
A common way to write a bot per mini-game, with a difficulty dial that makes bots beatable and human-looking.

## Scope (`packages/shared/src/bots`)
- `Bot` interface: `decide(snapshot, mySlot, tick, rng) → PlayerInput`. A bot sees only what `snapshot` exposes.
- Wrapper that applies difficulty: reaction delay (acts on a snapshot N ticks old), aim/steering noise, and occasional hesitation. Three presets: easy, normal, hard.
- Bot registry keyed by mini-game id, with a fallback wander bot.
- Steering helpers: seek, flee, keep-away-from-edge, pick-nearest.
- Bot names from a short monkey-themed list.

## Done when
- A sandbox round runs with four wander bots through `runRound` and stays deterministic for a given seed.
- Tests show the difficulty wrapper delays reactions by the configured ticks and that noise is seeded.
- `packages/shared/README.md` gains a "writing a bot" section.

## Out of scope
Bots for specific mini-games (each mini-game ticket writes its own).

## Handoff
Built `packages/shared/src/bots/`: `types.ts` (`Bot`, `BotFactory`, `Difficulty`), `steering.ts` (`seek`, `flee`, `keepAwayFromEdge`, `pickNearest`, `distance`, `toInput`), `difficulty.ts` (`DIFFICULTIES` easy/normal/hard, `withDifficulty(bot, difficulty, seed) → InputFn`), `wander.ts` (fallback bot), `names.ts` (`BOT_NAMES`, `pickBotNames(count, rng)`), `registry.ts` (`botFactories`, `createBotFor(miniGameId)`). Re-exported from `shared/src/index.ts`; README has a "Writing a bot" section.

Verified: `npm test`, `npm run build`, `npm run lint` pass. `bots.test.ts` covers the reaction delay (exact ticks seen), seeded and bounded noise, hesitation, steering helpers, names, and a four-wander-bot sandbox round that is byte-identical across runs for one seed.

For later tickets:
- `withDifficulty` returns an `InputFn`, so it plugs straight into `runRound`. It is stateful (snapshot history, RNG): create one per seat and call it exactly once per tick. T05 should create it at match start with a per-seat seed.
- Registry is a factory map (`botFactories[id] = factory`) so bots can hold per-seat state. Mini-game tickets add one line there.
- Bots should be written at full strength; the wrapper handles weakening. Before the history fills, the wrapper uses the oldest snapshot it has.
- The wrapper's hesitation returns neutral input (including no action).
