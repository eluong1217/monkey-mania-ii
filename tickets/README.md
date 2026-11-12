# Ticket Queue — Monkey Mania II: Monkey Party

Read `docs/DESIGN.md` first. Each ticket is one file, sized for one model session.

## Who does what

| Assignee | Used for |
|---|---|
| **Opus** | Contracts everything else depends on: sim core, match loop, client netcode, hardening. |
| **Sonnet** | Feature work against an existing contract: mini-games, screens, bots, deploy. |
| **Haiku** | Small, well-specified chores: CI, harness scripts, README. |
| **Gemini (you run it)** | Art generation in Google AI Pro, from the prompts in the A-tickets. |
| **You** | Playtesting, picking art, hosting account. |

## How to hand a ticket to a model

`CLAUDE.md` at the repo root holds the standing instructions, so in a fresh Claude Code session you can type just `ticket 1` or `T01`. The full prompt, for tools that do not read `CLAUDE.md`:

> Read `docs/DESIGN.md` and `tickets/<ticket file>`. Implement only that ticket. Do not change files outside its scope or alter contracts in `packages/shared` unless the ticket says so. Run `npm test` and `npm run build`. When finished, set `Status: review` and fill in the `## Handoff` section with what you built, how you verified it, and anything the next ticket should know.

Then: one commit per ticket, message `T07: client netcode and rendering`. Opus tickets get reviewed by a second fresh session before being marked `done`.

Status values: `todo` → `in-progress` → `review` → `done`.

## Queue

Work top to bottom. Tickets in the same wave have no dependency on each other and can run in parallel.

### Phase 0 — Foundation

| Wave | Ticket | Assignee | Depends on | Status |
|---|---|---|---|---|
| 1 | [T01 Repo scaffold](T01-repo-scaffold.md) | Sonnet | — | done |
| 2 | [T02 Simulation core](T02-sim-core.md) | Opus | T01 | done |
| 3 | [T03 Network protocol](T03-protocol.md) | Sonnet | T02 | done |
| 3 | [T08 Bot framework](T08-bot-framework.md) | Sonnet | T02 | todo |
| 4 | [T04 Rooms and lobby server](T04-rooms-lobby.md) | Sonnet | T03 | done |
| 4 | [T06 Client shell and lobby screens](T06-client-shell.md) | Sonnet | T03 | todo |
| 5 | [T05 Authoritative match loop](T05-match-loop.md) | Opus | T04, T08 | todo |
| 6 | [T07 Client netcode and rendering](T07-client-netcode.md) | Opus | T05, T06 | todo |

**Milestone M1:** four seats (any mix of browsers and bots) join a room by link and move around a sandbox arena.

### Phase 1 — The party

| Wave | Ticket | Assignee | Depends on | Status |
|---|---|---|---|---|
| 3+ | [T10 Mini-game: Fruit Frenzy](T10-fruit-frenzy.md) | Sonnet | T02, T08 | todo |
| 3+ | [T11 Mini-game: Coconut Dodge](T11-coconut-dodge.md) | Sonnet | T02, T08 | todo |
| 3+ | [T12 Mini-game: Banana Heist](T12-banana-heist.md) | Sonnet | T02, T08 | todo |
| 3+ | [T13 Mini-game: King of the Stump](T13-king-of-the-stump.md) | Sonnet | T02, T08 | todo |
| 7 | [T09 Party flow](T09-party-flow.md) | Sonnet | T07 | todo |
| 7 | [T14 Balance harness](T14-balance-harness.md) | Haiku | T10–T13 | todo |
| 8 | [P01 Playtest and tuning notes](P01-playtest.md) | You | T09, T10–T13 | todo |

**Milestone M2:** a full 5-round match is playable end to end with placeholder shapes.

### Phase 2 — Art, audio, feel

| Wave | Ticket | Assignee | Depends on | Status |
|---|---|---|---|---|
| any | [A01 Style sheet](A01-style-sheet.md) | Gemini + you | — | todo |
| any | [A02 Monkey sprites](A02-monkey-sprites.md) | Gemini + you | A01 | todo |
| any | [A03 Fruit, props, UI icons](A03-props-icons.md) | Gemini + you | A01 | todo |
| any | [A04 Backgrounds and title art](A04-backgrounds.md) | Gemini + you | A01 | todo |
| any | [A05 Sound effects and music](A05-audio.md) | You | — | todo |
| 7 | [T15 Asset manifest and loader](T15-asset-loader.md) | Sonnet | T07 | todo |
| 9 | [T16 Integrate final art](T16-integrate-art.md) | Sonnet | T15, A02–A04 | todo |
| 9 | [T17 Juice and audio](T17-juice-audio.md) | Sonnet | T15, A05, T09 | todo |
| 9 | [T18 HUD and UI polish](T18-ui-polish.md) | Sonnet | T09, T15 | todo |

**Milestone M3:** the game looks and sounds finished.

### Phase 3 — Ship

| Wave | Ticket | Assignee | Depends on | Status |
|---|---|---|---|---|
| 8 | [T20 Deploy](T20-deploy.md) | Sonnet | T09 | todo |
| 8 | [T23 CI](T23-ci.md) | Haiku | T01 | todo |
| 9 | [T19 Touch controls and scaling](T19-touch-responsive.md) | Sonnet | T09 | todo |
| 9 | [T21 Hardening](T21-hardening.md) | Opus | T09 | todo |
| 10 | [T22 End-to-end smoke test](T22-e2e-smoke.md) | Sonnet | T20, T21 | todo |
| 10 | [T24 README and portfolio blurb](T24-readme.md) | Haiku | T20 | todo |

**Milestone M4:** public link, friends can join from phones or laptops.

## Adding a mini-game later

Copy `T10-fruit-frenzy.md`, change the rules section, assign to Sonnet. Nothing else in the queue needs to change; that is the point of the plug-in contract in T02.