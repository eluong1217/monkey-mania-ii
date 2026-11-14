# T27 — Arcade cabinet frame around the screen

- **Assignee:** Sonnet
- **Depends on:** A06, T18
- **Status:** review

## Goal
The spare window space around the integer-scaled canvas shows an arcade cabinet, and the whole game, menus included, appears on its screen.

## Scope (`packages/client`)
- Draw `assets/ui/arcade_frame.jpg` (A06) as a decorative page layer behind the canvas, centred on it, at 1280×720 CSS pixels times the current zoom. Its central quarter then sits exactly under the canvas. Smooth filtering. The window crops whatever does not fit; the page stays black beyond the image and never scrolls.
- The frame never changes the zoom. `fit()` in `main.ts` keeps picking the largest whole multiple of 640×360 that fits the window; when there is no spare room the frame is simply not visible.
- Put the menus on the cabinet screen. Today `#ui` covers the whole window and sizes itself from it (`92vw`), and the menus are laid out for a 1280×720 screen (the lobby panel is about 620 px tall), so at 1× they would spill over the bezel. Make `#ui` a fixed 1280×720 box placed over the canvas, CSS-scaled by zoom ÷ 2 and clipped to the screen. Replace the viewport units inside it. `#fade` covers the same rectangle.
- Compute the zoom in one place and apply it to the canvas, the frame and the menu layer together, on load and on every resize.
- The frame ignores pointer events and is hidden from assistive technology. The joysticks and buttons in the art are decoration only.
- The debug overlay stays in the window corner.

## Done when
- At a 1600×900 window the canvas is 1280×720, centred, with the cabinet visible on all four sides (marquee edge above, control panel below, side panels left and right) and no gap or black screen edge showing between bezel and canvas.
- At a 1100×650 window (1×) every menu screen sits entirely inside the 640×360 cabinet screen, and its buttons work by mouse and by keyboard.
- At exactly 1280×720 the screens match the existing `tickets/T18-screenshots/`.
- Resizing the window keeps canvas, frame and menus aligned without a reload.
- `npm test` and `npm run build` pass.
- Screenshots of the lobby and of a round in play at 1100×650, 1600×900 and 1900×1000 are attached in Handoff.

## Out of scope
A setting to turn the frame off, glare or scanlines over the picture (the CRT filter is T17), clickable or animated cabinet controls, touch layout and fractional scaling on small screens (T19), any change to the 640×360 integer-scale rule.

## Handoff
- **Built:** `index.html` gets a decorative `<img id="frame">` (aria-hidden, no pointer events) behind `#game`, sized `1280px × zoom` by `720px × zoom` and centred. `#ui` is now a fixed 1280×720 box centred over the canvas, `overflow: hidden`, scaled by `zoom / 2`; `#fade` is the canvas rectangle. Viewport units are gone (`.screen` is 520 px, the title drop is `-800px`, `.start` is a fixed 1280×720 with `--z: 2`). `main.ts` still computes the zoom once in `fit()`, which sets `--zoom` for the canvas, frame, menus and fade; it now also runs on load, before Phaser exists. The debug overlay keeps the window corner (z-index raised above the menus).
- **Verified:** `npm test` (186 pass) and `npm run build` pass. Playwright screenshots of title, create-room, lobby and a round in play (real match with bots) at 1100×650, 1600×900, 1900×1000 and 1280×720 are in `tickets/T27-screenshots/`. At 1100×650 every menu sits inside the 640×360 screen; at 1280×720 the lobby matches `tickets/T18-screenshots/lobby.png`; `resized-1100-to-1900.png` shows a live resize with canvas, frame and menus still aligned. Buttons were driven by mouse in the script; keyboard focus rings show in the screenshots. Not checked: keyboard-only navigation by hand.
- **Known gaps:** the A06 art gaps still apply (only the tops of the joysticks show at 1×; marquee brighter than ideal). The build copies the whole `assets/` folder, so the 1.3 MB source `arcade_frame.jpeg` ships in `dist/` too; move it out of `assets/` if that matters. The playwright script was throwaway and is not committed.
- **For T19:** `#ui` is a fixed 1280×720 box scaled by `--zoom / 2`; fractional zoom would work with the same CSS if `fit()` stops flooring.
