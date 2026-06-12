'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gavel, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RiseJudgeLog, RiseJudgeToken } from '@/types/rise'

const LOG_SELECT = '*, competitor:rise_competitors(name, gender), team:rise_teams(name)'

export function RiseJudgeReport({
  eventId,
  initialTokens,
  initialLog,
}: {
  eventId: string
  initialTokens: RiseJudgeToken[]
  initialLog: RiseJudgeLog[]
}) {
  const supabase = createClient()
  const [tokens, setTokens] = useState<RiseJudgeToken[]>(initialTokens)
  const [log, setLog] = useState<RiseJudgeLog[]>(initialLog)

  const refetch = useCallback(async () => {
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from('rise_judge_tokens').select('*').eq('event_id', eventId).order('created_at'),
      supabase.from('rise_judge_log').select(LOG_SELECT).eq('event_id', eventId).order('last_at', { ascending: false }),
    ])
    if (t) setTokens(t as RiseJudgeToken[])
    if (l) setLog(l as RiseJudgeLog[])
  }, [eventId])

  // Live-update as judges register and score.
  useEffect(() => {
    const channel = supabase
      .channel(`rise-judge-report-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_judge_log', filter: `event_id=eq.${eventId}` }, refetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [eventId, refetch])

  // Only show judges who actually signed in or judged someone.
  const judges = tokens
    .map(t => ({ token: t, rows: log.filter(r => r.token_id === t.id) }))
    .filter(j => j.token.judge_name || j.rows.length > 0)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--brand-text,#4d7bff)] uppercase tracking-wider mb-1">
        <Gavel size={15} /> Judges &amp; who they judged
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Updates live as judges sign in and score. Each judge is linked to their judge station.
      </p>

      {judges.length === 0 ? (
        <p className="text-zinc-500 text-sm">No judge has signed in yet.</p>
      ) : (
        <div className="space-y-3">
          {judges.map(({ token, rows }) => {
            const name = token.judge_name || rows[0]?.judge_name || token.label || 'Unnamed judge'
            const athletes = [...rows].sort((a, b) =>
              (a.competitor?.name ?? a.team?.name ?? '').localeCompare(b.competitor?.name ?? b.team?.name ?? '')
            )
            return (
              <div key={token.id} className="bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserRound size={15} className="text-[var(--brand-text,#4d7bff)] shrink-0" />
                    <span className="font-semibold text-white truncate">{name}</span>
                    {token.judge_name && token.label && token.label !== name && (
                      <span className="text-xs text-zinc-500 truncate">· {token.label}</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0">
                    {athletes.length} {athletes.length === 1 ? 'athlete' : 'athletes'}
                  </span>
                </div>
                {athletes.length === 0 ? (
                  <p className="text-xs text-zinc-600">Signed in — hasn’t scored anyone yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {athletes.map(r => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full"
                        title={`scored ${r.score_count}×`}
                      >
                        {r.competitor?.gender && (
                          <span className={r.competitor.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}>
                            {r.competitor.gender}
                          </span>
                        )}
                        {r.competitor?.name ?? r.team?.name ?? 'Unknown'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
