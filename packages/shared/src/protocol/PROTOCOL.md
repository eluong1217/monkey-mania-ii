# Network protocol (version 1)

JSON text frames over WebSocket. Every message is an object with a string `type`. Parse with `parseClientMessage` / `parseServerMessage` (they never throw; they return `{ok:true, message}` or `{ok:false, error:{code, message}}`). Client messages are limited to 1024 characters, server messages to 64 K. Types live in `messages.ts`; constants in `constants.ts`.

Slots are seats `0..3`. Room codes are 4 letters from `ABCDEFGHJKMNPQRSTUVWXYZ`. Names are sanitised on parse (control characters removed, whitespace collapsed, max 12 characters).

## Client → server

| type          | fields                                 | sent when                                                                             |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `createRoom`  | `v`, `name`                            | Player clicks Create. Server replies `joined` then `roomState`.                       |
| `joinRoom`    | `v`, `code`, `name`, `rejoinToken?`    | Player opens an invite link or reconnects (send the saved token to reclaim the seat). |
| `setReady`    | `ready`                                | Player toggles ready in the lobby.                                                    |
| `startMatch`  | —                                      | Host only, in the lobby. Empty seats are filled by bots.                              |
| `setBotCount` | `count` (0–3)                          | Host only, lobby. How many seats bots fill.                                           |
| `input`       | `tick`, `input {moveX, moveY, action}` | Every client tick while PLAYING. Values are re-sanitised by the server.               |
| `rematch`     | —                                      | On the podium screen, to return the room to the lobby.                                |
| `leave`       | —                                      | Player leaves the room.                                                               |

## Server → client

| type          | fields                                                                      | sent when                                                                                                                               |
| ------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `roomState`   | `code`, `seats` (4 entries, `null` = empty), `host`, `phase`                | Any room change (join, leave, ready, phase change).                                                                                     |
| `joined`      | `v`, `slot`, `rejoinToken`                                                  | Reply to a successful create/join. Save the token for reconnecting.                                                                     |
| `roundIntro`  | `round`, `totalRounds`, `miniGameId`, `displayName`, `controlsHint`, `view` | Start of INTRO phase.                                                                                                                   |
| `snapshot`    | `tick`, `miniGameId`, `state` (a `BaseSnapshot`)                            | 20 Hz during PLAYING.                                                                                                                   |
| `roundResult` | `round`, `placements`, `scores [{slot, points, total}]`                     | Start of RESULTS phase.                                                                                                                 |
| `matchResult` | `placements`, `totals`                                                      | Start of PODIUM phase.                                                                                                                  |
| `error`       | `code`, `message`                                                           | A request was rejected. Codes: `badJson tooLarge badMessage unknownType badVersion roomNotFound roomFull notHost badPhase rateLimited`. |

## Room phases

`LOBBY → INTRO → PLAYING → RESULTS → (INTRO …) → PODIUM → LOBBY` (via `rematch`).

## Reconnecting

A player who drops after the match starts keeps their seat: a bot plays it and their score is kept by slot. Sending `joinRoom` with the saved `rejoinToken` restores the seat (same slot, name and score) as long as the room exists; the reply is `joined` (same token), `roomState`, then the latest `roundResult`/`roundIntro`/`matchResult` so the client can catch up. A token that matches no seat is refused with `badPhase` once the match has started; in the lobby it is ignored and the player joins as a newcomer. Rejoining while an old socket still holds the seat moves the seat to the new socket.

The server closes sockets with code `4000` when it drops a member on purpose (seat taken by another window, idle room closed; an `error` explains why first): clients must not reconnect after it. `1008` means a limit was hit (flooding, too many sockets from one address); `1009` a frame was too large. The server pings every 15 s and drops sockets that do not answer.
