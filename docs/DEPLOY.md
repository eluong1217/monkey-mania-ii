# Deploying Monkey Mania II

Host: **Render** (free web service, built from the `Dockerfile`, automatic HTTPS/WSS). The Dockerfile is host-agnostic; any Docker host works too.

One process serves the client, `/healthz` and the `/ws` WebSocket on `PORT` (Render sets it; the image defaults to 8080).

## One-time setup

1. Push the repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. It reads `render.yaml` and creates the `monkey-mania-2` web service on the free plan.
3. The URL is `https://monkey-mania-2.onrender.com` (or similar). Every push to `main` redeploys automatically.
4. Custom subdomain: Render service → **Settings → Custom Domains → Add**, enter e.g. `monkey.yourdomain.com`. In Cloudflare DNS add a CNAME from `monkey` to the `.onrender.com` host. Set the proxy to DNS-only (grey cloud) until Render verifies and issues the certificate.

## Behaviour worth knowing

- **Free tier sleeps** after about 15 minutes with no traffic, and the next visitor waits roughly 30–60 s while it wakes. Rooms live in memory, so a restart drops them. To stop sleeping, change the service to a paid instance (Settings → Instance Type); nothing else changes.
- **Health check:** Render polls `/healthz`.
- **Deploys and graceful shutdown:** on SIGTERM the server refuses new rooms (clients see "Server is restarting") and waits for running matches, up to `DRAIN_MS` (25 s in `render.yaml`, under Render's shutdown window). Longer matches are cut off.
- **Caching:** hashed bundles (`assets/index-<hash>.js`) are cached for a year; `index.html` is `no-cache`; unhashed game art is cached for an hour.
- **Limits** (defaults in `packages/server/src/config.ts`; set an env var to override): `MAX_ROOMS` 200, `MAX_CONNECTIONS_PER_IP` 8, `MAX_MESSAGE_BYTES` 4096, `MESSAGES_PER_SECOND` 60 / `MESSAGE_BURST` 90, `IDLE_LOBBY_MS` 900000 (15 min), `EMPTY_ROOM_MS` 30000 (how long a room with nobody connected waits for a rejoin), `HEARTBEAT_MS` 15000.
- **`TRUST_PROXY=1`** (set in `render.yaml`) reads the client IP from the last `X-Forwarded-For` hop. Leave it unset anywhere the server is reached directly, or clients could spoof it. If Cloudflare's proxy (orange cloud) is turned on, that hop becomes a Cloudflare address and the per-IP limit then counts per Cloudflare edge.
- **Logs** are one JSON line per event (`roomCreated`, `playerJoined`, `playerRejoined`, `hostChanged`, `matchEnd`, `roomRemoved`, `connectionRefused`, `matchError`, ...). IPs never appear; a salted per-process hash (`ip`) groups lines from one client.
- **Single instance:** rooms are not shared between instances, so never scale beyond one.

## Roll back

Render service → **Events/Deploys** → pick the last good deploy → **Rollback**. Or revert the commit on `main`.

## Run the image locally

```sh
docker build -t monkey-mania-2 .
docker run --rm -p 8080:8080 monkey-mania-2   # http://localhost:8080
```
