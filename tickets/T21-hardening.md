# T21 — Hardening

- **Assignee:** Opus
- **Depends on:** T09
- **Status:** done

## Goal
Real-world connections and unfriendly clients do not ruin matches.

## Scope
- Reconnect: a player who drops mid-match is played by a bot; returning within the match with their rejoin token restores their seat and score. The client retries automatically with backoff and shows a "reconnecting" state.
- Host leaving mid-match hands host to another human; a match with no humans left ends and the room is removed.
- Server limits: maximum rooms, connections per IP, message size, messages per second; idle lobby timeout. Limits are config values.
- Heartbeat ping/pong to detect dead sockets.
- Review every inbound message path for trust issues: acting for another slot, acting in the wrong phase, replayed or future-dated input ticks, oversized names.
- Rejoin tokens are unguessable and compared safely. No secrets or stack traces in client-visible errors.
- Structured logs for room lifecycle and errors, without player IPs in plain logs.

## Done when
- Tests: drop and rejoin mid-round keeps the score; rejoin with a wrong token is refused; host handover; each limit triggers correctly.
- A short written threat review in Handoff listing what was checked and what remains accepted risk.
- A second fresh session reviews this ticket before it is marked done.

## Out of scope
Accounts, anti-cheat beyond server authority, DDoS protection at the network level.

## Handoff

**Built**

