# T13 — Mini-game: King of the Stump

- **Assignee:** Sonnet
- **Depends on:** T02, T08
- **Status:** todo

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
