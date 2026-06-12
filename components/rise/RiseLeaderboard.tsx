'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ENTRY_SELECT } from '@/lib/rise'
import { rankEntries, entryValue, formatMs } from '@/types/rise'
import type { RiseEntry, RiseEvent, RiseRound, RiseTeam, RiseGender } from '@/types/rise'
import { RiseWordmark, RlntlssMark, RLNTLSS_SLUG, EvolveMark, EVOLVE_SLUG, TurboMark, TURBO_SLUG, LftdMark, LFTD_SLUG, SassicMark, SASSIC_SLUG_PREFIX } from './RiseBrand'

// ── Per-event board theming ─────────────────────────────────
// Default is the RISE navy/blue look. The Evolve event uses a monochrome
// black-and-white theme drawn from theevolveway.com (premium, high-contrast,
// bold uppercase) to match its sponsor branding.
export type BoardTheme = {
  pageBg: string
  pageText: string
  headerBorder: string
  headerGlow: string
  liveText: string
  liveDot: string
  roundName: string
  leaderRow: string
  advancingRow: string
  baseRow: string
  rankLeader: string
  rankBase: string
  qualifying: string
  counterLeader: string
  counterBase: string
  genderContainer: string
  genderBar: string
  genderBarText: string
  rowDivider: string
  timerHighlight: string
  value: string
}

const riseTheme: BoardTheme = {
  pageBg: 'bg-[#05070f]',
  pageText: 'text-white',
  headerBorder: 'border-[#1a2547]',
  headerGlow: 'bg-[radial-gradient(ellipse_at_top,rgba(47,95,224,0.2),transparent_60%)]',
  liveText: 'text-[#4d7bff]',
  liveDot: 'bg-[#4d7bff]',
  roundName: 'text-zinc-400',
  leaderRow: 'bg-[#102047] border-[#2f5fe0]/60',
  advancingRow: 'bg-[#0c1430] border-[#2f5fe0]/25',
  baseRow: 'bg-[#0b1226] border-[#1a2547]',
  rankLeader: 'text-[#2f5fe0]',
  rankBase: 'text-zinc-600',
  qualifying: 'text-[#2f5fe0]',
  counterLeader: 'text-[#2f5fe0]',
  counterBase: 'text-white',
  genderContainer: 'bg-[#0b1226] border-[#1a2547]',
  genderBar: 'bg-[#2f5fe0]',
  genderBarText: 'text-white',
  rowDivider: 'border-[#141d3a]',
  timerHighlight: 'bg-[#2f5fe0]/10',
  value: 'text-[#2f5fe0]',
}

const evolveTheme: BoardTheme = {
  pageBg: 'bg-black',
  pageText: 'text-white',
  headerBorder: 'border-[#1f1f1f]',
  headerGlow: 'bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_60%)]',
  liveText: 'text-white',
  liveDot: 'bg-white',
  roundName: 'text-zinc-500',
  leaderRow: 'bg-[#161616] border-white/40',
  advancingRow: 'bg-[#0e0e0e] border-white/20',
  baseRow: 'bg-[#0a0a0a] border-[#1f1f1f]',
  rankLeader: 'text-white',
  rankBase: 'text-zinc-700',
  qualifying: 'text-white',
  counterLeader: 'text-white',
  counterBase: 'text-zinc-400',
  genderContainer: 'bg-[#0a0a0a] border-[#1f1f1f]',
  genderBar: 'bg-white',
  genderBarText: 'text-black',
  rowDivider: 'border-[#1a1a1a]',
  timerHighlight: 'bg-white/5',
  value: 'text-white',
}

const turboTheme: BoardTheme = {
  pageBg: 'bg-black',
  pageText: 'text-white',
  headerBorder: 'border-[#2a0d0d]',
  headerGlow: 'bg-[radial-gradient(ellipse_at_top,rgba(236,33,36,0.18),transparent_60%)]',
  liveText: 'text-[#ec2124]',
  liveDot: 'bg-[#ec2124]',
  roundName: 'text-zinc-500',
  leaderRow: 'bg-[#2a0d0d] border-[#ec2124]/60',
  advancingRow: 'bg-[#1a0808] border-[#ec2124]/25',
  baseRow: 'bg-[#0d0d0d] border-[#1f1f1f]',
  rankLeader: 'text-[#ec2124]',
  rankBase: 'text-zinc-700',
  qualifying: 'text-[#ec2124]',
  counterLeader: 'text-[#ec2124]',
  counterBase: 'text-white',
  genderContainer: 'bg-[#0d0d0d] border-[#1f1f1f]',
  genderBar: 'bg-[#ec2124]',
  genderBarText: 'text-white',
  rowDivider: 'border-[#1a1a1a]',
  timerHighlight: 'bg-[#ec2124]/10',
  value: 'text-[#ec2124]',
}

