# T20 — Deploy

- **Assignee:** Sonnet
- **Depends on:** T09
- **Status:** done
- **Needs from owner:** which host to use and an account on it.

## Goal
A public URL where the game runs, redeployed from `main`.

## Scope
- One Node process serves the built client as static files and the WebSocket endpoint on the same origin and port (`PORT` env var).
- A `Dockerfile` (multi-stage, small final image) so the app is host-agnostic.
- Host requirements to check before choosing: long-lived WebSocket connections, an always-on instance (rooms live in memory, so sleeping instances drop matches), HTTPS/WSS.
- Deploy config for the chosen host, plus `docs/DEPLOY.md` with the exact steps and how to roll back.
- Graceful shutdown: stop accepting new rooms, give running matches a short window to finish.
- Sensible caching headers: hashed assets long-lived, `index.html` not cached.

## Done when
- The public URL loads over HTTPS and two people on different networks finish a match.
- `/healthz` is wired to the host's health check.
- A push to `main` results in a new deploy.

## Out of scope
Multiple regions, horizontal scaling, a database, custom domain.

## Handoff

**Built:**
- `packages/server`: `Cache-Control` headers (hashed `assets/<name>-<hash>.js|css` immutable, `index.html` no-cache, other assets 1 h), MIME types for jpg/woff2/ogg/mp3/txt, `RoomManager.draining` + `activeMatches()`, `createApp` now returns an `App` with `drain()` and `activeMatches()`. `main.ts` handles SIGTERM/SIGINT: refuses new rooms (`badPhase` error, no protocol change), waits up to `DRAIN_MS` (default 60 s) for matches, then exits.
- `Dockerfile` (two-stage, node:22-alpine, prod deps only, non-root, HEALTHCHECK), `.dockerignore`, `render.yaml` (free plan, auto-deploy from `main`), `docs/DEPLOY.md`.
- Host chosen by the owner: Render, free plan (sleeps after ~15 min idle; upgrade the instance type to stop that). Swap host by replacing `render.yaml`; the Dockerfile is unchanged.

**Verified:** `npm test` (190 pass, incl. new tests for headers, `/healthz`, drain), `npm run build`, `npm run lint`. Ran the built server with `node packages/server/dist/main.js`: headers correct, `/healthz` ok, SIGTERM exits cleanly.

**Not verified (needs the owner):** Docker is not installed here, so the image was never built. The repo is not on GitHub / Render yet, so there is no public URL and nothing was tested across networks or HTTPS. Whether an open WebSocket keeps a free instance awake is untested. Steps are in `docs/DEPLOY.md`.

**Next tickets:** T22 can target `PORT`; T24 should link `docs/DEPLOY.md` and the public URL once it exists.

**Owner verification (2026-11-14):** the owner deployed to Render and played a match on the public URL.
