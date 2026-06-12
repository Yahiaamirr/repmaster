// Types for the RISE Opening Event section (separate from the powerlifting schema)

export type RiseScoringMode = 'reps' | 'time_fastest' | 'time_longest' | 'measure_max'
export type RiseGender = 'M' | 'F'
export type RiseMovement = 'mu' | 'pu' | 'dips'
export type RiseStatus = 'setup' | 'live' | 'ended'
export type RiseRoundStatus = 'pending' | 'active' | 'done'
export type RiseEntryStatus = 'pending' | 'active' | 'done'

export interface RiseEventConfig {
  qual_duration?: number
  final_duration?: number
  chipper?: { mu: number; pu: number; dips: number; mu_kg?: number; pu_kg?: number; dips_kg?: number }
  amrap_weight?: number
  qualifiers?: number
  top_bar?: number
  // Team-timed (wave) mode — e.g. Hyrox: one timer per team, waves of N, time cap.
  team_timed?: boolean
  time_cap_sec?: number
  wave_size?: number
  auto_dnf?: boolean // auto-DNF a team that passes the cap (default on)
  show_women_on_leaderboard?: boolean
  movement_scored?: boolean // team scored by 3 per-movement judges (mu/pu/dips), total = sum
  [key: string]: unknown
}

export interface RiseEvent {
  id: string
  name: string
  slug: string
  scoring_mode: RiseScoringMode
  is_team: boolean
  unit: string
  config: RiseEventConfig
  status: RiseStatus
  display_order: number
  created_at: string
  manual_leaderboard?: boolean
}

// A hand-curated leaderboard row. When event.manual_leaderboard is true the
// public board renders these (value_text + manual_rank) instead of live entries.
export interface RiseManualResult {
  id: string
  event_id: string
  competitor_id: string | null
  team_id: string | null
  value_text: string | null
  manual_rank: number
  included: boolean
  created_at: string
  // joined
  competitor?: { name: string; gender: RiseGender } | null
  team?: { name: string } | null
}

export interface RiseTeam {
  id: string
  event_id: string
  name: string
  display_order: number
}

// True when an event is ranked by team rather than by individual athlete:
// the fixed-team events (is_team) or an individual event flagged team-timed (Hyrox).
export function isTeamScored(event: { is_team: boolean; config?: RiseEventConfig }): boolean {
  return event.is_team || !!event.config?.team_timed
}

// A team's gender = the majority of its members (teams are single-gender in practice).
export function teamGenderOf(competitors: { team_id: string | null; gender: RiseGender }[], teamId: string): RiseGender | null {
  const members = competitors.filter(c => c.team_id === teamId)
  if (members.length === 0) return null
  const m = members.filter(c => c.gender === 'M').length
  return m >= members.length - m ? 'M' : 'F'
}

export const RISE_TIME_CAP_DEFAULT = 900 // 15:00
export const RISE_WAVE_SIZE_DEFAULT = 2

export interface RiseCompetitor {
  id: string
  event_id: string
  team_id: string | null
  name: string
  gender: RiseGender
  display_order: number
  meta: Record<string, unknown>
  checked_in?: boolean
  checked_in_at?: string | null
}

export interface RiseRound {
  id: string
  event_id: string
  name: string
  display_order: number
  duration_sec: number | null
  status: RiseRoundStatus
  config: Record<string, unknown>
}

export interface RiseEntry {
  id: string
  event_id: string
  round_id: string | null
  competitor_id: string | null
  team_id: string | null
  counter: number
  time_ms: number | null
  timer_started_at: string | null
  timer_running: boolean
  measure_value: number | null
  phase: string | null
  status: RiseEntryStatus
  meta: Record<string, unknown>
  updated_at: string
  // joined
  competitor?: RiseCompetitor | null
  team?: RiseTeam | null
}

export interface RiseJudgeToken {
  id: string
  event_id: string
  token: string
  label: string | null
  scope: { team_id?: string; competitor_id?: string; round_id?: string; movement?: RiseMovement }
  created_at: string
  judge_name?: string | null
  last_seen_at?: string | null
}

