# T07 — Client netcode and rendering

- **Assignee:** Opus
- **Depends on:** T05, T06
- **Status:** review

## Goal
The round is visible and feels responsive: your monkey reacts instantly, everyone else moves smoothly.

## Scope (`packages/client`)
- Input capture (WASD/arrows + Space) sampled each client tick and sent as `input`.
- Remote entities: render ~100 ms in the past, interpolating between snapshots.
- Local player: predict movement with the shared sim's movement code and reconcile toward the server position (smooth correction, snap if far off). Keep it simple: movement only; action results come from the server.
- A per-mini-game renderer registry mirroring the shared registry: `render(snapshot, scene)`. Provide the `sandbox` renderer using coloured circles with slot labels.
- A generic fallback renderer that draws any snapshot's circle entities, so a new mini-game is visible before it has a custom renderer.
- Debug overlay (toggle key): ping, snapshot rate, correction distance.

## Done when
- Milestone M1: four seats (browsers and bots mixed) move around the sandbox arena via an invite link.
- With 150 ms of simulated latency and 5% dropped snapshots (add a dev-only flag), movement stays smooth and the local player does not rubber-band noticeably.
- Unit tests for the interpolation buffer and reconciliation maths.

## Out of scope
Party flow screens, art, audio, touch.

## Handoff