// RLNTLSS Iron — monochrome black & white (rlntlssiron.com industrial look).
const rlntlssTheme: BoardTheme = {
  pageBg: 'bg-black',
  pageText: 'text-white',
  headerBorder: 'border-[#1f1f1f]',
  headerGlow: 'bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_60%)]',
  liveText: 'text-white',
  liveDot: 'bg-white',
  roundName: 'text-zinc-500',
  leaderRow: 'bg-[#161616] border-white/40',
  advancingRow: 'bg-[#0e0e0e] border-white/20',
  baseRow: 'bg-[#0a0a0a] border-[#1f1f1f]',
  rankLeader: 'text-white',
  rankBase: 'text-zinc-700',
  qualifying: 'text-white',
  counterLeader: 'text-white',
  counterBase: 'text-zinc-400',
  genderContainer: 'bg-[#0a0a0a] border-[#1f1f1f]',
  genderBar: 'bg-white',
  genderBarText: 'text-black',
  rowDivider: 'border-[#1a1a1a]',
  timerHighlight: 'bg-white/5',
  value: 'text-white',
}

// LFTD — light theme drawn straight from the logo: lime ground, navy ink.
const lftdTheme: BoardTheme = {
  pageBg: 'bg-[#dae07c]',
  pageText: 'text-[#0f2e64]',
  headerBorder: 'border-[#0f2e64]/20',
  headerGlow: 'bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.45),transparent_60%)]',
  liveText: 'text-[#0f2e64]',
  liveDot: 'bg-[#0f2e64]',
  roundName: 'text-[#0f2e64]/70',
  leaderRow: 'bg-[#0f2e64]/12 border-[#0f2e64]/50',
  advancingRow: 'bg-[#0f2e64]/[0.06] border-[#0f2e64]/25',
  baseRow: 'bg-white/25 border-[#0f2e64]/15',
  rankLeader: 'text-[#0f2e64]',
  rankBase: 'text-[#0f2e64]/40',
  qualifying: 'text-[#0f2e64]',
  counterLeader: 'text-[#0f2e64]',
  counterBase: 'text-[#0f2e64]',
  genderContainer: 'bg-white/25 border-[#0f2e64]/15',
  genderBar: 'bg-[#0f2e64]',
  genderBarText: 'text-[#dae07c]',
  rowDivider: 'border-[#0f2e64]/10',
  timerHighlight: 'bg-[#0f2e64]/10',
  value: 'text-[#0f2e64]',
}

// Per-event board theme — shared with the manual board so both look identical.
export function boardTheme(slug: string): BoardTheme {
  return slug === EVOLVE_SLUG ? evolveTheme
    : slug === TURBO_SLUG ? turboTheme
    : slug === LFTD_SLUG ? lftdTheme
    : slug === RLNTLSS_SLUG ? rlntlssTheme
    : riseTheme
}

