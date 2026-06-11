'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ENTRY_SELECT } from '@/lib/rise'
import { rankEntries, entryValue, formatMs } from '@/types/rise'
import type { RiseEntry, RiseEvent, RiseRound, RiseTeam, RiseGender } from '@/types/rise'

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

  return (
    <div className="min-h-[100dvh] bg-[#0d0800] text-white">
      <Header event={event} roundName={event.is_team ? activeRound?.name ?? null : null} />
      <div className="px-4 pb-16 max-w-6xl mx-auto">
        {event.is_team ? (
          <TeamBoard event={event} teams={teams} rounds={roundList} activeRound={activeRound} entries={entries} />
        ) : (
          <SplitBoard event={event} entries={entries} />
        )}
      </div>
    </div>
  )
}

function Header({ event, roundName }: { event: RiseEvent; roundName: string | null }) {
  return (
    <header className="text-center py-8 px-4 border-b border-[#2a1a00]">
      <div className="inline-flex items-center gap-2 text-[#e8440a] text-xs font-bold tracking-[4px] uppercase mb-4">
        <span className="w-1.5 h-1.5 bg-[#e8440a] rounded-full animate-pulse" />
        Live
      </div>
      <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{event.name}</h1>
      {roundName && (
        <p className="text-zinc-400 text-sm mt-3 uppercase tracking-[0.3em]">{roundName}</p>
      )}
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
}: {
  event: RiseEvent
  teams: RiseTeam[]
  rounds: RiseRound[]
  activeRound: RiseRound | null
  entries: RiseEntry[]
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
                ? 'bg-[#1a0800] border-[#e8440a]/60'
                : advancing
                ? 'bg-[#140a00] border-[#e8440a]/25'
                : 'bg-[#120a00] border-[#2a1200]'
            }`}
          >
            <span className={`text-3xl font-black tabular-nums w-10 text-center ${isLeader ? 'text-[#e8440a]' : 'text-zinc-600'}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xl sm:text-2xl font-black truncate">{row.team.name}</p>
              {advancing && (
                <span className="text-[10px] font-bold tracking-widest text-[#e8440a] uppercase">
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
            <span className={`text-5xl sm:text-6xl font-black tabular-nums ${isLeader ? 'text-[#e8440a]' : 'text-white'}`}>
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
function SplitBoard({ event, entries }: { event: RiseEvent; entries: RiseEntry[] }) {
  const byGender = (g: RiseGender) => entries.filter(e => (e.competitor?.gender ?? 'M') === g)
  return (
    <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      <GenderColumn title="Men" event={event} entries={byGender('M')} />
      <GenderColumn title="Women" event={event} entries={byGender('F')} />
    </div>
  )
}

function GenderColumn({ title, event, entries }: { title: string; event: RiseEvent; entries: RiseEntry[] }) {
  const ranked = rankEntries(entries, event.scoring_mode)
  return (
    <div className="bg-[#120a00] border border-[#2a1200] rounded-2xl overflow-hidden">
      <div className="bg-[#e8440a] px-4 py-3 text-center">
        <span className="font-black text-white tracking-[0.2em] uppercase">{title}</span>
      </div>
      {ranked.length === 0 ? (
        <Empty message="No athletes yet." />
      ) : (
        <ul>
          {ranked.map((e, i) => (
            <Row key={e.id} entry={e} rank={i + 1} event={event} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ entry, rank, event }: { entry: RiseEntry; rank: number; event: RiseEvent }) {
  const hasResult =
    event.scoring_mode === 'reps'
      ? entry.counter > 0
      : event.scoring_mode === 'measure_max'
      ? entry.measure_value != null
      : entry.time_ms != null || entry.timer_running
  const medals = ['🥇', '🥈', '🥉']
  const rankDisplay = hasResult ? medals[rank - 1] ?? String(rank) : '—'

  return (
    <li className={`flex items-center gap-3 px-4 py-3.5 border-b border-[#1a0e00] last:border-0 ${entry.timer_running ? 'bg-[#e8440a]/10' : ''}`}>
      <span className="w-7 text-center text-sm tabular-nums">{rankDisplay}</span>
      <span className="flex-1 min-w-0 font-semibold truncate">{entry.competitor?.name ?? '—'}</span>
      <span className="font-black text-lg tabular-nums text-[#e8440a]">
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
