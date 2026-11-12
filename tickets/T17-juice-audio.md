# T17 — Juice and audio

- **Assignee:** Sonnet
- **Depends on:** T15, T09, A05
- **Status:** todo

## Goal
Every meaningful event gives clear, satisfying feedback, without visual noise.

## Scope (`packages/client`)
- The client derives events by diffing consecutive snapshots (catch, hit, stun, deposit, steal, shove, eliminated, round win). If a mini-game needs an explicit event list in its snapshot, add it in that mini-game's folder only.
- Per event: a sound, a small particle burst, and where it fits a floating score number, squash-and-stretch or hit flash. Light screen shake for eliminations only.
- Music: one lobby track, one gameplay track, a short results sting. Audio starts after the first user gesture.
- Settings panel: master, music and effects volume, and a "reduced effects" toggle that disables shake and flashes. Stored in `localStorage` inside try/catch.
- Particle counts capped; reuse objects instead of creating them per event. Particles are simple flat-shaded shapes that match the low-poly look.
- Optional CRT screen filter (light scanlines and slight blur) as a setting, off by default and disabled by "reduced effects".

## Done when
- Every event listed above has audible and visible feedback in all four mini-games.
- With reduced effects on there is no shake or flashing.
- Settings persist across reloads; muted really is silent.

## Out of scope
Changing gameplay or the sim; new art.

## Handoff