export function RiseLeaderboard({
  event,
  teams,
  rounds,
  initialEntries,
}: {
  event: RiseEvent
  teams: RiseTeam[]
  rounds: RiseRound[]
  initialEntries: RiseEntry[]
}) {
  const supabase = createClient()
  const [entries, setEntries] = useState(initialEntries)
  const [roundList, setRoundList] = useState(rounds)

  useEffect(() => {
    const channel = supabase
      .channel(`rise-board-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_entries', filter: `event_id=eq.${event.id}` }, async () => {
        const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', event.id)
        if (data) setEntries(data as RiseEntry[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_rounds', filter: `event_id=eq.${event.id}` }, async () => {
        const { data } = await supabase.from('rise_rounds').select('*').eq('event_id', event.id).order('display_order')
        if (data) setRoundList(data as RiseRound[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event.id])

  const activeRound =
    roundList.find(r => r.status === 'active') ??
    [...roundList].reverse().find(r => entries.some(e => e.round_id === r.id)) ??
    roundList[0] ??
    null

  const theme = boardTheme(event.slug)

  return (
    <div className={`min-h-[100dvh] ${theme.pageBg} ${theme.pageText}`}>
      <Header event={event} roundName={event.is_team ? activeRound?.name ?? null : null} theme={theme} />
      <div className="px-4 pb-16 max-w-6xl mx-auto">
        {event.is_team ? (
          <TeamBoard event={event} teams={teams} rounds={roundList} activeRound={activeRound} entries={entries} theme={theme} />
        ) : (
          <SplitBoard event={event} entries={entries} theme={theme} />
        )}
      </div>
    </div>
  )
}

export function Header({ event, roundName, theme }: { event: RiseEvent; roundName: string | null; theme: BoardTheme }) {
  const isRlntlss = event.slug === RLNTLSS_SLUG || event.slug.startsWith('rltnlss')
  const isEvolve = event.slug === EVOLVE_SLUG
  const isTurbo = event.slug === TURBO_SLUG
  const isLftd = event.slug === LFTD_SLUG
  const isSassic = event.slug.startsWith(SASSIC_SLUG_PREFIX)
  return (
    <header className={`relative text-center py-9 px-4 border-b ${theme.headerBorder} overflow-hidden`}>
      <div className={`pointer-events-none absolute inset-0 ${theme.headerGlow}`} />
      <div className="relative">
        <div className="flex items-center justify-center gap-4 mb-5">
          <RiseWordmark className={`h-8 sm:h-10 w-auto ${isLftd ? 'brightness-0' : ''}`} />
          {isRlntlss && (
            <>
              <span className="text-zinc-700 text-sm">×</span>
              <RlntlssMark className="h-13 sm:h-15 w-auto" />
            </>
          )}
          {isEvolve && (
            <>
              <span className="text-zinc-700 text-sm">×</span>
              <EvolveMark className="h-11 sm:h-14 w-auto" />
            </>
          )}
          {isTurbo && (
            <>
              <span className="text-zinc-700 text-sm">×</span>
              <TurboMark className="h-20 sm:h-24 w-auto" />
            </>
          )}
          {isLftd && (
            <>
              <span className="text-[#0f2e64]/40 text-sm">×</span>
              <LftdMark className="h-12 sm:h-14 w-auto" />
            </>
          )}
          {isSassic && (
            <>
              <span className="text-zinc-700 text-sm">×</span>
              <SassicMark className="h-10 sm:h-12 w-auto" />
            </>
          )}
        </div>
        <div className={`inline-flex items-center gap-2 ${theme.liveText} text-xs font-bold tracking-[4px] uppercase mb-3`}>
          <span className={`w-1.5 h-1.5 ${theme.liveDot} rounded-full animate-pulse`} />
          Live
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{event.name}</h1>
        {roundName && (
          <p className={`${theme.roundName} text-sm mt-3 uppercase tracking-[0.3em]`}>{roundName}</p>
        )}
      </div>
    </header>
  )
}

// ── Team board (RISE Battle Cycles) ─────────────────────────
function TeamBoard({
  event,
  teams,
  rounds,
  activeRound,
  entries,
  theme,
}: {
  event: RiseEvent
  teams: RiseTeam[]
  rounds: RiseRound[]
  activeRound: RiseRound | null
  entries: RiseEntry[]
  theme: BoardTheme
}) {
  const roundEntries = entries.filter(e => e.round_id === activeRound?.id)
  const isQual = (activeRound?.name ?? '').toLowerCase().includes('qual')
  const qualifiers = isQual ? 2 : 0

  const rows = teams
    .map(team => {
      const e = roundEntries.find(x => x.team_id === team.id)
      return { team, counter: e?.counter ?? 0, phase: e?.phase ?? null, hasEntry: !!e }
    })
    .sort((a, b) => b.counter - a.counter)

  if (roundEntries.length === 0) {
    return <Empty message="The round hasn't started yet. Standings appear here live." />
  }

  return (
    <div className="mt-8 space-y-3">
      {rows.map((row, i) => {
        const advancing = qualifiers > 0 && i < qualifiers && row.counter > 0
        const isLeader = i === 0 && row.counter > 0
        return (
          <div
            key={row.team.id}
            className={`flex items-center gap-4 rounded-2xl border px-5 py-5 transition-colors ${
              isLeader
                ? theme.leaderRow
                : advancing
                ? theme.advancingRow
                : theme.baseRow
            }`}
          >
            <span className={`text-3xl font-black tabular-nums w-10 text-center ${isLeader ? theme.rankLeader : theme.rankBase}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xl sm:text-2xl font-black truncate">{row.team.name}</p>
              {advancing && (
                <span className={`text-[10px] font-bold tracking-widest ${theme.qualifying} uppercase`}>
                  ▲ Qualifying
                </span>
              )}
              {row.phase === 'chipper' && (
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Buy-in</span>
              )}
              {row.phase === 'amrap' && (
                <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">AMRAP</span>
              )}
            </div>
            <span className={`text-5xl sm:text-6xl font-black tabular-nums ${isLeader ? theme.counterLeader : theme.counterBase}`}>
              {row.counter}
            </span>
          </div>
        )
      })}
      {qualifiers > 0 && (
        <p className="text-center text-xs text-zinc-600 pt-2">Top {qualifiers} teams advance to the final</p>
      )}
    </div>
  )
}

