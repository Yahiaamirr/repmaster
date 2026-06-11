import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LeaderboardClient } from '@/components/leaderboard/LeaderboardClient'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ display?: string }>
}) {
  const { id } = await params
  const { display } = await searchParams
  const isDisplayMode = display === '1'

  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, date_start')
    .eq('id', id)
    .single()

  if (!tournament) notFound()

  // Load categories in display order
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('tournament_id', id)
    .order('display_order')

  // Load athletes
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, category_id, competition_day')
    .eq('tournament_id', id)
    .eq('attendance', true)

  // Load event types
  const { data: eventTypes } = await supabase
    .from('event_types')
    .select('id, name, display_order')
    .eq('tournament_id', id)
    .order('display_order')

  // Load all completed attempts with scores
  const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
  const { data: attempts } = athleteIds.length
    ? await supabase
        .from('attempts')
        .select('id, athlete_id, event_type_id, attempt_number, declared_weight, status, scores(result)')
        .in('athlete_id', athleteIds)
        .eq('status', 'completed')
    : { data: [] }

  // Load platform state
  const { data: platformState } = await supabase
    .from('platform_state')
    .select('*, athlete:athletes(id, name, category:categories(name))')
    .eq('tournament_id', id)
    .single()

  // Load active attempt details for platform state
  let activeAttempt: { attempt_number: number; declared_weight: number | null; event_type?: { name: string } | null } | null = null
  if (platformState?.attempt_id) {
    const { data } = await supabase
      .from('attempts')
      .select('attempt_number, declared_weight, event_type:event_types(name)')
      .eq('id', platformState.attempt_id)
      .single()
    if (data) {
      const rawEt = (data as { event_type: { name: string } | { name: string }[] | null }).event_type
      activeAttempt = {
        attempt_number: (data as { attempt_number: number }).attempt_number,
        declared_weight: (data as { declared_weight: number | null }).declared_weight,
        event_type: Array.isArray(rawEt) ? rawEt[0] ?? null : rawEt,
      }
    }
  }

  // Normalize eventTypes to full EventType shape
  const normalizedEventTypes = (eventTypes ?? []).map((et: { id: string; name: string; display_order: number }) => ({
    id: et.id,
    tournament_id: id,
    name: et.name,
    display_order: et.display_order,
    has_extras: false,
    extra_fields: [],
  }))

  return (
    <LeaderboardClient
      tournament={tournament}
      categories={categories ?? []}
      athletes={athletes ?? []}
      eventTypes={normalizedEventTypes}
      attempts={attempts ?? []}
      platformState={platformState ?? null}
      activeAttempt={activeAttempt}
      isDisplayMode={isDisplayMode}
    />
  )
}