- `packages/server/src/config.ts`: every limit in one `ServerConfig` (`maxRooms`, `maxConnectionsPerIp`, `maxMessageBytes`, `messagesPerSecond`/`messageBurst`, `idleLobbyMs`, `emptyRoomMs`, `heartbeatMs`, `trustProxy`), defaults plus env overrides via `configFromEnv` (used by `main.ts`). Env names are listed in `docs/DEPLOY.md`; `render.yaml` sets `TRUST_PROXY=1`.
- Reconnect (server): `Room.rejoin(token, member)` finds the seat by a constant-time compare (`timingSafeEqual`, every seat checked) and gives back slot, name and score (scores are by slot in `PartyState`, so nothing to restore). A socket still holding the seat is evicted (close `4000`). `Room.catchUp` replays the latest `roundResult`/`roundIntro`/`matchResult` in send order so the client gets totals and the current mini-game. `Match.syncSeats` (was `replaceLeavers`) adds a bot when a human drops and removes it when they return. A wrong token after the match has started is refused (`badPhase`); in the lobby an unknown token just joins as a newcomer, because the client always sends its last saved token.
- Host: `leave` hands host to a connected human; `rejoin` makes the returning player host if the host seat is not connected. Changes are logged (`hostChanged`).
- Empty rooms: the match no longer ends the moment nobody is connected (that would have made a solo player's 2-second wifi blip fatal). The room manager's empty timer (`emptyRoomMs`, 30 s) stops the match (`'empty'`) and removes the room, so that is the reconnect window when no human is left. While another human is still connected, the window is the rest of the match.
- Limits: `maxRooms` (createRoom gets `rateLimited` "The server is busy"), per-IP socket cap (closed with `1008` right after connect), `maxPayload` (ws closes with `1009`; the parser's 1024-char check still applies below it), token-bucket rate limit that answers a flood with about one error per refill, not one per message, and closes the socket (`1008`) after `messageBurst` dropped messages (second bucket refilling at 1/s). Idle LOBBY/PODIUM rooms with no member activity (inputs don't count) are closed on the heartbeat by `RoomManager.sweepIdle`; members get an error then close `4000`. Rooms with a running match are never swept.
- Heartbeat: ping every `heartbeatMs`; a socket that missed the last pong is terminated, which fires the normal close path (seat goes to a bot).
- Inputs: the connection drops input ticks that are not greater than the last accepted one (replays, reordering). The slot always comes from the connection.
- Errors: `Connection.receive` wraps handling in try/catch. A thrown error is logged server side (`connectionError`) and the client gets only "Something went wrong."
- Logs: `log.ts` writes one JSON line per event (`roomCreated`, `roomRefused`, `roomRemoved`, `playerJoined`, `playerRejoined`, `playerLeft`, `hostChanged`, `matchStart`, `matchEnd`, `botReplaced`, `humanRestored`, `floodClosed`, `connectionRefused`, `connectionClosed`, `connectionError`, `matchError`). IPs are only ever logged as `ipTag(ip)`, a sha256 with a random per-process salt, cut to 10 hex chars.
- Client: `Connection.closeCode` records the close code (`onerror` now waits for the close event that carries it). The new `reconnect.ts` `Reconnector` retries with backoff (0.5, 1, 2, 4, then 8 s, eight tries, about 40 s) and sends `joinRoom` with the token. It gives up on any server error while rejoining, on close `4000`, or after the last try. `Screens` shows "Reconnecting… A bot is playing for you" with a Leave button, then "Disconnected" with the server's reason if it gives up. `main.ts` hands the keys back to the menus when the socket drops.
- Docs: `PROTOCOL.md` gained a "Reconnecting" section (behaviour and close codes only; no message types or shapes changed).

**Verified**

- `npm test` (210 passing) and `npm run build`; `npm run lint` is clean.
- New `packages/server/src/hardening.test.ts`: drop mid-round 2 → a bot moves the seat → rejoin with token gets slot 1, name "B", catch-up `[roundResult, roundIntro]`, own input in control again, and round-2 and match totals equal the round-1 total plus the points earned. Also: wrong tokens (all zeros, one char off, too short, too long, empty) are refused; a stale token in the lobby joins as a newcomer; a second window takes the seat over and the first gets `4000`; host handover in both directions; `maxRooms`; idle sweep (and activity keeps a room open, running matches are not swept); per-second rate limit, refill and flood close; handler exception gives a plain error; `configFromEnv`. Against a real server: per-IP cap (and the IP is not in the logs), per-forwarded-IP with `trustProxy`, oversized frame → `1009`, a socket with `autoPong: false` is terminated by the heartbeat.
- `match.test.ts`: the flood test is now two tests. One checks that garbage, spoofed-slot, replayed and future-dated messages under the rate limit change nothing. The other checks that a real flood closes the socket, gives the seat to a bot and keeps the loop on time. The empty-room test now checks that bots play on until `emptyRoomMs`.
- New `packages/client/src/reconnect.test.ts`: backoff sequence, rejoin message sent after reconnect, reset after `joined`, give up after the last delay, give up on refusal, no retry after `4000` or after Leave.
- Not checked in a real browser. Worth a manual try: start a round, kill the server or turn wifi off, and watch the Reconnecting screen come and go.

**Threat review**

| Path | Checked | Result |
|---|---|---|
| Acting for another slot | Slot always comes from the `Connection`; no message carries a slot that is read (`slot` fields are dropped by the parser). Bots' seats ignore human input. | OK (tested) |
| Wrong phase | `setReady`, `setBotCount`, `startMatch`, `rematch` check phase and host in `Room`; `input` is ignored outside PLAYING; join/create while seated refused; join after start needs a valid token. | OK (tested) |
| Replayed / future input ticks | Ticks must strictly increase per socket. The server never uses the client tick for timing (inputs are stamped with the match's own tick, latest-wins), so a future tick gains nothing and only blocks that socket's own later inputs. | OK; accepted as harmless |
| Oversized names / messages | `sanitizeName` strips control and bidi characters and cuts to 12 code points; parser limit 1024 chars; ws `maxPayload` 4096 bytes. | OK (tested) |
| Rejoin token | 128 random bits (`randomBytes(16)`), `timingSafeEqual`, every seat compared; guessing is also bounded by the rate limit. Tokens are never broadcast (`joined` goes only to the owner). The token lives in `localStorage`, so anyone with access to that browser can take the seat. | OK; local-device access accepted |
| Seat takeover | Holding the token lets you move the seat from an open socket. That is what makes reconnect work before the heartbeat notices a dead socket. The evicted tab does not reconnect (`4000`), so two tabs can't keep taking it back and forth. | Accepted by design |
| Error leakage | All client errors are fixed strings. Exceptions are caught in `Connection.receive` and in the match tick (`matchError`) and logged server side only. The seed is never sent. | OK (tested) |
| Resource exhaustion | Rooms capped, sockets per IP capped, per-socket rate and size limits, dead sockets reaped, idle and empty rooms removed, latest-input buffer (a flood can't queue work). | OK within the limits; network-level DDoS out of scope |
| Logs | No IPs (salted hash only), no tokens, no names. Room codes and slots are logged. | OK |
| Client IP behind proxy | With `TRUST_PROXY=1` the last `X-Forwarded-For` hop is used. Unset, the socket address is used. | Remaining risk: if `TRUST_PROXY` is set where the server is reachable directly, the per-IP cap can be spoofed. With Cloudflare proxying turned on, the cap counts per CF edge. |

Also accepted risk: room codes are 4 letters (about 280 k), so anyone can guess their way into a **lobby**. The design calls for join-by-link and has no accounts. A mid-match seat still needs a token. Rate limits make scanning slow, but nothing stops a patient scanner spread over many IPs.

**For the next ticket**

- T22 (e2e smoke): close codes `4000`/`1008`/`1009` are in `PROTOCOL.md`. `createApp(dir, { config, log })` takes limits and a logger (pass `log: () => {}` to keep test output quiet). A reconnect e2e could kill one page's socket mid-round and wait for "Reconnecting…" to go away.
- `RoomManagerOptions.emptyTimeoutMs` and `AppOptions.emptyTimeoutMs` are gone; use `config: { emptyRoomMs }`. `MatchRoom` no longer needs `isEmpty`.
- Reviewed by a second fresh session (2026-11-14); see Review below.

**Review (second session)**

- Re-ran `npm test` (210 passing), `npm run build` and `npm run lint`: all clean.
- Read every server and client change. Checked: the input-tick check cannot block honest clients (`NetGame` is created once per page and `localTick` only goes up; a new socket starts again from -1). An evicted socket's later close does not free the seat (`evict` clears `room` first). `Match.end` clears `room.match`, so PODIUM rooms do get swept. The catch-up replay is reset on round 1 and on rematch. The client sends input every tick, so a seat handed back from the bot never keeps a stale input.
- No blocking issues. Still to check once deployed: that the last `X-Forwarded-For` hop on Render really is the player's IP. If Render's own edge puts its address there, every player shares one per-IP cap (8) and the game breaks with more than 8 sockets. To test, open 9 tabs from one network and confirm only the 9th is refused, and check that two networks get different `ip` tags in the logs. If it is wrong, unset `TRUST_PROXY` or raise `MAX_CONNECTIONS_PER_IP`. Worth adding to T22 or P01.