// ── Split board (individual events, Male / Female) ──────────
function SplitBoard({ event, entries, theme }: { event: RiseEvent; entries: RiseEntry[]; theme: BoardTheme }) {
  const byGender = (g: RiseGender) => entries.filter(e => (e.competitor?.gender ?? 'M') === g)
  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <GenderColumn title="Men" event={event} entries={byGender('M')} theme={theme} />
      <GenderColumn title="Women" event={event} entries={byGender('F')} theme={theme} />
    </div>
  )
}

function GenderColumn({ title, event, entries, theme }: { title: string; event: RiseEvent; entries: RiseEntry[]; theme: BoardTheme }) {
  const ranked = rankEntries(entries, event.scoring_mode)
  return (
    <div className={`${theme.genderContainer} border rounded-2xl overflow-hidden`}>
      <div className={`${theme.genderBar} px-4 py-3 text-center`}>
        <span className={`font-black ${theme.genderBarText} tracking-[0.2em] uppercase`}>{title}</span>
      </div>
      {ranked.length === 0 ? (
        <Empty message="No athletes yet." />
      ) : (
        <ul>
          {ranked.map((e, i) => (
            <Row key={e.id} entry={e} rank={i + 1} event={event} theme={theme} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ entry, rank, event, theme }: { entry: RiseEntry; rank: number; event: RiseEvent; theme: BoardTheme }) {
  const hasResult =
    event.scoring_mode === 'reps'
      ? entry.counter > 0
      : event.scoring_mode === 'measure_max'
      ? entry.measure_value != null
      : entry.time_ms != null || entry.timer_running
  const medals = ['🥇', '🥈', '🥉']
  const rankDisplay = hasResult ? medals[rank - 1] ?? String(rank) : '—'

  return (
    <li className={`flex items-center gap-3 px-4 py-3.5 border-b ${theme.rowDivider} last:border-0 ${entry.timer_running ? theme.timerHighlight : ''}`}>
      <span className="w-7 text-center text-sm tabular-nums">{rankDisplay}</span>
      <span className="flex-1 min-w-0 font-semibold truncate">{entry.competitor?.name ?? '—'}</span>
      <span className={`font-black text-lg tabular-nums ${theme.value}`}>
        {entry.timer_running ? <LiveTimer startedAt={entry.timer_started_at} /> : hasResult ? entryValue(entry, event.scoring_mode, event.unit) : <span className="text-zinc-700">—</span>}
      </span>
    </li>
  )
}

function LiveTimer({ startedAt }: { startedAt: string | null }) {
  const [ms, setMs] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!startedAt) return
    const start = new Date(startedAt).getTime()
    const tick = () => {
      setMs(Math.max(0, Date.now() - start))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [startedAt])
  return <span className="text-white">{formatMs(ms)}</span>
}

function Empty({ message }: { message: string }) {
  return <div className="px-4 py-10 text-center text-zinc-600 text-sm italic">{message}</div>
}
