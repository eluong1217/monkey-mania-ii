# P01 — Playtest and tuning notes

- **Assignee:** You (with friends)
- **Depends on:** T09, T10, T11, T12, T13
- **Status:** todo

## Goal
Find out which mini-games are fun before spending effort on art.

## Do this
1. Play at least five full matches: some solo with three bots, some with 2–4 humans.
2. After each match, jot one line per mini-game under Notes.
3. Run `npm run balance -- --game all` (from T14) and paste the table below.

## Questions to answer
- Which mini-game did people ask to play again? Which did they groan at?
- Is any round too long or too short?
- Are bots too easy, too hard, or obviously robotic?
- Is there a dominant strategy that makes a mini-game boring?
- Did anyone not understand the action button within the first round?
- Does the double-points final round feel like a fair comeback or a coin flip?

## Then
Turn each concrete change into a small ticket (`T25+`, Sonnet): one mini-game per ticket, tuning-object changes first, rule changes only when numbers cannot fix it. Cut a mini-game that is not fun rather than polishing it.

## Notes
