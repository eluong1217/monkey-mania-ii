# T28 — Wire the app icon into the page

- **Assignee:** Haiku
- **Depends on:** A07, T19
- **Status:** todo

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
