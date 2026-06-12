import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RiseLeaderboard } from '@/components/rise/RiseLeaderboard'
import { RiseManualBoard } from '@/components/rise/RiseManualBoard'
import { ENTRY_SELECT } from '@/lib/rise'
import type { RiseEntry, RiseEvent, RiseManualResult, RiseRound, RiseTeam } from '@/types/rise'

export const dynamic = 'force-dynamic'

const MANUAL_SELECT = '*, competitor:rise_competitors(name, gender), team:rise_teams(name)'

export default async function RiseEventLeaderboardPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  // Published manual standings replace the live board for this event.
  if (ev.manual_leaderboard) {
    const { data: manual } = await supabase
      .from('rise_manual_results')
      .select(MANUAL_SELECT)
      .eq('event_id', ev.id)
    return <RiseManualBoard event={ev} initialManual={(manual as RiseManualResult[] | null) ?? []} />
  }

  const [{ data: teams }, { data: rounds }, { data: entries }] = await Promise.all([
    supabase.from('rise_teams').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_rounds').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', ev.id),
  ])

  return (
    <RiseLeaderboard
      event={ev}
      teams={(teams as RiseTeam[] | null) ?? []}
      rounds={(rounds as RiseRound[] | null) ?? []}
      initialEntries={(entries as RiseEntry[] | null) ?? []}
    />
  )
}
