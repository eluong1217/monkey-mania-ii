# T06 — Client shell and lobby screens

- **Assignee:** Sonnet
- **Depends on:** T03
- **Status:** todo

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
