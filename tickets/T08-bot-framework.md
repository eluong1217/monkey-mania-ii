# T08 — Bot framework

- **Assignee:** Sonnet
- **Depends on:** T02
- **Status:** todo

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
