'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { boardTheme, eventShowsWomen, Header, type BoardTheme } from './RiseLeaderboard'
import { isTeamScored } from '@/types/rise'
import type { RiseEvent, RiseManualResult, RiseGender } from '@/types/rise'

const MANUAL_SELECT = '*, competitor:rise_competitors(name, gender), team:rise_teams(name)'

export function RiseManualBoard({
  event,
  initialManual,
}: {
  event: RiseEvent
  initialManual: RiseManualResult[]
}) {
  const supabase = createClient()
  const [eventState, setEventState] = useState(event)
  const [manual, setManual] = useState(initialManual)
  const theme = boardTheme(eventState.slug)
  const teamMode = isTeamScored(eventState)
  const showWomen = eventShowsWomen(eventState)

  // Live-refresh as the admin edits/republishes the manual standings.
  useEffect(() => {
    const channel = supabase
      .channel(`rise-manual-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_manual_results', filter: `event_id=eq.${event.id}` }, async () => {
        const { data } = await supabase.from('rise_manual_results').select(MANUAL_SELECT).eq('event_id', event.id)
        if (data) setManual(data as RiseManualResult[])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_events', filter: `id=eq.${event.id}` }, payload => {
        const next = payload.new as RiseEvent | null
        if (next?.id) setEventState(next)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event.id])

  const rows = [...manual]
    .filter(r => r.included)
    .sort((a, b) => a.manual_rank - b.manual_rank)

  return (
    <div className={`min-h-[100dvh] ${theme.pageBg} ${theme.pageText}`}>
      <Header event={eventState} roundName={teamMode ? 'Final Standings' : null} theme={theme} />
      <div className="px-4 pb-16 max-w-6xl mx-auto">
        {teamMode ? (
          <Column title={null} rows={rows} theme={theme} />
        ) : (
          <div className={`mt-8 grid grid-cols-1 ${showWomen ? 'lg:grid-cols-2' : 'max-w-3xl mx-auto'} gap-6`}>
            <Column title="Men" rows={rows.filter(r => (r.competitor?.gender ?? 'M') === 'M')} theme={theme} />
            {showWomen && <Column title="Women" rows={rows.filter(r => (r.competitor?.gender ?? 'M') === 'F')} theme={theme} />}
          </div>
        )}
      </div>
    </div>
  )
}

function Column({ title, rows, theme }: { title: string | null; rows: RiseManualResult[]; theme: BoardTheme }) {
  const sorted = [...rows].sort((a, b) => a.manual_rank - b.manual_rank)
  return (
    <div className={`${title ? '' : 'mt-8'} ${theme.genderContainer} border rounded-2xl overflow-hidden`}>
      {title && (
        <div className={`${theme.genderBar} px-4 py-3 text-center`}>
          <span className={`font-black ${theme.genderBarText} tracking-[0.2em] uppercase`}>{title}</span>
        </div>
      )}
      {sorted.length === 0 ? (
        <div className="px-4 py-10 text-center text-zinc-600 text-sm italic">No results posted.</div>
      ) : (
        <ul>
          {sorted.map((r, i) => (
            <Row key={r.id} row={r} rank={i + 1} theme={theme} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Row({ row, rank, theme }: { row: RiseManualResult; rank: number; theme: BoardTheme }) {
  const medals = ['🥇', '🥈', '🥉']
  const name = row.competitor?.name ?? row.team?.name ?? '—'
  const gender = row.competitor?.gender as RiseGender | undefined
  return (
    <li className={`flex items-center gap-3 px-4 py-3.5 border-b ${theme.rowDivider} last:border-0`}>
      <span className="w-7 text-center text-sm tabular-nums">{medals[rank - 1] ?? rank}</span>
      {gender && <span className={`text-[10px] font-bold w-3 ${gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{gender}</span>}
      <span className="flex-1 min-w-0 font-semibold truncate">{name}</span>
      <span className={`font-black text-lg tabular-nums ${theme.value}`}>
        {row.value_text?.trim() ? row.value_text : <span className="text-zinc-700">—</span>}
      </span>
    </li>
  )
}
