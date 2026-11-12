# T18 — HUD and UI polish

- **Assignee:** Sonnet
- **Depends on:** T09, T15
- **Status:** todo

## Goal
Menus and HUD look like a finished early-2000s console party game and stay readable mid-action.

## Scope (`packages/client`)
- A bold, rounded early-2000s console menu font (openly licensed; record the licence in `assets/README.md`) across all screens. It must stay legible at the 640×360 logical resolution.
- Restyle Home, Lobby, intro card, results card, podium and settings using the UI art from A03/A04.
- In-round HUD: timer, per-player score or alive/out status, cooldown indicator for your action, and a clear "this is you" marker on your monkey.
- Scoreboard between rounds animates point gains.
- Screen transitions are short fades or wipes.
- Text contrast meets WCAG AA; nothing is communicated by colour alone; all menus keyboard-navigable with visible focus.

## Done when
- Screenshots of every screen are attached in Handoff.
- A new player can tell which monkey is theirs and what the action button does within the 3 s intro, checked with one person who has not seen the game.
- No text is smaller than 8 logical pixels tall.

## Out of scope
Touch layout (T19), gameplay changes.

## Handoff
