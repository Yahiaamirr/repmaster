# Create New RISE Event — Design

**Date:** 2026-06-11
**Status:** Approved (pending spec review)
**Area:** RISE Opening Event subsystem (`rise_*` tables)

## Problem

RISE events can currently only be created by hand-editing and running SQL seed
files (`002_rise.sql`, `003_rise_seed.sql`, `004_rise_participants.sql`). The
`/admin/rise` page only lists existing events. Admins need a UI to create a new
event, either by **copying the settings of an existing event** or by
**configuring a new one from scratch**.

## Scope

In scope:
- A "New Event" entry point on `/admin/rise`.
- A creation form at `/admin/rise/new` with a "Start from: Blank / Copy from
  existing" toggle.
- A server route that atomically inserts the `rise_events` row plus its
  `rise_rounds`.

Out of scope:
- Editing a created event's core config after creation (no such UI exists today).
- Copying team rosters / competitors / live entries (new events start with an
  empty roster, per decision below).
- A bespoke editor for mode-specific `config` fields on the Blank path (those
  are reproduced only via Copy).

## Decisions

- **Copy scope:** copying carries scoring config (`scoring_mode`, `unit`,
  `config`) **and** rounds. It does **not** carry teams, competitors, entries,
  or judge tokens — the new event starts with an empty roster.
- **Team events:** copying a team event reproduces settings + rounds but no
  teams/members. Seeding members remains a manual/seed-time task as today.
- **Blank `config`:** defaults to `{}`. The mode-specific config (e.g.
  `chipper`, `amrap_weight`, `qual_duration`) is only populated via Copy.
- **Approach:** combined form page + server route (chosen over duplicate-only
  action and over pure client-side insert), for consistency with
  `/admin/tournaments/new` and atomic multi-table insert like
  `/api/rise/register`.

## Architecture

### 1. Entry point
- `app/admin/rise/page.tsx`: add a **New Event** button in the page header
  (RISE blue `#2f5fe0` primary style) linking to `/admin/rise/new`. Add the same
  action to the empty-state card.

### 2. Creation form — `app/admin/rise/new/page.tsx` (client component)
Mirrors the structure and styling of `app/admin/tournaments/new/page.tsx`, using
RISE blue (`#2f5fe0`) instead of orange (`#e8440a`).

**"Start from" toggle (top of form):**
- **Blank** — empty form with sensible defaults.
- **Copy from existing** — dropdown of existing events (fetched on mount via the
  Supabase browser client; public read per RLS). Selecting an event fetches its
  full settings + rounds and prefills all fields below. Name is left for the
  user to change and must differ from the source.

**Fields:**

| Field | Control | Notes |
|---|---|---|
| Name | text input | required |
| Type | toggle | Individual / Team → `is_team` |
| Scoring mode | select | `reps` / `time_fastest` / `time_longest` / `measure_max` |
| Unit | text input | auto-suggested from mode (`reps`/`sec`/`cm`), editable |
| Rounds | repeatable list | each row: name + optional duration (sec). Add/remove. Blank default: a single "Qualification" round |

`config` is held in form state: `{}` on Blank, or the source event's `config`
verbatim on Copy.

### 3. Write path — `app/api/rise/events/route.ts` (POST)
- Requires an authenticated session (server Supabase client).
- Request body: `{ name, is_team, scoring_mode, unit, config, rounds: [{ name, duration_sec }] }`.
- Validates: name length 2–80; `scoring_mode` is one of the four valid modes;
  `rounds` is an array.
- Generates `slug = slugify(name) + '-' + base36(now)`; on unique-constraint
  collision, retries with a fresh suffix (bounded retries).
- Computes `display_order = max(existing display_order) + 1`.
- Inserts the `rise_events` row, then inserts `rise_rounds` rows referencing the
  new event id (status `pending`, ordered).
- Creates no teams/competitors/entries/tokens.
- Returns `{ slug }` on success; `{ error }` with appropriate status on failure.

### 4. Data flow
```
/admin/rise  ──New Event──▶  /admin/rise/new (form)
        (optional) select source event ──▶ browser client reads source settings + rounds ──▶ prefill
   submit ──▶ POST /api/rise/events { name, is_team, scoring_mode, unit, config, rounds[] }
          ──▶ insert rise_events + rise_rounds (atomic-ish, server) ──▶ { slug }
   client ──▶ router.push(`/admin/rise/<slug>`)  (existing setup page)
```

### 5. Error handling
- Client-side inline validation before submit: empty/short name, missing scoring
  mode.
- API errors (slug retries exhausted, insert error) surface as a red inline
  banner matching the tournaments form style.
- Team events are created with an empty team list; the setup page already notes
  RISE teams are fixed — acceptable for v1.

## Testing / Verification

Run the app and from `/admin/rise`:
1. **Blank path:** create a `measure_max` event → redirected to its setup page;
   it appears in the list with the correct mode label and an empty roster.
2. **Copy path:** copy "Evolve Deadlift Ladder" → new event has the same scoring
   mode, unit, and `config`, a distinct slug, and no athletes.
3. **Rounds:** confirm the new event's rounds were created (visible in
   setup/control).
4. **Validation:** submitting an empty name shows an inline error and does not
   create anything.

## Files touched

- `app/admin/rise/page.tsx` — add New Event button (header + empty state).
- `app/admin/rise/new/page.tsx` — new form page (client).
- `app/api/rise/events/route.ts` — new POST route.
- (Possibly) a small slug helper if one isn't already shared.
