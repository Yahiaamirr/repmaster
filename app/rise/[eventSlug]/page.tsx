import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RiseLeaderboard } from '@/components/rise/RiseLeaderboard'
import { ENTRY_SELECT } from '@/lib/rise'
import type { RiseEntry, RiseEvent, RiseRound, RiseTeam } from '@/types/rise'

export const dynamic = 'force-dynamic'

export default async function RiseEventLeaderboardPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

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
