# T25 — Mini-game action and elimination animation

- **Assignee:** Sonnet
- **Depends on:** T16, T10, T11, T12, T13
- **Status:** done

## Goal
Each mini-game's special move and eliminations show on the monkeys. T16's `MonkeyAnimator` already has `action`, `stunned` and `out` poses, but `drawPlayers` never passes `MonkeyHints`, so only idle and run play.

## Scope
- `packages/client/src/render/fallback.ts`: let `drawPlayers` take an optional per-slot hints lookup and pass it to `animator.draw`.
- Each `render/<id>.ts` derives hints from its snapshot and passes them:
  - Coconut Dodge: `acted` on the tick a roll starts (`rollReadyAt` just moved forward), `out` when `alive[i]` is false. Replace the red X with the `out` pose.
  - Fruit Frenzy: `acted` on shove, `stunned` when rotten-fruit stunned.
  - Banana Heist: `acted` on throw, `stunned` when stunned.
  - King of the Stump: `acted` on shove, `out` when fallen.
- Rule: hints come from the snapshot only. If a mini-game's snapshot lacks the field, report it in Handoff rather than changing shared code.
- Optional: draw the Coconut Dodge shadows with the `coconut_shadow_target` sprite (see `entityImage`) instead of circles.

## Done when
- Rolling, shoving, throwing, stunned and out states each show the matching pose in the browser.
- Renderer code stays free of game logic (derive hints, nothing more).
- `npm test` and `npm run build` pass.

## Out of scope
Sim changes, new art, sound (T17).

## Handoff

**Built:** Most of the ticket was already in the tree: `drawPlayers` takes a hints lookup, a `justActed` helper derives `acted` from `*ReadyAt` and the tuning cooldown, and the Coconut Dodge, Fruit Frenzy and Banana Heist renderers already pass `acted`/`stunned`/`out` (Coconut Dodge also uses the `coconut_shadow_target` sprite and has no red X). The missing piece was King of the Stump, which dropped fallen players instead of drawing them. It now draws every player and passes `out` for `alive[i] === false`.

**Verified:** `npm test` (186 pass) and `npm run build` pass. I did not look at the poses in a browser, so the "shows the matching pose" item needs a quick manual check.

**Review:** the owner played all four mini-games in a browser and confirmed the poses (rolling, shoving, throwing, stunned, out) look right.

**Notes:** No snapshot fields were missing. `acted` is inferred from the ready-at tick, so it fires for about 4 ticks after each action and depends on the tuning cooldown matching the sim.
