# T20 — Deploy

- **Assignee:** Sonnet
- **Depends on:** T09
- **Status:** todo
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
