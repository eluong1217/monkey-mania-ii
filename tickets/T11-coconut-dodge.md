# T11 — Mini-game: Coconut Dodge

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** done

## Goal
A last-monkey-standing survival round. Rules are in `docs/DESIGN.md`.

## Scope
- `packages/shared/src/minigames/coconut-dodge/`: implement `MiniGame`. Top-down. Each coconut shows a shadow target for a fixed warning time, then lands; anyone inside the radius is out. Drop rate and simultaneous count ramp up. Some coconuts target players' current positions so standing still is punished. Roll gives a short dash with brief invulnerability, 3 s cooldown.
- Hard cap at 45 s: survivors share first place. Placement is reverse elimination order; same-tick eliminations tie.
- The warning time must always be long enough to walk out of the radius from its centre.
- All numbers in `tuning`.
- A bot: steer away from active shadows weighted by time to impact, prefer open space, roll only when otherwise trapped.
- Placeholder renderer.

## Done when
- Sim tests: hit detection, invulnerability window, elimination order and ties, 45 s cap, the escape-is-possible guarantee.
- Four normal bots complete 100 seeded rounds headlessly; median round length is between 15 s and 40 s (report the figure in Handoff).
- Playable in the browser by forcing this mini-game id.

## Out of scope
Final art, sound, changes to other mini-games or shared core.

## Handoff


**Built**
- `packages/shared/src/minigames/coconut-dodge/index.ts`: the `MiniGame` (top-down, 45 s cap) with exported `tuning`; `bot.ts`: the bot, registered in `bots/registry.ts`. Registered in `minigames/index.ts` and exported from the shared index (`coconutDodge`, `CoconutDodgeSnapshot`, `CoconutView`).
- `packages/client/src/render/coconut-dodge.ts`: placeholder renderer (red ring plus a shadow that fills as it nears landing, white impact flash, X on eliminated monkeys, roll-ready halo), registered in `render/index.ts`.
- Hit test: a monkey's centre within `impactRadius` (34 px) when the coconut lands, unless `tick < invulnUntil`. Warning is 1.1 s; 150 px/s walks 165 px in that time, asserted at least 1.5x the radius, also from a corner.
- Spawn rate ramps linearly from one coconut per 1.0 s to one per 0.35 s, and batch size from 1 to 3. The chance a coconut aims at a random living player's current position goes from 25% to 60%.
- Roll: 6-tick dash at 420 px/s in the held direction (or last-moved direction), 0.45 s invulnerable, 3 s cooldown.
- Snapshot extras: `alive`, `outAt` (-1 while alive; no Infinity in JSON), `rollReadyAt`, `invulnUntil`. Entities are `shadow` (with `landsAt`, `warnTicks`) and short-lived `impact`. Eliminated monkeys stay in `players`.

**Verified**
- `npm test` (10 new tests: hit detection, invulnerability window and roll cooldown, elimination order and ties, 45 s cap, escape guarantee, ramp, determinism, 100 seeded 4-bot rounds), `npm run build` and `npm run lint` pass.
- Median round length with four normal bots over 100 seeds: **35.9 s** (inside 15-40 s but near the top; if T14 wants shorter rounds, lower `spawnEndInterval` or raise `maxExtraPerBatch`).
- Played in the browser with the id forced; looks good. No roll or elimination animation yet: see T25.

**For later tickets**
- T09's pool picks this up automatically from the registry. All balance numbers are in `tuning`.
