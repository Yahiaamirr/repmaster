# RISE — Manual leaderboard + random same-gender team assignment

Date: 2026-06-12
Status: Approved — implementing in phases

## Feature A — Manual leaderboard (per event)

### Problem
The public board is driven entirely by live `rise_entries` + auto-ranking. Admins
need to post hand-curated standings (final/official results, or events not scored
live), controlling both the value shown and the placement order.

### Decisions (from brainstorming)
- Manual mode controls **both value and order**.
- When a manual leaderboard exists/is published, it **replaces** the live board for
  that event. A "clear / revert to live" action is the escape hatch.

### Data model — `supabase/migrations/006_rise_manual_leaderboard.sql`
- `rise_events` += `manual_leaderboard boolean default false` — when true the public
  board renders manual standings.
- New `rise_manual_results`: `event_id`, `competitor_id?` (individual) / `team_id?`
  (team), `value_text` (displayed result), `manual_rank int` (order), `included bool`.
  Unique per `(event_id, competitor_id)` / `(event_id, team_id)`. Public read,
  authenticated write, realtime.

### Editor — `/admin/rise/[eventSlug]/leaderboard`
Reached by a button on the settings (edit) page and the event page. Adapts per event:
- Individual events → Men / Women lists seeded from the roster.
- Team event → list of teams.
Each row: include toggle, value field, up/down reorder. Plus:
- **Prefill from live results** — fills values + order from current scoring.
- **Save & publish** — writes rows, sets `manual_leaderboard = true`.
- **Clear / revert to live** — deletes rows, sets flag false.

### Public board
`/rise/[eventSlug]` checks `manual_leaderboard`: if on, render manual standings
reusing the existing themed layout (per-event themes, Men/Women split, team rows),
no timers/auto-rank; if off, the live board exactly as today. Realtime on
`rise_manual_results` + `rise_events` so edits show instantly.

## Feature B — Random same-gender team assignment (after A)
In `RiseTeams` (team events), add **"Randomly assign unassigned"**: distribute
athletes with `team_id IS NULL` across teams at random, keeping each team
single-gender (males with males, females with females). Exact fill rule (which teams
become male vs female; whether to balance toward equal sizes / a target size) to be
confirmed before building.

## Phases
A1 migration · A2 types · A3 editor page + links · A4 public board · B5 random assign

## Notes / limits
- `value_text` is free-form display text (units differ per event); admin controls order
  explicitly so ties are fine.
- Roster source is the event's existing competitors/teams (no free-form names).
