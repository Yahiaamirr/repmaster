import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink, Trophy } from 'lucide-react'
import { RiseManualEditor } from '@/components/rise/RiseManualEditor'
import { ENTRY_SELECT } from '@/lib/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseManualResult, RiseTeam } from '@/types/rise'
import { brandVars } from '@/lib/rise-theme'

export const dynamic = 'force-dynamic'

const MANUAL_SELECT = '*, competitor:rise_competitors(name, gender), team:rise_teams(name)'

export default async function RiseManualLeaderboardPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  const [{ data: teams }, { data: competitors }, { data: entries }, { data: manual }] = await Promise.all([
    supabase.from('rise_teams').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_competitors').select('*').eq('event_id', ev.id).order('name'),
    supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', ev.id),
    supabase.from('rise_manual_results').select(MANUAL_SELECT).eq('event_id', ev.id),
  ])

  return (
    <div style={brandVars(ev.slug)} className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/admin/rise/${ev.slug}`} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-[var(--brand-text,#4d7bff)] transition-colors">
          <ChevronLeft size={16} /> Back to event
        </Link>
        <a href={`/rise/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ExternalLink size={15} /> Public board
        </a>
      </div>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Trophy size={22} className="text-[var(--brand-text,#4d7bff)]" /> Manual Leaderboard
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Hand-set the standings for <span className="text-white font-semibold">{ev.name}</span> — type each result and
          reorder placements. Publishing replaces the live board with these standings until you revert.
        </p>
      </div>

      <RiseManualEditor
        event={ev}
        competitors={(competitors as RiseCompetitor[] | null) ?? []}
        teams={(teams as RiseTeam[] | null) ?? []}
        initialManual={(manual as RiseManualResult[] | null) ?? []}
        initialEntries={(entries as RiseEntry[] | null) ?? []}
      />
    </div>
  )
}
