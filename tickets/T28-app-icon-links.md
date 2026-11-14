# T28 — Wire the app icon into the page

- **Assignee:** Haiku
- **Depends on:** A07, T19
- **Status:** done

## Goal
The browser tab shows the game's favicon, and adding the game to an iPhone Home Screen gives the A07 icon with the name "Monkey Mania II".

## Scope
- In `packages/client/index.html`, inside `<head>`, add:
  ```html
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png" />
  ```
- Keep the existing `<title>Monkey Mania II: Primate Party</title>` and `<meta name="apple-mobile-web-app-title" content="Monkey Mania II" />` (added by T19). If either is missing or different, set it to exactly that.
- Add a short "Icons" section to `assets/README.md`: the five files in `assets/icons/`, their sizes, and that they are linked from `index.html`, not loaded through `manifest.json`.
- Do not add the icons to `assets/manifest.json`. That file lists what the game loads by key; the icons are only used by the browser.

## Done when
- `npm test` and `npm run build` pass, and `packages/client/dist/assets/icons/` holds all five files.
- With the dev server running, `curl -I` on each of the three `href`s returns 200 with `Content-Type: image/png`.
- The browser tab shows the monkey favicon and the title "Monkey Mania II: Primate Party".
- On an iPhone, Share → Add to Home Screen offers the name "Monkey Mania II" and shows the A07 icon (you check; note the device in the Handoff).

## Out of scope
A web app manifest (`manifest.webmanifest`), the 192 and 512 icons' use, an Android install prompt, a service worker, `favicon.ico`, changing `theme-color`.

## Handoff
- **Built:** The three `<link>` tags (favicon 32, favicon 16, apple-touch-icon 180) are in `<head>` of `packages/client/index.html`. The `<title>` and `apple-mobile-web-app-title` already read exactly "Monkey Mania II: Primate Party" and "Monkey Mania II", so they were left alone. The "Icons" section in `assets/README.md` already exists (it was in the working tree before this session). Icons are not in `assets/manifest.json`; its only "icon" key is `timer_icon`. This session confirmed the existing edits and made no further code changes.
- **Verified:** `npm test` passed on rerun (210 tests); one run before it showed a single failing test in `packages/shared` (the minigame suite, around `wins`/`totalStash`), not rerun-reproducible and not in T28's files. `npm run build` passed, and `packages/client/dist/assets/icons/` holds all five files. Dev server on :5173: `curl -I` on `/assets/icons/favicon-32.png`, `favicon-16.png` and `apple-touch-icon.png` each returned 200 with `Content-Type: image/png`. Head tags match the ticket.
- **Owner checks:** The owner confirmed the browser tab favicon, and the iPhone Home Screen check (Share → Add to Home Screen shows "Monkey Mania II" and the A07 icon). Device: iPhone 16, latest iOS.
- **For T29:** The icons are linked from `<head>`. `icon-192.png` and `icon-512.png` are unlinked, reserved for a future manifest.
