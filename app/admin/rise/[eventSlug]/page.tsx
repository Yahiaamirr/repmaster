import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Radio, ExternalLink, ChevronLeft, QrCode, Pencil, UserCog, Trophy } from 'lucide-react'
import { RiseTokenManager } from '@/components/rise/RiseTokenManager'
import { RiseJudgeReport } from '@/components/rise/RiseJudgeReport'
import { RiseRoster } from '@/components/rise/RiseRoster'
import { RiseTeamManager } from '@/components/rise/RiseTeamManager'
import { RiseRegisterQR } from '@/components/rise/RiseRegisterQR'
import { RiseWordmark, RlntlssMark, RLNTLSS_SLUG, EvolveMark, EVOLVE_SLUG, TurboMark, TURBO_SLUG, LftdMark, LFTD_SLUG } from '@/components/rise/RiseBrand'
import type { RiseCompetitor, RiseEvent, RiseJudgeLog, RiseJudgeToken, RiseTeam } from '@/types/rise'
import { brandVars } from '@/lib/rise-theme'

export const dynamic = 'force-dynamic'

export default async function RiseSetupPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  const [{ data: teams }, { data: competitors }, { data: tokens }, { data: judgeLog }] = await Promise.all([
    supabase.from('rise_teams').select('*').eq('event_id', ev.id).order('display_order'),
    supabase.from('rise_competitors').select('*').eq('event_id', ev.id).order('name'),
    supabase.from('rise_judge_tokens').select('*').eq('event_id', ev.id).order('created_at'),
    supabase
      .from('rise_judge_log')
      .select('*, competitor:rise_competitors(name, gender), team:rise_teams(name)')
      .eq('event_id', ev.id)
      .order('last_at', { ascending: false }),
  ])

  const teamList = (teams as RiseTeam[] | null) ?? []
  const comps = (competitors as RiseCompetitor[] | null) ?? []
  const men = comps.filter(c => c.gender === 'M').length
  const women = comps.filter(c => c.gender === 'F').length

  return (
    <div style={brandVars(ev.slug)}>
      <Link href="/admin/rise" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-[var(--brand-text,#4d7bff)] mb-4 transition-colors">
        <ChevronLeft size={16} /> All RISE events
      </Link>

      {/* Header with brand */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--brand-border,#1a2547)] bg-[var(--brand-surface,#0b1226)] p-5 mb-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--brand-glow,rgba(47,95,224,0.18)),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="rounded-xl bg-[var(--brand-bg,#05070f)] border border-[var(--brand-border,#1a2547)] px-4 py-3 flex items-center gap-3">
              <RiseWordmark className="h-7 w-auto" />
              {ev.slug === RLNTLSS_SLUG && (
                <>
                  <span className="text-zinc-700 text-xs">×</span>
                  <RlntlssMark className="h-11 w-auto" />
                </>
              )}
              {ev.slug === EVOLVE_SLUG && (
                <>
                  <span className="text-zinc-700 text-xs">×</span>
                  <EvolveMark className="h-9 w-auto" />
                </>
              )}
              {ev.slug === TURBO_SLUG && (
                <>
                  <span className="text-zinc-700 text-xs">×</span>
                  <TurboMark className="h-15 w-auto" />
                </>
              )}
              {ev.slug === LFTD_SLUG && (
                <>
                  <span className="text-zinc-700 text-xs">×</span>
                  <LftdMark className="h-9 w-auto" />
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
                    <span className="text-[var(--brand-text,#4d7bff)] font-bold">{comps.length}</span> athletes ·{' '}
                    <span className="text-[var(--brand-text,#4d7bff)] font-bold">{men}</span> men ·{' '}
                    <span className="text-[var(--brand-text,#4d7bff)] font-bold">{women}</span> women
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/admin/rise/${ev.slug}/edit`} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
              <Pencil size={15} /> Edit
            </Link>
            <Link href={`/admin/rise/${ev.slug}/control`} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-[var(--brand,#2f5fe0)] hover:bg-[var(--brand-press,#2348b8)] text-[var(--brand-contrast,#fff)] rounded-lg font-semibold transition-colors">
              <Radio size={15} /> Control
            </Link>
            <Link href={`/admin/rise/${ev.slug}/leaderboard`} className="flex items-center gap-1.5 text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
              <Trophy size={15} /> Leaderboard
            </Link>
            <a href={`/rise/${ev.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
              <ExternalLink size={15} /> Board
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Roster */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--brand-text,#4d7bff)] uppercase tracking-wider mb-4">
            {ev.is_team ? 'Teams' : 'Participants'}
          </h2>

          {ev.is_team ? (
            <div className="space-y-4">
              {teamList.map(team => (
                <div key={team.id}>
                  <p className="text-sm font-bold text-[var(--brand-text,#2f5fe0)] mb-1">{team.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {comps.filter(c => c.team_id === team.id).map(c => (
                      <span key={c.id} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{c.name}</span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-zinc-600 pt-1">Manage teams and assignments in the Teams section below.</p>
            </div>
          ) : (
            <RiseRoster eventId={ev.id} initialCompetitors={comps} />
          )}
        </div>

        <div className="space-y-6">
          {/* Registration QR (individual events only) */}
          {!ev.is_team && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-text,#4d7bff)] uppercase tracking-wider mb-1">
                <QrCode size={15} /> Registration QR
              </h2>
              <p className="text-xs text-zinc-500 mb-4">Print or display this — athletes scan it to register themselves for {ev.name}.</p>
              <RiseRegisterQR slug={ev.slug} />
            </div>
          )}

          {/* Supervisor registration QR (all events) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-text,#4d7bff)] uppercase tracking-wider mb-1">
              <UserCog size={15} /> Supervisor Registration
            </h2>
            <p className="text-xs text-zinc-500 mb-4">Give this to the event supervisor — they register participants (name, gender, optional phone &amp; email) for {ev.name}.</p>
            <RiseRegisterQR slug={ev.slug} path="supervisor" />
          </div>

          {/* Judge links */}
          <RiseTokenManager event={ev} teams={teamList} initialTokens={(tokens as RiseJudgeToken[] | null) ?? []} />

          {/* Judges & who they judged */}
          <RiseJudgeReport
            eventId={ev.id}
            initialTokens={(tokens as RiseJudgeToken[] | null) ?? []}
            initialLog={(judgeLog as RiseJudgeLog[] | null) ?? []}
          />
        </div>
      </div>

      {/* Teams — group athletes into teams */}
      <div className="mt-6">
        <RiseTeamManager eventId={ev.id} initialTeams={teamList} initialCompetitors={comps} allowTeamEdits />
      </div>
    </div>
  )
}
