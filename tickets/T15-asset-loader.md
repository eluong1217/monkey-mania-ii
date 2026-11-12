# T15 — Asset manifest and loader

- **Assignee:** Sonnet
- **Depends on:** T07
- **Status:** todo

## Goal
Art and sound can be dropped into a folder and appear in the game without code changes.

## Scope (`packages/client`)
- `assets/manifest.json` listing every sprite sheet (file, frame size, named animations with frame ranges and fps), image, sound and music track by a stable key.
- A loader that reads the manifest in a preload scene with a progress bar.
- When a key's file is missing, generate a labelled placeholder texture (or stay silent, for audio) so the game always runs.
- The full list of keys the game needs, pre-filled in the manifest and mirrored in `assets/README.md` with required pixel sizes and frame counts. This list is the spec the A-tickets deliver against; keep it in step with A02–A05. Sizes: monkey frames 64×64 (7 poses per sheet), small props 32×32, stashes and effects 64×64, stump 256×256, backgrounds 640×360.
- Convert existing placeholder renderers to look sprites up by key.

## Done when
- With an empty `assets/` folder the game looks the same as before this ticket.
- Dropping a correctly sized PNG named per the manifest replaces the placeholder after a reload.
- A test validates the manifest: unique keys, animations inside frame bounds.

## Out of scope
Producing art; effects and audio playback logic (T17).

## Handoff
