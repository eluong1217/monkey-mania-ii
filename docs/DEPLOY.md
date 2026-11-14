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
- **Single instance:** rooms are not shared between instances, so never scale beyond one.

## Roll back

Render service → **Events/Deploys** → pick the last good deploy → **Rollback**. Or revert the commit on `main`.

## Run the image locally

```sh
docker build -t monkey-mania-2 .
docker run --rm -p 8080:8080 monkey-mania-2   # http://localhost:8080
```
