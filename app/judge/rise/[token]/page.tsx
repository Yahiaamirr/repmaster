import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RiseJudge } from '@/components/rise/RiseJudge'
import { ENTRY_SELECT } from '@/lib/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseJudgeToken, RiseTeam } from '@/types/rise'

export const dynamic = 'force-dynamic'

export default async function RiseJudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: tokenRow } = await supabase
    .from('rise_judge_tokens')
    .select('*, event:rise_events(*)')
    .eq('token', token)
    .single()

  if (!tokenRow) notFound()

  const t = tokenRow as RiseJudgeToken & { event: RiseEvent }
  const event = t.event
  const scope = t.scope ?? {}
  const isScoped = !!(scope.team_id || scope.competitor_id)

  // Scoped token (e.g. a RISE team) → bind directly to that entry.
  if (isScoped) {
    let query = supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', event.id)
    if (scope.team_id) query = query.eq('team_id', scope.team_id)
    if (scope.competitor_id) query = query.eq('competitor_id', scope.competitor_id)
    const { data: entries } = await query
    return (
      <RiseJudge
        token={token}
        event={event}
        mode="scoped"
        scope={scope}
        initialEntries={(entries as RiseEntry[] | null) ?? []}
        competitors={[]}
      />
    )
  }

  // Event-scoped token → roster picker (one device scores many athletes/teams).
  const [{ data: competitors }, { data: entries }, { data: teams }] = await Promise.all([
    supabase.from('rise_competitors').select('*').eq('event_id', event.id).order('name'),
    supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', event.id),
    supabase.from('rise_teams').select('*').eq('event_id', event.id).order('display_order'),
  ])

  return (
    <RiseJudge
      token={token}
      event={event}
      mode="roster"
      scope={scope}
      initialEntries={(entries as RiseEntry[] | null) ?? []}
      competitors={(competitors as RiseCompetitor[] | null) ?? []}
      teams={(teams as RiseTeam[] | null) ?? []}
    />
  )
}
