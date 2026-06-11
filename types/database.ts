export type TournamentStatus = 'setup' | 'live' | 'ended'
export type AttemptStatus = 'pending' | 'active' | 'completed' | 'skipped'
export type ScoreResult = 'good_rep' | 'no_rep'

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Tournament {
  id: string
  org_id: string | null
  name: string
  slug: string
  date_start: string | null
  date_end: string | null
  status: TournamentStatus
  judges_per_attempt: number
  flight_size: number
  settings: Record<string, unknown>
  created_at: string
}

export interface EventType {
  id: string
  tournament_id: string
  name: string
  display_order: number
  has_extras: boolean
  extra_fields: Array<{ label: string; key: string; unit: string }>
}

export interface Category {
  id: string
  tournament_id: string
  name: string
  display_order: number
}

export interface Athlete {
  id: string
  tournament_id: string
  name: string
  category_id: string | null
  competition_day: number
  body_weight_kg: number | null
  attendance: boolean
  created_at: string
  // joined
  category?: Category
}

export interface AthleteOpener {
  id: string
  athlete_id: string
  event_type_id: string
  opener_weight: number | null
  extras: Record<string, number>
}

export interface Flight {
  id: string
  tournament_id: string
  event_type_id: string
  competition_day: number
  name: string
  platform_order: number
  created_at: string
  // joined
  event_type?: EventType
  flight_athletes?: FlightAthlete[]
}

export interface FlightAthlete {
  id: string
  flight_id: string
  athlete_id: string
  platform_order: number
  // joined
  athlete?: Athlete
}

export interface Attempt {
  id: string
  athlete_id: string
  event_type_id: string
  attempt_number: 1 | 2 | 3
  declared_weight: number | null
  status: AttemptStatus
  created_at: string
  // joined
  athlete?: Athlete
  event_type?: EventType
  scores?: Score[]
}

export interface Score {
  id: string
  attempt_id: string
  judge_id: string | null
  judge_label: string | null
  result: ScoreResult
  created_at: string
}

export interface PlatformState {
  id: string
  tournament_id: string
  flight_id: string | null
  athlete_id: string | null
  attempt_id: string | null
  updated_at: string
  // joined
  flight?: Flight
  athlete?: Athlete
  attempt?: Attempt
}

export interface JudgeToken {
  id: string
  tournament_id: string
  token: string
  label: string | null
  judge_number: number | null
  created_at: string
  expires_at: string | null
}

// Leaderboard view row
export interface LeaderboardRow {
  athlete_id: string
  tournament_id: string
  athlete_name: string
  category: string
  category_order: number
  competition_day: number
  total: number
  scores_by_event: Record<string, number>
  rank_in_category: number
}

// Flight generation input
export interface FlightGeneratorInput {
  tournament_id: string
  event_type_id: string
  competition_day: number
  athletes: Array<{
    athlete_id: string
    category_name: string
    category_order: number
    opener_weight: number | null
  }>
  flight_size: number
  category_groups: string[][]  // e.g. [['Female'], ['-66'], ['-80', '-87']]
}
