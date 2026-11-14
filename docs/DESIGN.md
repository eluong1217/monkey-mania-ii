# Monkey Mania II: Primate Party — Design Contract

Every ticket assumes this document. If a ticket and this document disagree, this document wins; change it only through an Opus ticket or by the owner.

## The game

A 4-player online party game in the browser. Empty seats are filled by bots. A match is a set of short mini-games; whoever has the most party points at the end wins.

- **Start menu:** full-screen title "Monkey Mania II:" with "Primate Party" beneath it, then Play, How to Play, Settings. Play leads to create/join room.
- **Match:** 5 rounds, each a random mini-game with no repeats until the pool is exhausted.
- **Round flow:** intro card with controls (3 s) → play (30–60 s) → results (4 s).
- **Party points per round:** 1st 3, 2nd 2, 3rd 1, 4th 0. Ties share the higher value. The final round is worth double.
- **End:** podium screen, then Rematch (same room) or Leave.
- **Controls, every mini-game:** move (WASD / arrows / touch stick) plus ONE action button (Space / tap). Nothing else.

## Launch mini-games

| Id | View | Length | Goal | Action button |
|---|---|---|---|---|
| `fruit-frenzy` | Side | 40 s | Catch falling fruit: apple 1, banana 2, golden pineapple 5. Rotten fruit is −2 and a 0.5 s stun. Highest score wins. | Shove: short dash that bumps a rival sideways. 2 s cooldown. |
| `coconut-dodge` | Top-down | Last standing, 45 s cap | Coconuts land on telegraphed shadow targets; the rate ramps up. Hit = out. Placement by survival order. | Roll: quick dodge with brief invulnerability. 3 s cooldown. |
| `banana-heist` | Top-down | 60 s | Bananas spawn mid-arena. Carry up to 3 (each slows you 15%) to your corner stash. Stand on a rival stash for 1 s to steal one. Biggest stash wins. | Throw coconut: 1 s stun, target drops what it carries. 1.5 s cooldown. |
| `king-of-the-stump` | Top-down | Last standing, 45 s cap | A round platform that shrinks. Fall off = out. Placement by survival order. | Shove: knockback burst. 1.5 s cooldown. |

All numbers above are starting values. They live in one tuning object per mini-game and get changed in T14/P01, not scattered through code.

## Architecture

```text
packages/
  shared/   pure TypeScript: sim core, mini-games, bots, protocol types. No DOM, no Node APIs.
  server/   Node + ws. Rooms, lobby, authoritative match loop.
  client/   Vite + Phaser. Screens, rendering, input, interpolation.
reference/  the original 2018 Processing game. Read-only history.
tickets/    the work queue.
```

Rules that every ticket follows:

1. **Server-authoritative.** The server runs the simulation; clients send inputs and draw snapshots. Clients never decide scores, hits or outcomes.
2. **One simulation.** All gameplay logic lives in `packages/shared` and is deterministic: fixed 30 Hz tick, seeded RNG, no `Math.random`, no wall-clock time. The same code runs on the server, in tests and in the balance harness.
3. **Mini-games are plug-ins.** Each implements the `MiniGame` interface from T02 in its own folder: `packages/shared/src/minigames/<id>/`. Adding one must not require editing another.
4. **Bots are players.** A bot is a function from visible state to a `PlayerInput`, run on the server. Bots get no information or abilities a human lacks.
5. **Logical resolution 640×360**, integer-scaled with nearest-neighbour filtering (no smoothing). The low resolution is part of the early-2000s console look. Menus are laid out for the same screen and scale with it. Spare window space around the canvas shows the arcade cabinet frame (see Art direction); the frame never reduces the scale.
6. **Snapshots** go out at 20 Hz as JSON. Optimise only after measuring.
7. **Simplest thing that works.** No accounts, database, matchmaking, chat or cosmetics in v1. No dependency without a clear reason.
8. **Never trust the client.** Validate and rate-limit every inbound message; sanitise names.

### MiniGame contract (T02)

Defined in `packages/shared/src/minigame.ts`; how-to in `packages/shared/README.md`.

- `id`, `displayName`, `controlsHint`, `view: 'side' | 'top'`, `tuning` (flat `Record<string, number>`, every balance number).
- `init(seed, playerSlots) → State`; the seeded RNG (`createRng`) lives in the state.
- `step(state, inputs, tick) → State`: `inputs[slot]` is a sanitised `PlayerInput`, `tick` counts from 0. `step` may mutate `state` in place and returns the next state; it depends only on its arguments.
- `isOver(state)`, `placements(state) → slot[][]` (ordered groups for ties; helper `rankBy`).
- `snapshot(state)` returns plain JSON extending `BaseSnapshot`: `tick`, `players: {slot, x, y, r}[]`, optional `timeLeft` (seconds) and `entities: {kind, x, y, r}[]`, plus anything game-specific.
- Registry: `getMiniGame(id)` / `listMiniGameIds()` in `packages/shared/src/minigames/index.ts`. `sandbox` is a placeholder round. `runRound(miniGame, seed, inputFns)` runs a round headlessly.

## Stack

TypeScript (strict), npm workspaces, Vite, Phaser 4 (pinned in T01), `ws`, Vitest, Playwright for the end-to-end smoke test. One Node process serves the built client and the WebSocket endpoint.

## Art and audio direction

Early-2000s sixth-generation console look, delivered as pre-rendered 2D sprites and backgrounds (the game itself stays 2D): low-poly models with visible facets, low-resolution slightly blurry textures, flat vertex lighting from the upper left with soft baked shadows. Bright, saturated tropical colours and a playful party-game mood, never gritty. Y2K-era console menu styling for UI, kept large and readable.

Character animation uses few frames; movement life comes from code (bobbing, tilting, squash and stretch).

Four monkeys distinguished by colour AND an accessory (bandana, cap, shades, flower) so nothing relies on colour alone. Avoid heavy flashing; provide a reduced-effects toggle. An optional CRT screen filter may be added as a setting, off by default; it is never baked into assets.

The game is presented on an arcade machine: an early-2000s four-player cabinet in a dim arcade fills the window around the canvas, with a marquee above the screen and a control panel with four joysticks in the seat colours below it. The frame is page decoration behind the canvas, not part of the 640×360 picture; it is muted so the game stays the brightest thing in view, and the window crops it.

### Style block

Every art prompt ends with this text:

> Early-2000s sixth-generation console video game graphics. Low-poly 3D model with blocky, angular geometry, visible polygon facets and sharp edges. Low-resolution, slightly blurry bitmap textures wrapped onto the surface. Flat vertex lighting from the upper left with soft baked shadows; no ray tracing, no realistic reflections, no modern shaders. Bright, saturated tropical colours with a playful, cartoonish party-game mood. Y2K retro gaming aesthetic. No text, no logos, no user interface, no borders, no scanlines.

## Out of scope for v1

Accounts, global leaderboards, public matchmaking, more than 4 players, spectators, mobile app wrappers, unlockables.
