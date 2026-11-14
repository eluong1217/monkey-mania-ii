# T24 — README and portfolio blurb

- **Assignee:** Haiku
- **Depends on:** T20
- **Status:** review

## Goal
The repo explains itself to a visitor from the owner's portfolio.

## Scope
- Root `README.md`: what the game is, a play link, a screenshot or short GIF, the four mini-games in one line each, how to run locally, a brief architecture section pointing to `docs/DESIGN.md`, and credits/licences for fonts, audio and any AI-generated art.
- A "History" section: the original Monkey Mania was a 2018 AP Computer Science project in Processing, preserved in `reference/`.
- A 2–3 sentence portfolio blurb the owner can paste into their site.

## Done when
- A new reader can go from clone to a local match by following the README alone.
- All links work.

## Out of scope
- Code changes.

## Handoff

**Built:** root `README.md` rewritten: game summary, one-line description of each mini-game, scoring and controls, local run steps (Node 22, `npm ci`, `npm run dev`, or `npm run build && npm start`), a short architecture section linking `docs/DESIGN.md` and `docs/DEPLOY.md`, History (2018 Processing version in `reference/`), credits (Lilita One under OFL 1.1, Gemini-generated art, audio not yet added, no licence file), and a portfolio blurb. The CI badge is kept. The screenshot is `tickets/T27-screenshots/play-1280x720.png`, which shows the arcade frame. No code changed.

**Verified:**
- Local commands: `npm run build` passes. `node packages/server/dist/main.js` on port 3000 answers `/healthz` and `/` with 200. `npm run dev -w @monkey-mania-2/client` serves on http://localhost:5173 as the README says.
- Every relative link resolves (`docs/`, `reference/`, `tickets/`, `assets/fonts/OFL.txt`, the screenshot, `.nvmrc`). The CI badge URL returns 200.
- Prettier check passes on `README.md` and the ticket files (`npx prettier --check`). I did not run the full `npm run lint`.
- `npm test`: 209 of 210 pass. The one failure is `banana-heist bots > four normal bots finish 100 seeded rounds`, a 5 s timeout in the full parallel run. The same file passes alone (13/13), so it is load-sensitive. It is in a file this ticket does not touch.

**Not met / needs the owner:**
- "A new reader can go from clone to a local match" is verified up to the server and client starting. A full match in a browser was not run here.

**For the next ticket:** The audio credits (`assets/audio/CREDITS.md`) belong to A05 / T17 once the sound files exist.

**Update (owner):** the play link is now https://monkey-mania-ii.gnoule.com. It returns 200 for `/`, `/healthz` and the font asset.
