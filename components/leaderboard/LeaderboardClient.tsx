'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Category, EventType } from '@/types/database'

interface AthleteRow {
  id: string
  name: string
  category_id: string | null
  competition_day: number
}

interface AttemptRow {
  id: string
  athlete_id: string
  event_type_id: string
  attempt_number: number
  declared_weight: number | null
  status: string
  scores: Array<{ result: string }>
}

interface ComputedAthlete {
  id: string
  name: string
  total: number
  scoresByEvent: Record<string, number>
  rank: number
}

export function LeaderboardClient({
  tournament,
  categories,
  athletes,
  eventTypes,
  attempts: initialAttempts,
  platformState: initialPlatformState,
  activeAttempt: initialActiveAttempt,
  isDisplayMode,
}: {
  tournament: { id: string; name: string; date_start: string | null }
  categories: Category[]
  athletes: AthleteRow[]
  eventTypes: EventType[]
  attempts: AttemptRow[]
  platformState: {
    athlete_id: string | null
    athlete?: { id: string; name: string; category?: { name: string } | null } | null
  } | null
  activeAttempt: { attempt_number: number; declared_weight: number | null; event_type?: { name: string } | null } | null
  isDisplayMode: boolean
}) {
  const supabase = createClient()
  const [attempts, setAttempts] = useState(initialAttempts)
  const [platformState, setPlatformState] = useState(initialPlatformState)
  const [activeAttempt, setActiveAttempt] = useState(initialActiveAttempt)

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`leaderboard-${tournament.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scores' },
        async payload => {
          const attemptId = (payload.new as { attempt_id: string }).attempt_id
          // Fetch updated attempt
          const { data } = await supabase
            .from('attempts')
            .select('id, athlete_id, event_type_id, attempt_number, declared_weight, status, scores(result)')
            .eq('id', attemptId)
            .single()
          if (data) {
            setAttempts(prev => {
              const idx = prev.findIndex(a => a.id === attemptId)
              if (idx >= 0) {
                const next = [...prev]
                next[idx] = data as AttemptRow
                return next
              }
              return [...prev, data as AttemptRow]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'platform_state' },
        async payload => {
          const row = payload.new as { tournament_id: string; athlete_id: string | null; attempt_id: string | null }
          if (row.tournament_id !== tournament.id) return
          // Fetch joined athlete data
          const { data: ps } = await supabase
            .from('platform_state')
            .select('*, athlete:athletes(id, name, category:categories(name))')
            .eq('tournament_id', tournament.id)
            .single()
          setPlatformState(ps ?? null)

          if (row.attempt_id) {
            const { data: att } = await supabase
              .from('attempts')
              .select('attempt_number, declared_weight, event_type:event_types(name)')
              .eq('id', row.attempt_id)
              .single()
            if (att) {
              type RawAtt = { attempt_number: number; declared_weight: number | null; event_type: { name: string } | { name: string }[] | null }
              const raw = att as RawAtt
              const et = Array.isArray(raw.event_type) ? raw.event_type[0] ?? null : raw.event_type
              setActiveAttempt({ attempt_number: raw.attempt_number, declared_weight: raw.declared_weight, event_type: et })
            } else {
              setActiveAttempt(null)
            }
          } else {
            setActiveAttempt(null)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournament.id])

  // Compute leaderboard from attempts
  function computeLeaderboard(categoryId: string): ComputedAthlete[] {
    const categoryAthletes = athletes.filter(a => a.category_id === categoryId)

    const computed = categoryAthletes.map(athlete => {
      const scoresByEvent: Record<string, number> = {}

      for (const et of eventTypes) {
        const athleteAttempts = attempts.filter(
          a => a.athlete_id === athlete.id && a.event_type_id === et.id && a.status === 'completed'
        )
        const best = Math.max(
          0,
          ...athleteAttempts
            .filter(a => {
              const goods = a.scores.filter(s => s.result === 'good_rep').length
              const nreps = a.scores.filter(s => s.result === 'no_rep').length
              return goods > nreps || (a.scores.length === 1 && goods === 1)
            })
            .map(a => a.declared_weight ?? 0)
        )
        if (best > 0) scoresByEvent[et.name] = best
      }

      const total = Object.values(scoresByEvent).reduce((sum, v) => sum + v, 0)
      return { id: athlete.id, name: athlete.name, total, scoresByEvent, rank: 0 }
    })

    computed.sort((a, b) => b.total - a.total)
    computed.forEach((a, i) => {
      if (a.total > 0) a.rank = i + 1
    })

    return computed
  }

  const onPlatformName = platformState?.athlete?.name
  const onPlatformCategory = platformState?.athlete?.category?.name

  return (
    <div className="min-h-screen bg-[#0d0800] text-white">
      {/* Header */}
      <header className="text-center py-8 px-4 border-b border-[#2a1a00]">
        <div className="inline-flex items-center gap-2 text-[#7c3aed] text-xs font-bold tracking-[4px] uppercase mb-4">
          <span className="w-1.5 h-1.5 bg-[#7c3aed] rounded-full animate-pulse" />
          LIVE
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">{tournament.name}</h1>
        {tournament.date_start && (
          <p className="text-zinc-500 text-sm mt-2">
            {new Date(tournament.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </header>

      {/* On Platform panel */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-xs font-bold text-[#7c3aed] tracking-[4px] uppercase text-center mb-3">Now on Platform</p>
        {onPlatformName ? (
          <div className="bg-[#1a0800] border-2 border-[#7c3aed]/60 rounded-2xl p-6 text-center">
            {onPlatformCategory && (
              <p className="text-[#7c3aed] text-xs font-semibold tracking-widest uppercase mb-2">{onPlatformCategory}</p>
            )}
            <p className="text-3xl font-black text-white mb-3">{onPlatformName}</p>
            {activeAttempt && (
              <div>
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">
                  {activeAttempt.event_type?.name} · Attempt {activeAttempt.attempt_number}
                </p>
                <p className="text-[#7c3aed] text-4xl font-black">
                  {activeAttempt.declared_weight ?? '—'}
                  <span className="text-lg ml-1 text-zinc-400">kg</span>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#120a00] border border-[#2a1a00] rounded-2xl p-6 text-center text-zinc-600 italic">
            Waiting for next athlete…
          </div>
        )}
      </div>

      {/* Leaderboard grid */}
      <div className="px-4 pb-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map(category => {
            const rows = computeLeaderboard(category.id)
            if (rows.length === 0) return null

            return (
              <CategoryCard
                key={category.id}
                category={category}
                athletes={rows}
                eventTypes={eventTypes}
                activeAthleteId={platformState?.athlete_id ?? null}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CategoryCard({
  category,
  athletes,
  eventTypes,
  activeAthleteId,
}: {
  category: Category
  athletes: ComputedAthlete[]
  eventTypes: EventType[]
  activeAthleteId: string | null
}) {
  return (
    <div className="bg-[#120a00] border border-[#2a1200] rounded-xl overflow-hidden">
      <div className="bg-[#7c3aed] px-4 py-2.5 text-center">
        <span className="font-black text-white text-sm tracking-wider uppercase">{category.name}</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a1200]">
            <th className="text-left px-3 py-2 text-[#7c3aed] font-semibold text-xs">#</th>
            <th className="text-left px-3 py-2 text-[#7c3aed] font-semibold text-xs">Athlete</th>
            <th className="text-right px-3 py-2 text-[#7c3aed] font-semibold text-xs">Total</th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((ath, i) => {
            const isActive = ath.id === activeAthleteId
            const medals = ['🥇', '🥈', '🥉']
            const rankDisplay = ath.total > 0 ? (medals[ath.rank - 1] ?? String(ath.rank)) : '—'

            return (
              <tr
                key={ath.id}
                className={`border-b border-[#1a0e00] last:border-0 transition-colors ${
                  isActive ? 'bg-[#7c3aed]/10' : i % 2 === 0 ? 'bg-[#0f0600]' : ''
                }`}
              >
                <td className="px-3 py-2.5 text-center text-sm">{rankDisplay}</td>
                <td className="px-3 py-2.5">
                  <div className={`font-semibold ${isActive ? 'text-[#7c3aed]' : 'text-white'}`}>
                    {isActive ? '▶ ' : ''}{ath.name}
                  </div>
                  {ath.total > 0 && Object.keys(ath.scoresByEvent).length > 0 && (
                    <div className="text-xs text-zinc-600 mt-0.5">
                      {eventTypes
                        .filter(et => ath.scoresByEvent[et.name] !== undefined)
                        .map(et => `${et.name}:${ath.scoresByEvent[et.name]}`)
                        .join(' ')}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {ath.total > 0 ? (
                    <span className="font-black text-[#7c3aed]">{ath.total}</span>
                  ) : (
                    <span className="text-zinc-700">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
