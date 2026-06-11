import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Radio, ExternalLink, ChevronLeft, QrCode } from 'lucide-react'
import { RiseTokenManager } from '@/components/rise/RiseTokenManager'
import { RiseRoster } from '@/components/rise/RiseRoster'
import { RiseRegisterQR } from '@/components/rise/RiseRegisterQR'
import { RiseWordmark, RlntlssMark, RLNTLSS_SLUG } from '@/components/rise/RiseBrand'
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
      <Link href="/admin/rise" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-[#4d7bff] mb-4 transition-colors">
        <ChevronLeft size={16} /> All RISE events
      </Link>

      {/* Header with brand */}
      <div className="relative overflow-hidden rounded-2xl border border-[#243668] bg-[#0e1838] p-5 mb-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(47,95,224,0.18),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="rounded-xl bg-[#070e24] border border-[#243668] px-4 py-2.5 flex items-center gap-3">
              <RiseWordmark className="h-5 w-auto" />
              {ev.slug === RLNTLSS_SLUG && (
                <>
                  <span className="text-zinc-700 text-xs">×</span>
                  <RlntlssMark className="h-6 w-auto" />
                </>
              )}
            </span>
            <div>
              <h1 className="text-2xl font-black">{ev.name}</h1>
              <p className="text-sm mt-0.5">
                {ev.is_team ? (
                  <span className="text-zinc-400">{teamList.length} teams · fixed roster</span>
                ) : (
                  <span className="text-zinc-400">
                    <span className="text-[#4d7bff] font-bold">{comps.length}</span> athletes ·{' '}
                    <span className="text-[#4d7bff] font-bold">{men}</span> men ·{' '}
                    <span className="text-[#4d7bff] font-bold">{women}</span> women
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/rise/${ev.slug}/control`} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-[#2f5fe0] hover:bg-[#2348b8] text-white rounded-lg font-semibold transition-colors">
              <Radio size={15} /> Control
            </Link>
            <a href={`/rise/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm px-4 py-2 bg-[#16224a] hover:bg-[#1d2c5c] text-white rounded-lg transition-colors">
              <ExternalLink size={15} /> Board
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roster */}
        <div className="bg-[#0e1838] border border-[#243668] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#4d7bff] uppercase tracking-wider mb-4">
            {ev.is_team ? 'Teams' : 'Participants'}
          </h2>

          {ev.is_team ? (
            <div className="space-y-4">
              {teamList.map(team => (
                <div key={team.id}>
                  <p className="text-sm font-bold text-[#2f5fe0] mb-1">{team.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {comps.filter(c => c.team_id === team.id).map(c => (
                      <span key={c.id} className="text-xs bg-[#16224a] text-zinc-300 px-2 py-0.5 rounded-full">{c.name}</span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-zinc-600 pt-1">RISE teams are fixed and can’t be edited here.</p>
            </div>
          ) : (
            <RiseRoster eventId={ev.id} initialCompetitors={comps} />
          )}
        </div>

        <div className="space-y-6">
          {/* Registration QR (individual events only) */}
          {!ev.is_team && (
            <div className="bg-[#0e1838] border border-[#243668] rounded-xl p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[#4d7bff] uppercase tracking-wider mb-1">
                <QrCode size={15} /> Registration QR
              </h2>
              <p className="text-xs text-zinc-500 mb-4">Print or display this — athletes scan it to register themselves for {ev.name}.</p>
              <RiseRegisterQR slug={ev.slug} />
            </div>
          )}

          {/* Judge links */}
          <RiseTokenManager event={ev} teams={teamList} initialTokens={(tokens as RiseJudgeToken[] | null) ?? []} />
        </div>
      </div>
    </div>
  )
}
