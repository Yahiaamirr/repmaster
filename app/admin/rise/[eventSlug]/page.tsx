import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Radio, ExternalLink, ChevronLeft } from 'lucide-react'
import { RiseTokenManager } from '@/components/rise/RiseTokenManager'
import type { RiseCompetitor, RiseEvent, RiseJudgeToken, RiseTeam } from '@/types/rise'

export const dynamic = 'force-dynamic'

export default async function RiseSetupPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  const [{ data: teams }, { data: competitors }, { data: tokens }] = await Promise.all([
    supabase.from('rise_teams').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_competitors').select('*').eq('event_id', ev.id).order('name'),
    supabase.from('rise_judge_tokens').select('*').eq('event_id', ev.id).order('created_at'),
  ])

  const teamList = (teams as RiseTeam[] | null) ?? []
  const comps = (competitors as RiseCompetitor[] | null) ?? []
  const men = comps.filter(c => c.gender === 'M').length
  const women = comps.filter(c => c.gender === 'F').length

  return (
    <div>
      <Link href="/admin/rise" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-4">
        <ChevronLeft size={16} /> All RISE events
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{ev.name}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {ev.is_team ? `${teamList.length} teams` : `${comps.length} athletes · ${men} men · ${women} women`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/rise/${ev.slug}/control`} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[#e8440a] hover:bg-[#c73a08] text-white rounded-md font-semibold transition-colors">
            <Radio size={15} /> Control
          </Link>
          <a href={`/rise/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors">
            <ExternalLink size={15} /> Board
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roster */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            {ev.is_team ? 'Teams' : 'Participants'}
          </h2>
          {ev.is_team ? (
            <div className="space-y-4">
              {teamList.map(team => (
                <div key={team.id}>
                  <p className="text-sm font-bold text-[#e8440a] mb-1">{team.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {comps.filter(c => c.team_id === team.id).map(c => (
                      <span key={c.id} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{c.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : comps.length === 0 ? (
            <p className="text-zinc-500 text-sm">No participants. Run the participant seed migration.</p>
          ) : (
            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {comps.map(c => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className={`text-[10px] font-bold w-4 ${c.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{c.gender}</span>
                  <span className="text-zinc-200">{c.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Judge links */}
        <RiseTokenManager event={ev} teams={teamList} initialTokens={(tokens as RiseJudgeToken[] | null) ?? []} />
      </div>
    </div>
  )
}
