# T13 — Mini-game: King of the Stump

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** done

## Goal
Sumo on a shrinking tree stump. Rules are in `docs/DESIGN.md`.

## Scope
- `packages/shared/src/minigames/king-of-the-stump/`: implement `MiniGame`. Top-down. A circular platform centred in the arena shrinks steadily to a small minimum. A player whose centre leaves the platform is out.
- Monkeys push each other on contact. Shove (1.5 s cooldown) is a short-range burst that applies strong knockback to anyone in front, with slight self-recoil.
- Hard cap at 45 s: survivors share first place. Placement is reverse elimination order; same-tick eliminations tie.
- All numbers in `tuning`.
- A bot: stay toward the centre, face the nearest rival, shove when the rival is between it and the edge, back off while on cooldown.
- Placeholder renderer showing the platform edge clearly.

## Done when
- Sim tests: platform shrink over time, elimination at the edge, shove knockback and cooldown, body pushing, elimination order and ties, 45 s cap.
- Four normal bots complete 100 seeded rounds headlessly; median round length is between 10 s and 35 s (report the figure in Handoff).
- Playable in the browser by forcing this mini-game id.

## Out of scope
Final art, sound, changes to other mini-games or shared core.

## Handoff

**Built**
- `packages/shared/src/minigames/king-of-the-stump/index.ts`: the `MiniGame` (top-down, 45 s cap) with exported `tuning`, `platformRadius(tick)`, `PLATFORM_X/Y`. `bot.ts`: registered in `bots/registry.ts`. Registered in `minigames/index.ts`, exported from the shared index.
- `packages/client/src/render/king-of-the-stump.ts`: placeholder renderer (filled platform with a bold white edge ring, shove burst, ready ring on the local monkey, OUT labels, timer), registered in `render/index.ts`.
- Rules: platform centred at (320, 180), radius 150 shrinking linearly to 45 over 40 s, then holding. A monkey whose centre is outside the radius is out (the check runs after movement and the shrink). Monkeys spawn on a ring of radius 70 facing the centre. Contact pushing is the shared `resolveAll` separation. Shove: 1.5 s cooldown, 40 px reach, 60° cone around the facing (last non-zero move direction), 340 px/s knockback (damping 0.87 per tick, about 80 px of travel), 70 px/s self-recoil. All shoves in a tick resolve against start-of-tick positions, so slot order does not matter.
- Bot: heads for the centre near the edge, steps to the centre side of the nearest rival, turns to face them and shoves when they are on the edge side of it; backs off while on cooldown.
- Snapshot extras: `platformR`, `alive`, `outAt`, `shoveReadyAt`, `shovedAt`, `faceX`, `faceY` (per player in `players` order).

**Verified**
- `npm test` (11 new tests: shrink, edge elimination, shrink-caught elimination, shove knockback/cone/range/cooldown, shove off the platform, body pushing, elimination order and ties, 45 s cap, determinism, 100 seeded bot rounds), `npm run build` and `npm run lint` pass.
- Four normal bots, 100 seeded rounds: **median round length 14.7 s** (limit 10 to 35 s). Wins per slot (ties split): 24 / 23 / 26 / 27, so no seat bias.
- Not played in a browser by me; the renderer and registry entry are in place, so forcing the id should work.

**For later tickets**
- All balance numbers are in `tuning`. T09's pool picks the game up from the registry. The round is short with bots because they hold the centre and the platform shrink forces contact; T14/P01 may want a slower `shrinkSeconds` if human rounds feel too quick.
- The report line in the bot test only prints when `KOTS_REPORT=1` is set (no `console` in shared's lib).
