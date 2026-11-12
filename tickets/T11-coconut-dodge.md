# T11 — Mini-game: Coconut Dodge

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** todo

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
