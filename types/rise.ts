// Types for the RISE Opening Event section (separate from the powerlifting schema)

export type RiseScoringMode = 'reps' | 'time_fastest' | 'time_longest' | 'measure_max'
export type RiseGender = 'M' | 'F'
export type RiseStatus = 'setup' | 'live' | 'ended'
export type RiseRoundStatus = 'pending' | 'active' | 'done'
export type RiseEntryStatus = 'pending' | 'active' | 'done'

export interface RiseEventConfig {
  qual_duration?: number
  final_duration?: number
  chipper?: { mu: number; pu: number; dips: number }
  amrap_weight?: number
  qualifiers?: number
  top_bar?: number
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
}

export interface RiseTeam {
  id: string
  event_id: string
  name: string
  display_order: number
}

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
  scope: { team_id?: string; competitor_id?: string; round_id?: string }
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
