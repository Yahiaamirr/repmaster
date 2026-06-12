# RISE — Hyrox team-timed wave format

Date: 2026-06-12
Status: Approved (model assumptions flagged) — implementing

## Problem
Hyrox is run as a team race, not individual Men/Women. Teams (single-gender, built
in RiseTeams) each get one timer; they run in waves of 2 (female teams first); the
leaderboard ranks teams by finish time in one combined list.

## Model (decisions + interpretation)
- An event can be **team-timed**: `config.team_timed = true`, `config.time_cap_sec`
  (default 900 = 15:00), `config.wave_size` (default 2). Hyrox uses time_fastest.
- Scoreable unit = a **team entry** (`rise_entries` with `team_id`, no competitor),
  using the existing timer fields (`timer_started_at`, `timer_running`, `time_ms`).
- **Cap**: a running team timer auto-stops at `time_cap_sec`.
- **Waves**: teams ordered female-first (by team gender, then display_order), grouped
  into waves of `wave_size`. Operator starts a wave → both teams' timers start;
  multiple waves run concurrently. Per-team Finish stops the timer and records the time.
  (The "every 4 min" cadence is operator guidance, not auto-enforced.)
- **Board**: one combined list of teams ranked by `time_ms` ascending (finishers
  first; running/not-started teams below). Live timers tick on the board.

## Shared helper
`isTeamScored(event) = event.is_team || !!event.config.team_timed` — used by the
control room, leaderboard, and manual editor/board to switch into team mode.

## Phases (shipped together)
1. **types** — extend `RiseEventConfig`; add `isTeamScored`. Add a team's gender helper.
2. **enable** — edit-page toggle "Team-timed (waves)" + cap minutes, written to config.
3. **wave control** — new `RiseWaveControl` for team-timed events: girls-first waves of
   2, start wave, per-team live timer + Finish, 15:00 auto-cap, concurrent waves.
4. **live board** — team-timed branch in `RiseLeaderboard`: combined team list by time
   with live timers.
5. **manual** — `RiseManualEditor` / `RiseManualBoard` / editor page use `isTeamScored`
   so Hyrox's manual board is team-based.

## Notes / limits
- Team gender = majority of members (teams are single-gender via the assigner).
- No migration needed — uses existing `rise_entries` + `config` jsonb.
- Enable team-timed on Hyrox via the new settings toggle.
