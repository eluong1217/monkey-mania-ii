# T12 — Mini-game: Banana Heist

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** todo

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
