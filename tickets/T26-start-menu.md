# T26 — Start menu

- **Assignee:** Sonnet
- **Depends on:** T06
- **Status:** review

## Goal
The first thing a player sees is a full-screen title: "Monkey Mania II:" with "Primate Party" beneath it.

## Scope (`packages/client`)
- A Start scene shown on load, before the Home screen from T06.
- Layout, centred on the 640×360 canvas: "Monkey Mania II:" as the large title in the upper-middle; "Primate Party" directly under it, smaller and in an accent colour; below that a vertical menu: **Play**, **How to Play**, **Settings**.
- Play goes to the Home screen (name, create room, join room). Back from Home returns here.
- How to Play: one panel with the controls (move + one action button) and one line per mini-game, read from the mini-game registry so it stays current.
- Settings opens the settings panel if T17 has built it; until then show the item disabled.
- Keyboard: up/down to move, Enter or Space to select, Escape to go back. Mouse and touch also work. Visible focus on the selected item.
- Motion: the title drops in and settles with a small bounce, the subtitle fades in after it, and the selected menu item pulses gently. Skippable by any key. No flashing.
- The title and subtitle are real text drawn in the game font, not baked into an image, so T18 can restyle them. Use the `title` background key from the asset manifest when T15 exists; until then a plain jungle-green gradient.
- An invite link (`/?room=ABCD`) skips this screen and goes straight to name entry, as in T06.
- Set the browser tab title to "Monkey Mania II: Primate Party".

## Done when
- Loading the site shows the title, subtitle and menu, and Play reaches the Home screen.
- Every menu item is reachable and selectable by keyboard alone.
- Opening an invite link still lands on name entry.
- A screenshot of the start menu is attached in Handoff.

## Out of scope
Final fonts and menu art (T18), music (T17), any gameplay.

## Handoff
**Built:** a DOM start screen in `packages/client/src/screens.ts` (`start()`, `howTo()`, `go()`), styled in `index.html`. Shown before Home; Home has a Back button; Leave returns to the start menu. `?room=CODE` skips it. Tab title is "Monkey Mania II: Primate Party". How to Play reads `displayName`/`controlsHint` from the mini-game registry (sandbox excluded). Settings is a disabled item until T17. Title background is `/assets/backgrounds/title.png` with a green gradient fallback. Drop-in, fade-in and pulse are CSS, skipped by any key or `prefers-reduced-motion`.

**Verified:** `npm test` (186 pass) and `npm run build`. Playwright check against the dev server: start menu renders, ArrowDown + Enter opens How to Play, Escape returns, `/?room=ABCD` lands on name entry. Screenshot: `docs/screenshots/T26-start-menu.png`.

**Notes for next tickets:** menus are DOM over the canvas, not a Phaser scene, so T18 restyles with CSS (`.logo`, `.tagline`, `.menu`). T17 should enable the Settings button in `start()`.
