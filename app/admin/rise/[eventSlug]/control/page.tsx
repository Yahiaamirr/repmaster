import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { RiseControlPanel } from '@/components/rise/RiseControlPanel'
import { ENTRY_SELECT } from '@/lib/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseRound, RiseTeam } from '@/types/rise'

export const dynamic = 'force-dynamic'

export default async function RiseControlPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  const [{ data: teams }, { data: rounds }, { data: competitors }, { data: entries }] = await Promise.all([
    supabase.from('rise_teams').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_rounds').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_competitors').select('*').eq('event_id', ev.id).order('name'),
    supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', ev.id),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/rise/${ev.slug}`} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white">
          <ChevronLeft size={16} /> Setup
        </Link>
        <a href={`/rise/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ExternalLink size={15} /> Public board
        </a>
      </div>

      <RiseControlPanel
        event={ev}
        teams={(teams as RiseTeam[] | null) ?? []}
        rounds={(rounds as RiseRound[] | null) ?? []}
        competitors={(competitors as RiseCompetitor[] | null) ?? []}
        initialEntries={(entries as RiseEntry[] | null) ?? []}
      />
    </div>
  )
}
