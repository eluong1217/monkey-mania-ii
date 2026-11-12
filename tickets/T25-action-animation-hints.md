# T25 — Mini-game action and elimination animation

- **Assignee:** Sonnet
- **Depends on:** T16, T10, T11, T12, T13
- **Status:** todo

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
