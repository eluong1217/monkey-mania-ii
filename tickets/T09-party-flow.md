# T09 — Party flow

- **Assignee:** Sonnet
- **Depends on:** T07
- **Status:** done

## Goal
A complete match: five rounds, points, podium, rematch.

## Scope
- `shared`: a small party state machine (`LOBBY → INTRO → PLAYING → RESULTS → … → PODIUM`), mini-game picker (random, no repeats until the pool is used up, seeded), party-point scoring per `docs/DESIGN.md` including ties and the double final round.
- `server`: drive the state machine from the match loop; timers for intro (3 s) and results (4 s); `rematch` returns the same players to a fresh match; anyone leaving mid-match is replaced by a bot.
- `client`: intro card (mini-game name, controls hint, countdown), results card (round placements, running totals), podium screen with Rematch and Leave, and a compact always-visible scoreboard during play.
- The `sandbox` mini-game is excluded from the pool unless no other mini-game is registered.

## Done when
- Milestone M2: one human plus three bots can play a full five-round match and a rematch without reloading.
- Tests for scoring (ties, double final), the picker, and every state transition.
- A bot-only match runs headlessly to `PODIUM` in a test.

## Out of scope
Final visuals (T18), reconnection (T21).

## Handoff

**Built:**
- `shared/src/party.ts` (exported from `shared`): scoring (`roundPoints`, `scoreRound`, `standings`; 3/2/1/0, ties share the higher value and skip the next place, last round doubled), picker (`pickMiniGames`: seeded bag shuffle, no repeats until the pool is used, no repeat across the reshuffle; `partyPool` drops `sandbox` unless it is the only game), `roundSeed` (round 1 uses the match seed), and a pure state machine (`createParty`, `startParty`, `introDone`, `roundOver`, `resultsDone`, `rematchParty`) that throws on any out-of-order transition. `INTRO_SECONDS`, `RESULTS_SECONDS`, `MATCH_ROUNDS` live here; `MATCH_TIMING` reads them.
- `server/src/match.ts`: `Match` now plays a whole party off `PartyState`: INTRO → PLAYING → RESULTS per round, then PODIUM with `matchResult` (placements = standings by total, `points` is 0 there). Fresh mini-game state and bots every round. A human who disconnects is replaced by a bot on the next tick (`botReplaced` log). `startMatch(room)` with no id plays 5 rounds from the registry; `startMatch(room, id)` plays one round of that game (used by tests). `roundScores` placeholder removed. `app.ts` calls `startMatch(room)`.
- Rematch: unchanged `Room.rematch` (PODIUM → LOBBY, bots removed, ready cleared). Players ready up and the host presses Start again.
- Client: `NetGame` tracks `seats`, `totals`, `introCountdown()`. `PlayScene` draws the intro card (round x of y, name, hint, 3-2-1, "final round: double points") and a compact scoreboard along the bottom edge during INTRO/PLAYING/RESULTS. `Screens` shows a results card in RESULTS and a podium (winner, standings, Rematch, Leave) in PODIUM; it copes with a missing `matchResult` ("The match ended early.").

**Verified:** `npm test` (143 pass), `npm run build`, `npm run lint`.
- `party.test.ts`: all scoring cases incl. ties and double final, picker (seeded, no repeats, reshuffle boundary, pool of one, sandbox exclusion), every legal transition and every illegal one.
- `match.test.ts`: a bot-only 5-round match runs headlessly to PODIUM (5 intros, 5 results, totals add up, last round doubled, `matchResult` matches); same seed replays byte-identically; pool picks without repeats; a human leaving mid-round is replaced by a bot that moves their seat; rematch returns to the lobby and a second match completes. Existing single-round tests now expect doubled points.
- `net-game.test.ts`: totals persist across rounds and reset on a new match; intro countdown.
- Not done: a manual browser run of one human + three bots through five rounds and a rematch. Only `sandbox` is registered, so every round is sandbox (10 s) until T10–T13 land. Worth one hands-on pass.

**For the next tickets:**
- T10–T13: add the game to `miniGames`; the picker and party pick it up with no other change. `snapshot.tick` restarts from 0 each round and the client resets on `roundIntro`.
- T18: the scoreboard is plain `text()` at y=350 and may overlap game art at the bottom; results/podium are plain DOM.
- T17: the RESULTS screen has no countdown; the server sends no timestamps.
- T21: a leaver keeps the seat (`connected: false`) and is bot-driven; rejoin should flip it back to human control (`Match.input` ignores a slot while a bot is assigned, so it needs a hook to drop that bot).

