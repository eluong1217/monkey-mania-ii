# T07 — Client netcode and rendering

- **Assignee:** Opus
- **Depends on:** T05, T06
- **Status:** todo

## Goal
The round is visible and feels responsive: your monkey reacts instantly, everyone else moves smoothly.

## Scope (`packages/client`)
- Input capture (WASD/arrows + Space) sampled each client tick and sent as `input`.
- Remote entities: render ~100 ms in the past, interpolating between snapshots.
- Local player: predict movement with the shared sim's movement code and reconcile toward the server position (smooth correction, snap if far off). Keep it simple: movement only; action results come from the server.
- A per-mini-game renderer registry mirroring the shared registry: `render(snapshot, scene)`. Provide the `sandbox` renderer using coloured circles with slot labels.
- A generic fallback renderer that draws any snapshot's circle entities, so a new mini-game is visible before it has a custom renderer.
- Debug overlay (toggle key): ping, snapshot rate, correction distance.

## Done when
- Milestone M1: four seats (browsers and bots mixed) move around the sandbox arena via an invite link.
- With 150 ms of simulated latency and 5% dropped snapshots (add a dev-only flag), movement stays smooth and the local player does not rubber-band noticeably.
- Unit tests for the interpolation buffer and reconciliation maths.

## Out of scope
Party flow screens, art, audio, touch.

## Handoff
