# T01 — Repo scaffold

- **Assignee:** Sonnet
- **Depends on:** —
- **Status:** done

## Goal
An empty but working TypeScript monorepo that later tickets can build in.

## Scope
- Move every original Processing file (`*.pde`, images, `sketch.properties`) into `reference/` using `git mv`. Add `reference/README.md` saying it is the 2018 original, kept for history only.
- Root package named `monkey-mania-2`; npm workspaces `packages/shared`, `packages/server`, `packages/client`, published names `@monkey-mania-2/shared` and so on.
- TypeScript strict mode with a shared base `tsconfig`. `shared` must compile with no DOM and no Node types.
- Vite + Phaser in `client` (pin the current stable major and note it in `docs/DESIGN.md` under Stack). `ws` in `server`. Vitest at the root.
- ESLint + Prettier with default-ish rules.
- Root scripts: `dev` (server and client together with reload), `test`, `lint`, `build`, `start` (serve built client from the server).
- `.gitignore` for `node_modules`, build output, env files.

## Done when
- `npm install && npm run lint && npm test && npm run build` pass from a clean clone.
- `npm run dev` shows a blank Phaser canvas at 640×360 logical size, integer-scaled, with nearest-neighbour scaling (no smoothing), and the server logs that it is listening.
- One trivial passing test exists in each package.

## Out of scope
Any gameplay, networking or UI.

## Handoff
Built: npm-workspaces monorepo (`shared`, `server`, `client`), strict TS via `tsconfig.base.json` (shared has `types: []`, no DOM), Vite + Phaser 4.2.1 client (640x360 canvas, `pixelArt`, integer zoom computed on resize in `packages/client/src/main.ts`), `ws` server (`packages/server/src/app.ts` serves `client/dist` and a `/ws` endpoint that currently closes connections), Vitest at root, ESLint (flat config) + Prettier, root scripts `dev/test/lint/build/start`.

Verified: `npm run lint`, `npm test` (3 tests), `npm run build` pass; `npm run dev` serves Vite on :5173 and the server on :3000 (Vite proxies `/ws`). Did not visually check the canvas in a browser.

Notes: the repo is not a git repo and had no Processing files, so nothing was moved with `git mv`; `reference/README.md` was created only. Server runs TS via `tsx` in dev and compiles to `dist` for `start`. Server imports use `.js` suffixes. Vite build warns about a >500 kB Phaser chunk; harmless. Server default port 3000 (`PORT` env).
