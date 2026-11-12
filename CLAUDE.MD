# Monkey Mania II

A 4-player online party game for the browser. `docs/DESIGN.md` is the design contract; `tickets/README.md` is the work queue.

## When asked to do a ticket (for example "ticket 1", "T01", "do T12")

1. Read `docs/DESIGN.md` and the matching file in `tickets/` (T01 is `tickets/T01-*.md`).
2. Check the ticket's "Depends on" line against the statuses in `tickets/README.md`. If a dependency is not done, stop and say so.
3. Implement only that ticket. Do not change files outside its scope, and do not alter contracts in `packages/shared` unless the ticket says so.
4. Run `npm test` and `npm run build` and fix what fails.
5. Set the ticket's `Status: review`, update its row in `tickets/README.md`, and fill in its `## Handoff` section: what was built, how it was verified, and anything the next ticket should know.
6. Finish by listing each "Done when" item and whether it is met. Do not commit unless asked.

If the ticket names a different model from the one running, mention it once and carry on.

## Conventions

- Favour the simplest implementation that satisfies the ticket.
- One commit per ticket, message like `T07: client netcode and rendering`.
- `reference/` is the original 2018 Processing game; read-only.