# T18 — HUD and UI polish

- **Assignee:** Sonnet
- **Depends on:** T09, T15
- **Status:** done

## Goal
Menus and HUD look like a finished early-2000s console party game and stay readable mid-action.

## Scope (`packages/client`)
- A bold, rounded early-2000s console menu font (openly licensed; record the licence in `assets/README.md`) across all screens. It must stay legible at the 640×360 logical resolution.
- Restyle Home, Lobby, intro card, results card, podium and settings using the UI art from A03/A04.
- In-round HUD: timer, per-player score or alive/out status, cooldown indicator for your action, and a clear "this is you" marker on your monkey.
- Scoreboard between rounds animates point gains.
- Screen transitions are short fades or wipes.
- Text contrast meets WCAG AA; nothing is communicated by colour alone; all menus keyboard-navigable with visible focus.

## Done when
- Screenshots of every screen are attached in Handoff.
- A new player can tell which monkey is theirs and what the action button does within the 3 s intro, checked with one person who has not seen the game.
- No text is smaller than 8 logical pixels tall.

## Out of scope
Touch layout (T19), gameplay changes.

## Handoff

**Built**
- Font: Lilita One (OFL 1.1) in `assets/fonts/`, licence recorded in `assets/README.md`. `@font-face` in `index.html`; `main.ts` waits for it before creating Phaser so canvas text uses it. Canvas text has a dark stroke for contrast and `PlayScene.text` clamps to a minimum of 8 logical px (DOM menus are 22px+).
- Menus (Home, Lobby, Results, Podium, Disconnected) restyled with `panel_frame`, `button_*` (normal/focused/pressed), seat badges, crown. Focus shows the glowing frame plus a ▶ pointer; ready state is text ("✔ READY"), not colour. Screens fade in, and a short fade-to-black covers the menu/canvas swap. Both respect `prefers-reduced-motion`.
- Results rows show a "+N" pop and the total counts up one point at a time.
- Intro card: your monkey (bobbing, "YOU ARE P1 (RED)"), MOVE keys, a SPACE keycap with the action name, and the countdown.
- In-round HUD (`PlayScene.hud`, generic over mini-games): badge + score or alive/OUT per player, timer with icon (red at 5 s), cooldown ring with seconds or READY for the local action (found from the snapshot's `*ReadyAt` array and the tuning's `*CooldownSeconds`), "YOU" label above your monkey (in `drawPlayers`). Bottom bar of party totals on a dark strip. The per-renderer P# score text and `drawTimer` were removed.

**Verified**: `npm test` and `npm run build` pass. Playwright screenshots of a real match against bots are in `tickets/T18-screenshots/` (home, lobby, intro, play, results, podium). Cooldown ring verified visually in `play-cooldown.png` (greyed with "1.6s / SPACE" after pressing the action). The HUD's per-player values are captioned "THIS ROUND" and the bottom bar shows party totals as "N pts", so the two numbers are no longer ambiguous. The "unfamiliar person" check was done by the user: a new player could tell which monkey was theirs.

**For next tickets**
- T19: HUD positions are fixed for 640×360; menu buttons are plain DOM and scale with the page. The "SPACE" prompt and keycap on the intro/HUD are keyboard-only and need a touch variant.
- T17: HUD has no sound hooks. Browser console shows "Unable to decode audio data" because the audio files are missing; this predates T18.
- Vite prints "didn't resolve at build time" notices for the `/assets/ui/*.png` CSS URLs; harmless, they resolve at runtime.
