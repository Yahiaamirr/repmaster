import type { SupabaseClient } from '@supabase/supabase-js'
import type { RiseEntry } from '@/types/rise'

// Columns to select for an entry plus its joined competitor/team.
export const ENTRY_SELECT =
  '*, competitor:rise_competitors(id, name, team_id, display_order), team:rise_teams(id, name, display_order)'

// ── Judge mutations ──────────────────────────────────────────

export async function adjustCounter(supabase: SupabaseClient, entryId: string, delta: number) {
  return supabase.rpc('rise_adjust_counter', { p_entry_id: entryId, p_delta: delta })
}

export async function timerStart(supabase: SupabaseClient, entryId: string) {
  return supabase.rpc('rise_timer_start', { p_entry_id: entryId })
}

export async function timerStop(supabase: SupabaseClient, entryId: string) {
  return supabase.rpc('rise_timer_stop', { p_entry_id: entryId })
}

export async function setMeasure(supabase: SupabaseClient, entryId: string, value: number) {
  return supabase
    .from('rise_entries')
    .update({ measure_value: value, status: 'done', updated_at: new Date().toISOString() })
    .eq('id', entryId)
}

export async function setPhase(supabase: SupabaseClient, entryId: string, phase: string) {
  return supabase
    .from('rise_entries')
    .update({ phase, updated_at: new Date().toISOString() })
    .eq('id', entryId)
}

// ── Entry resolution for a judge token ───────────────────────
// A token is scoped to a team (RISE) or a competitor (individual events).
// Pick the live entry: prefer an entry whose round is active, else the
// most-recently-updated one for that scope.
export function pickActiveEntry(entries: RiseEntry[]): RiseEntry | null {
  if (entries.length === 0) return null
  const active = entries.find(e => e.status === 'active')
  if (active) return active
  return [...entries].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  )[0]
}

export async function fetchScopedEntries(
  supabase: SupabaseClient,
  eventId: string,
  scope: { team_id?: string; competitor_id?: string }
): Promise<RiseEntry[]> {
  let query = supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', eventId)
  if (scope.team_id) query = query.eq('team_id', scope.team_id)
  if (scope.competitor_id) query = query.eq('competitor_id', scope.competitor_id)
  const { data } = await query
  return (data as RiseEntry[] | null) ?? []
}
