# RISE — Judge identity, judging log & per-event attendance

Date: 2026-06-12
Status: Approved — implementing in phases

## Problem
Admins can't see which judge is scoring or which athletes a judge judged. Judges
already type their name on sign-in, but it is stored only in `localStorage`. There
is also no way to mark which registered athletes actually showed up to each event.

## Decisions (from brainstorming)
- Judge **self-registers** their name on the judge link (UI already exists) — persist to DB.
- "Athletes they judged" is **logged** precisely (per judge ↔ athlete pairing).
- Attendance is **per-event** (each `rise_competitors` row is already per-event).
- Attendance is marked **in the live control room**.
- Judging log is written **on athlete selection** (one write when a judge starts on an
  athlete), not per scoring action — fewer writes, leaves shared scoring RPCs untouched.

## Data model (`supabase/migrations/005_rise_judge_attendance.sql`)
- `rise_judge_tokens` += `judge_name text`, `last_seen_at timestamptz`.
- `rise_competitors` += `checked_in boolean default false`, `checked_in_at timestamptz`.
- New `rise_judge_log`: `token_id`, `event_id`, `competitor_id?`, `team_id?`,
  `judge_name` (snapshot), `score_count`, `first_at`, `last_at`. One row per
  `(token_id, competitor_id)` / `(token_id, team_id)` via partial unique indexes.
- RPCs (security definer, granted to anon — judges use the anon key):
  - `rise_register_judge(token, name)` — sets `judge_name`/`last_seen_at` on the token.
  - `rise_log_judge(token, entry_id)` — upserts a judging-log row for the entry's athlete/team.
- RLS: public read on `rise_judge_log`; writes only via the RPCs. Realtime on
  `rise_judge_log` and `rise_competitors` for live admin views.

## Phases
1. **DB migration** — columns, table, indexes, RLS, RPCs, realtime. (Run in SQL Editor.)
2. **Name persistence** — call `rise_register_judge` from `RiseJudge` sign-in; types.
3. **Judging log** — thread `token` into judge clients; call `rise_log_judge` on selection.
4. **Admin judge report** — read-only panel on `/admin/rise/[eventSlug]` listing each
   judge and the athletes they judged.
5. **Attendance** — present/absent toggles in the control room (`RiseControlPanel`).

## Notes / limits
- One link = one judge (device lock already enforces a single active device). If a judge
  takes over a link, `judge_name` is overwritten — acceptable for this event model.
- Public board/leaderboard unchanged; attendance is admin-only unless later requested.