**Built** (`packages/client/src/`):
- `input.ts`: `Keyboard` tracks WASD/arrows/Space on `window` and `sample()`s a sanitised `PlayerInput`. Held keys are cleared on window blur. While `capturing` is true (INTRO/PLAYING), game keys `preventDefault` so Space does not press a focused button.
- `net/interpolation.ts`: `SnapshotBuffer`. It maps server tick to local time with a clock offset: an early arrival is taken at once, a late one only nudges the offset by 5%. It samples `INTERP_DELAY_MS` (100 ms) in the past and lerps players by slot. Non-player fields (`entities`, `timeLeft`, game-specific) come from the nearer snapshot. When it runs out of snapshots it extrapolates at most 2 ticks, then holds. It ignores duplicate and older ticks and resets when the tick jumps back by a second or more (new round). It keeps about 1 s of history.
- `net/prediction.ts`: `Predictor`. It moves the local player with the mini-game's `tuning.moveSpeed` and the shared `clampToBounds`. The protocol has no input acks, so it learns the lag (in client ticks) by matching how the server position moved over the last ~10 ticks against its own history. Displacements, not positions, are compared, so a standing error cannot bias the lag. Constant motion fits every lag equally, so only starts, stops and turns update it. Each snapshot's error is `server − predicted(lag ticks ago)`. Above 48 px it snaps; otherwise 25% of the error is removed per tick. A newer measurement replaces the pending one. Every correction shifts the history too, so nothing is corrected twice.
- `net/net-game.ts`: `NetGame`, with no Phaser. It runs a fixed 30 Hz tick off frame time (at most 5 ticks per frame) and sends `input` every tick during INTRO and PLAYING. It predicts only in PLAYING, and only for a mini-game with `tuning.moveSpeed`; otherwise the local player is interpolated like everyone else. It draws the local player between ticks (prev→current lerp). It resets on `roundIntro` and on socket close, and keeps stats for the debug overlay.
- `net/sim-network.ts`: dev-only bad network, `/?lag=150&drop=0.05`. `lag` is added round trip in ms, half each way, in order; `drop` is the share of `snapshot` messages discarded. It is wired in `main.ts` only under `import.meta.env.DEV`, so the production build ignores it.
- `render/`: `RenderScene` (circle, ring, text and `localSlot`), `Renderer = (snapshot, scene) => void`, a registry `getRenderer(id)` that falls back to `fallbackRenderer`, and `sandboxRenderer`. The fallback draws entities as pale circles with their kind's initial, and players as slot-coloured circles labelled P1–P4. The local player gets a white ring, and the timer is drawn top-centre. Sandbox adds a faint halo when your push is ready. `SLOT_COLORS` lives in `render/types.ts`.
- `play-scene.ts`: the Phaser scene. It implements `RenderScene` with one Graphics and pooled Text objects (restyled only when the text, colour or size changes). During INTRO it shows the intro name and controls hint.
- `debug-overlay.ts`: toggle with the backquote key (`` ` ``). Shows ping, snapshots per second and the last correction distance, plus the sim settings when active.
- `main.ts` creates the one `Connection` and passes it to `Screens` (constructor is now `new Screens(root, conn)`) and to `NetGame`. `Screens` hides `#ui` during INTRO and PLAYING and shows the lobby again for RESULTS ("Round over.") and PODIUM ("Match over."). `index.html` got a `[hidden]{display:none!important}` rule (`#ui` is `display:grid`) and `#debug` styles.

**Verified:** `npm test` (119 pass, 30 new in the client), `npm run build`, `npm run lint`.
- Unit tests: buffer bracketing and lerp, nearer-snapshot fields, extrapolation cap, out-of-order and new-round handling, clock offset under jitter. Predictor movement and bounds, comparison against the lagged history, smooth correction without overshoot, replace-not-add, snap, lag learning. Sim-network delay, ordering and snapshot-only drops. Renderer registry and fallback/sandbox drawing with a recording scene.
- Headless end to end in `prediction.test.ts`: the real sandbox sim as server, 150 ms round trip with ±5 ms jitter, 5% snapshot drop, unaligned 30 Hz clocks, scripted right/down/stop/left/diagonal. Learned lag 133 ms. Worst measured error 5 px, which is one tick of motion when jitter lands an input on the neighbouring server tick, and it is smoothed. Largest single-tick move 7 px against the normal 5 px. Remote interpolation at 20 Hz cadence with jitter and 5% drop never steps backwards, and its largest frame step is under 5 px.
- Real browsers: `npm run dev`, two separate headless Chrome instances driven over DevTools. Alice created a room, Bob joined through `/?room=CODE`, both readied, the host started, and bots filled seats 3–4. Both clients rendered all four labelled circles and moved under held keys. With `?lag=150&drop=0.05` the overlays read about 19–21 snapshots/s, ping ~127–166 ms, correction 0.0 px. Without lag: ~20/s, ping 0–7 ms, 0.0 px. When the round ended the lobby overlay came back with "Round over." A hands-on feel check by a human is still worth doing before marking done.

**For the next tickets:**
- Ping is estimated from movement: there is no ping/pong message, because adding one would change the shared protocol. Its resolution is one client tick (33 ms), it shows the default (167 ms) until you first start, stop or turn, and on localhost it reads 0–33 ms. If a real ping is wanted (T21 or later), add `ping {t}`/`pong {t}` to the protocol and feed it to the overlay. Prediction does not need it.
- Mini-game authors (T10–T13): prediction uses `tuning.moveSpeed` as pixels per second applied directly each tick, like the sandbox. Speed changes the client does not know about (Banana Heist's carry slow, stuns, dashes) show up as server corrections, smoothed under 48 px and snapped above. If that feels bad, give the game a per-state speed in its snapshot and have `NetGame.moveSpeed()` read it. A game without `moveSpeed` is simply not predicted.
- Player contact is not predicted. The server separates overlapping players (`resolveAll`), and the client only predicts movement and walls. In a headless test of walking into a standing player in the sandbox, the local circle was drawn up to 23 px into the other player's 24 px. Part of that is unavoidable, because remotes are drawn ~100 ms in the past. Contact also skews the learned lag (2.96 ticks against a true ~4.5 at 150 ms round trip), which later shows as a ~7 px snap-back when you stop. There is no backwards jitter while a key is held. Games with a lot of contact (T10–T13) should at least skip `measureLag` while the local player touches another, and may want to predict `resolveAll` against the interpolated remotes.
- Small follow-ups from review: the backquote key toggles the overlay even while typing in the name field (`debug-overlay.ts`), and `NetGame` (phase gating, resets) has no unit test.
- New renderers: add `render/<id>.ts` and one entry in `render/index.ts`. Renderers get a snapshot that is already positioned (remotes interpolated, self predicted) and must keep no state. `entities` have no ids, so they are not interpolated; they come from the nearer snapshot. Add an `id` and lerp them in `SnapshotBuffer` if fast projectiles look steppy.
- T09: `Screens` shows the plain lobby (with a Start button that the server rejects outside LOBBY) during RESULTS and PODIUM. Replace that with the real results and podium screens. `NetGame.intro` holds the last `roundIntro` for the intro card. The intro text drawn in `PlayScene` is a placeholder.
- T15/T16: `PlayScene.text` and `circle` are the only drawing primitives. Sprites will need new methods on `RenderScene`.
