# T16 — Integrate final art

- **Assignee:** Sonnet
- **Depends on:** T15, A02, A03, A04
- **Status:** todo

## Goal
Every placeholder shape is replaced by the delivered art, animated and layered correctly.

## Scope (`packages/client`)
- Wire monkey poses to state for all four mini-games: idle, run (2 frames, flip for direction), action, stunned, out, win.
- The sheets have few frames by design. Add code-driven motion so characters feel alive: idle bob, lean into movement, squash and stretch on action and landing, wobble while stunned. Keep it in one small reusable helper.
- Sprites and backgrounds are pre-rendered low-poly art, not pixel art: do not snap them to a palette or re-pixelate them.
- Fruit, coconuts, stashes, platform and shadows use their sprites. Depth-sort top-down scenes by y.
- Backgrounds per mini-game, plus title and lobby art. Light parallax in side view only.
- Each seat keeps the same monkey colour and accessory across the whole match and in all UI.
- Report any sprite that does not match the manifest spec instead of stretching it.

## Done when
- No placeholder textures appear during a full match (the loader from T15 logs none).
- Screenshots of each mini-game, lobby and podium are attached in Handoff.
- Frame rate stays at 60 on a mid-range laptop with four players.

## Out of scope
Particles, screen shake, sound (T17); HUD styling (T18).

## Handoff
