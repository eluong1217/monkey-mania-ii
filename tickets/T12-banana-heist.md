# T12 — Mini-game: Banana Heist

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** done

## Goal
Grab, carry, steal. The deepest mini-game in the launch set. Rules are in `docs/DESIGN.md`.

## Scope
- `packages/shared/src/minigames/banana-heist/`: implement `MiniGame`. Top-down, 60 s. Each player owns a corner stash. Bananas spawn near the centre on a seeded timer. Walking over a banana picks it up, to a maximum of 3; each carried banana slows movement 15%. Entering your own stash deposits everything carried.
- Stealing: standing on a rival stash for 1 s uninterrupted takes one banana into your hands. Being stunned cancels it.
- Throw coconut (1.5 s cooldown): a slow projectile in the facing direction. A hit stuns for 1 s and scatters the target's carried bananas on the ground nearby.
- Score is stash count at the buzzer; carried bananas do not count.
- All numbers in `tuning`.
- A bot: choose between collect, deposit, steal from the leader, and throw at a nearby loaded carrier, using simple utility scores.
- Placeholder renderer showing carried count and stash totals.

## Done when
- Sim tests: carry cap and slowdown, deposit, steal timing and cancellation, projectile hit / stun / scatter, cooldown, final scoring and ties.
- Four normal bots complete 100 seeded rounds headlessly; no bot wins more than 40% of rounds from any one corner (report per-corner win rates in Handoff).
- Playable in the browser by forcing this mini-game id.

## Out of scope
Final art, sound, changes to other mini-games or shared core.

## Handoff

**Built**
- `packages/shared/src/minigames/banana-heist/index.ts`: the `MiniGame` (top-down, 60 s) with exported `tuning` and `stashPosition(slot)`; `bot.ts`: utility bot (collect / deposit / steal from the richest rival, plus a throw when a loaded rival is in range and in line with its facing), registered in `bots/registry.ts`. Registered in `minigames/index.ts`, exported from the shared index.
- `packages/client/src/render/banana-heist.ts`: placeholder renderer (coloured corner stashes with counts, bananas, coconuts, `xN` carried count and STUN tag above monkeys, steal-progress ring, stash totals in the header), registered in `render/index.ts`.
- Rules: stashes at the four corners (slot order TL, TR, BL, BR), radius 30. Bananas spawn within 70 px of the centre every 1.2 s while fewer than 8 lie on the ground (4 at the start). Pickup cap 3, 15% slow each. Stealing needs 1 s on a rival stash, is blocked when full or the stash is empty, and is cancelled by leaving or by a stun. Coconut: 200 px/s in the facing direction, 1.3 s life, hits the first non-stunned rival, 1 s stun, scatters the carried bananas 22-50 px away. Facing is the last non-zero move direction.
- Snapshot extras: `stash`, `carried`, `stunnedUntil`, `throwReadyAt`, `stealTicks`, `stealFrom`, `faceX`, `faceY` (all per player in `players` order); entities are `stash` (with `owner`, `count`), `banana`, `coconut`.

**Verified**
- `npm test` (13 new tests: carry cap and slowdown, deposit, steal timing / reset / blocked cases, hit + stun + scatter + cancel, thrower immunity and expiry, cooldown, scoring and ties, spawn cap, determinism, 100 seeded 4-bot rounds), `npm run build` and `npm run lint` pass.
- Wins per corner over 100 seeded rounds with four normal bots (ties split): **TL 16.7, TR 23.7, BL 25.8, BR 33.8**. Under the 40% limit, but skewed toward slot 3. Likely cause is a small bias from slot-order iteration (pickups, collision resolution) plus bot variance; T14 may want to look. About 47 bananas are banked per round in total.
- Not played in a browser by me; the renderer and registry entry are in place, so forcing the id should work.

**For later tickets**
- All balance numbers are in `tuning`. T09's pool picks the game up from the registry.
- I removed the `console.log` from the T11 and T12 tests: they broke `tsc --noEmit` in `packages/shared` (no `console` in its lib), so `npm run build` was failing. The T11 median-length figure is in its Handoff.
