# T19 — Touch controls and scaling

- **Assignee:** Sonnet
- **Depends on:** T09, T27
- **Status:** done

## Goal
A friend who opens the invite link on a phone can play.

## Scope (`packages/client`)
- On touch devices: a floating virtual stick on the left half of the screen and a large action button on the right. Both produce the same `PlayerInput` as the keyboard.
- Canvas scales to fit any viewport at the largest integer multiple that fits, letterboxed; falls back to fractional scaling only on very small screens.
- The arcade cabinet frame and the menu layer from T27 stay aligned with the canvas at every scale, including the fractional fallback. On a phone there is usually no spare room, so the frame is simply cropped away.
- Landscape is required on phones; show a "rotate your device" prompt in portrait.
- Touch targets in menus are at least 44 CSS pixels. Respect safe-area insets.
- Pausing the tab or locking the phone sends neutral input and resumes cleanly.

## Done when
- A full match is playable on one iOS Safari and one Android Chrome phone (note the devices in Handoff).
- Desktop behaviour is unchanged.
- Rotating the device mid-round does not break layout or input.

## Out of scope
Native app wrappers, gamepad support.

## Handoff
- **Built:** `packages/client/src/touch.ts` (`TouchControls`, `isTouchDevice`): a floating stick on the left half (anchors where the thumb lands, drags along past its edge, 15% dead zone, analog) and a 100 px action button bottom-right (a tap shorter than one tick still counts). Shown only in INTRO/PLAYING on `(pointer: coarse)` devices; merged with the keyboard in `main.ts` through `sanitizeInput`. `fit()` keeps integer zoom from 1× up and scales fractionally only below 1× (`--zoom` drives canvas, frame, menus and fade, so they stay aligned). Portrait on a phone shows a "Rotate your device to play" cover (`#rotate`, CSS only). On touch devices buttons and inputs are at least 44 CSS px (`min-height: max(52px, 88px / zoom)`); desktop CSS is unchanged. The page blocks scroll, pinch and double-tap zoom. Hidden tab, `pagehide` or an orientation flip releases stick, button and keys, and `NetGame.sendNeutral()` tells the server to stop us. While a text input is focused, width-unchanged resizes (the on-screen keyboard) are ignored so the layout does not collapse.
- **Verified:** `npm test` (186 pass), `npm run build` and `npm run lint`. Playwright with Chromium touch emulation (844×390, `isMobile`, `hasTouch`): every menu button and input measured ≥ 44 px tall; a real round with bots, stick drag moved the knob and the action button registered as held; portrait 390×844 shows only the rotate prompt; 568×320 gives zoom 0.8875 with HUD and controls intact. **Not done:** no real iOS Safari or Android Chrome phone was available to me, so the "full match on a phone" item still needs you to play one on each and note the devices here. Safe-area insets rely on the default `viewport-fit=auto`, where the browser keeps content out of the notch area itself; untested on a notched device.
- **Review fixes:** the 44 px rule no longer enlarges the action button on small screens; the button honours `env(safe-area-inset-*)` (the page stays `viewport-fit=auto`, so the browser keeps content clear of the notch; still untested on a notched device); `sendNeutral()` now goes through the same path as a normal tick so prediction history stays aligned; the intro card and cooldown label say "LEFT THUMB STICK" / "GO! BUTTON" on phones.
- **Device playthrough:** the project owner played a full match on a phone and approved it (device models not recorded).
- **Known gaps:** at 1x zoom the 44 px buttons make the lobby fairly tight, though it fits at 844x390.
- **Follow-up:** the Add-to-Home-Screen hint is ticket T29.
- **For next tickets:** T22 e2e can emulate touch the same way (`hasTouch`, `isMobile`); tapping the focused menu button needs `force: true` because of its pulse animation.
