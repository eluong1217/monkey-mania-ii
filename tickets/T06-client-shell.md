# T06 — Client shell and lobby screens

- **Assignee:** Sonnet
- **Depends on:** T03
- **Status:** done

## Goal
A player can open the site, create or join a room, and see the lobby. Functional and plain; polish comes in T18.

## Scope (`packages/client`)
- Screens: Home (name field, Create Room, Join with code), Lobby (four seats, ready toggle, host-only Start, copy-invite-link button), a simple error/disconnected state.
- Invite link format `/?room=ABCD`; opening it pre-fills the code and goes straight to name entry.
- A small connection module that wraps the WebSocket, uses the T03 parsers, and exposes typed events. Remember name and rejoin token in `localStorage` inside try/catch.
- Menus are fully keyboard-operable with visible focus.

## Done when
- With the T04 server running, two browser tabs can create/join the same room and see each other's ready state update live.
- A bad or full room code shows a readable message.
- A component-level test covers the connection module against a mock socket.

## Out of scope
Gameplay rendering, final art, touch layout.

## Handoff

**Built** (`packages/client/src/`): `connection.ts` (`Connection`: wraps a `SocketLike`, parses with `parseServerMessage`, typed `on(type, fn)` events plus `status` and `badMessage`; `connect()` resolves true/false; `loadSaved`/`save` for name and rejoin token in try/catch localStorage), `screens.ts` (`Screens`: plain DOM Home, Lobby, Disconnected rendered into `#ui`, an overlay above the Phaser canvas), `connection.test.ts` (mock socket), plus overlay styles in `index.html` and a one-line mount in `main.ts`. `/?room=ABCD` prefills the code and focuses Join; the URL is set to the invite link once in a room.

**Verified:** `npm test` (89 pass, incl. 5 new connection tests), `npm run build`, `npm run lint`. Two-tab create/join flow checked by hand by the user before marking done.

**Notes for next tickets:**
- UI is DOM, not Phaser; T07/T09 should hide or replace `#ui` content when phase leaves LOBBY (the lobby currently shows a "match in progress" line). `Screens` owns the `Connection`; T07 will need to share it (expose it or move ownership).
- `setBotCount` is not used: Start always fills empty seats with bots (T04 behaviour).
- The saved `rejoinToken` is sent on every join; the server ignores it until T21.
- Server errors (`roomNotFound`, `roomFull`, `badPhase`) show their server message text in an `role="alert"` line.
