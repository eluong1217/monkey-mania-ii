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