// A judge ↔ athlete/team pairing recorded when a judge scores.
export interface RiseJudgeLog {
  id: string
  token_id: string
  event_id: string
  competitor_id: string | null
  team_id: string | null
  judge_name: string | null
  score_count: number
  first_at: string
  last_at: string
  // joined
  competitor?: { name: string; gender: RiseGender } | null
  team?: { name: string } | null
}

// ── Movement judging (RISE Battle Cycles) ────────────────────
// A team is scored by three judges — muscle-ups, pull-ups, dips — whose counts
// live in entry.meta.reps and sum into counter.
export const RISE_MOVEMENTS: RiseMovement[] = ['mu', 'pu', 'dips']
export const MOVEMENT_LABEL: Record<RiseMovement, string> = { mu: 'Muscle-ups', pu: 'Pull-ups', dips: 'Dips' }
export const MOVEMENT_SHORT: Record<RiseMovement, string> = { mu: 'MU', pu: 'PU', dips: 'Dips' }

export function movementReps(entry: Pick<RiseEntry, 'meta'>): Record<RiseMovement, number> {
  const reps = (entry.meta?.reps ?? {}) as Partial<Record<RiseMovement, number>>
  return { mu: reps.mu ?? 0, pu: reps.pu ?? 0, dips: reps.dips ?? 0 }
}

// kg load for a movement from the event's chipper config (undefined if unset).
export function movementLoad(config: RiseEventConfig, m: RiseMovement): number | undefined {
  return config.chipper?.[`${m}_kg`]
}

// ── Helpers shared across leaderboard + control ──────────────

export function formatMs(ms: number | null): string {
  if (ms == null) return '—'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const cs = Math.floor((ms % 1000) / 10)
  return `${m}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}

// Sort entries best-first according to the event's scoring mode.
export function rankEntries(entries: RiseEntry[], mode: RiseScoringMode): RiseEntry[] {
  const sorted = [...entries]
  switch (mode) {
    case 'reps':
      sorted.sort((a, b) => b.counter - a.counter)
      break
    case 'time_fastest':
      // Only finished times rank; unfinished sink to the bottom.
      sorted.sort((a, b) => {
        if (a.time_ms == null && b.time_ms == null) return 0
        if (a.time_ms == null) return 1
        if (b.time_ms == null) return -1
        return a.time_ms - b.time_ms
      })
      break
    case 'time_longest':
      sorted.sort((a, b) => (b.time_ms ?? -1) - (a.time_ms ?? -1))
      break
    case 'measure_max':
      sorted.sort((a, b) => (b.measure_value ?? -1) - (a.measure_value ?? -1))
      break
  }
  return sorted
}

// ── Penalty / DNF (stored on entry.meta, used by team-timed events) ──
export function entryPenaltyMs(e: { meta?: Record<string, unknown> }): number {
  const v = e.meta?.penalty_ms
  return typeof v === 'number' ? v : 0
}
export function entryIsDnf(e: { meta?: Record<string, unknown> }): boolean {
  return e.meta?.dnf === true
}
// Final time = recorded time + penalty (never below zero). Null until a time exists.
export function entryFinalMs(e: { time_ms: number | null; meta?: Record<string, unknown> }): number | null {
  return e.time_ms != null ? Math.max(0, e.time_ms + entryPenaltyMs(e)) : null
}
// Signed penalty label, e.g. "+0:15" / "−0:05".
export function formatPenalty(ms: number): string {
  if (!ms) return '0'
  const sign = ms > 0 ? '+' : '−'
  return sign + formatMs(Math.abs(ms)).replace(/\.\d+$/, '')
}

// The headline value for an entry, formatted for display.
export function entryValue(entry: RiseEntry, mode: RiseScoringMode, unit: string): string {
  switch (mode) {
    case 'reps':
      return `${entry.counter}`
    case 'time_fastest':
    case 'time_longest':
      return formatMs(entry.time_ms)
    case 'measure_max':
      return entry.measure_value != null ? `${entry.measure_value} ${unit}` : '—'
  }
}
