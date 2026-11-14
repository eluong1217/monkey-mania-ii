# T29 — Add-to-Home-Screen hint

- **Assignee:** Sonnet
- **Depends on:** T19, T26, T28
- **Status:** todo

## Goal
A friend on a phone is told once, in the game, how to add it to their Home Screen, because that is the only way to hide the browser bars on an iPhone and the best way to play on Android.

## Scope (`packages/client`)
- Show a small hint on the start menu (T26) on touch devices only (`isTouchDevice()` from `touch.ts`). Never show it on desktop.
- Wording by platform, detected from the user agent:
  - iPhone / iPad (Safari): "For the best experience: tap Share, then Add to Home Screen."
  - Android: "For the best experience: open the browser menu, then Add to Home screen."
  - Any other touch device: no hint.
- A dismiss button (at least 44 CSS pixels, like the other menu buttons). Remember the dismissal in `localStorage`; if storage is unavailable, show the hint every visit rather than throwing.
- Do not show it when the game already runs from the Home Screen (`navigator.standalone === true` or `matchMedia('(display-mode: standalone)').matches`).
- Style it in the existing menu look and keep it inside the T27 frame and T19 scaling, so it stays aligned at every zoom. It must not overlap the main menu buttons at 844x390 or 568x320.
- Keep the text in one small module with a pure function `homeScreenHint(userAgent, standalone, dismissed): string | null` so it can be unit-tested.

## Done when
- Unit tests cover `homeScreenHint` for iPhone, Android, desktop, standalone and dismissed.
- `npm test`, `npm run build` and `npm run lint` pass.
- On an iPhone and an Android phone in the browser the hint shows the right wording, dismisses, and stays dismissed after a reload (you check; note the devices in the Handoff).
- Opened from the Home Screen, or on desktop, no hint appears.
- Desktop behaviour is unchanged.

## Out of scope
A web app manifest, the Android `beforeinstallprompt` install button, a service worker, hints in the lobby or in a round, translations.

## Handoff
