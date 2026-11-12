# T15 — Asset manifest and loader

- **Assignee:** Sonnet
- **Depends on:** T07
- **Status:** done

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

**Built**
- `assets/manifest.json` (images, sheets with named animations, audio) and `assets/README.md` (generated from it: the A-ticket spec). The manifest is also imported by the client (`src/assets/manifest.ts`), so keys exist even with an empty `assets/`.
- `PreloadScene` loads the manifest with a progress bar, generates labelled placeholders for any file that fails to load (`src/assets/placeholders.ts`), registers animations as `<sheet>:<name>` (`animKey`), then starts `play`. Missing audio is skipped.
- Vite plugin in `packages/client/vite.config.ts` serves repo-level `assets/` at `/assets/` (real 404 for missing files; `_source` and `.DS_Store` excluded) and copies it to `dist/assets` on build.
- `RenderScene.sprite(key, frame, x, y)`; `drawPlayers` now draws `monkey_<colour>_top` frame 0. Monkey placeholders are a slot-coloured circle with "P1".."P4" above it, so the empty-folder look matches the old circles (the label no longer flips below the circle at the top screen edge).
- Tests: manifest validity (unique keys/files, animation bounds) and updated renderer tests.

**Verified**: `npm test` and `npm run build` pass; dev server returns 200 for existing assets and 404 for missing or `_source` ones. Not checked in a real browser (no screenshot): the placeholder canvases and the real-PNG swap are untested visually.

**For next tickets**
- Real monkey art is already in the manifest paths, so players now render as 64×64 monkeys instead of 24 px circles (T16 should tune size/animation). Slot 3's circle placeholder is purple but its art is the green monkey.
- Entities (fruit, coconuts, stump, backgrounds) are loaded but not drawn yet; T16 maps them via `scene.sprite`/new calls.
- Audio keys and filenames (`audio/<key>.ogg`) were invented here; A05 must match them. T17 plays them.
