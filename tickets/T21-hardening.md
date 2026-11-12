# T21 — Hardening

- **Assignee:** Opus
- **Depends on:** T09
- **Status:** todo

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
