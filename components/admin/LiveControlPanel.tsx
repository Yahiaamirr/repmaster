'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament, EventType, Attempt, Score, PlatformState } from '@/types/database'
import { CheckCircle, XCircle, Radio, ChevronDown, ChevronRight } from 'lucide-react'

interface FlightWithAthletes {
  id: string
  name: string
  competition_day: number
  platform_order: number
  event_type: { id: string; name: string } | null
  flight_athletes: Array<{
    id: string
    platform_order: number
    athlete: { id: string; name: string; category: { name: string } | null } | null
  }>
}

export function LiveControlPanel({
  tournament,
  flights,
  eventTypes,
  attempts,
  platformState,
}: {
  tournament: Tournament
  flights: FlightWithAthletes[]
  eventTypes: EventType[]
  attempts: Array<Attempt & { scores: Score[] }>
  platformState: PlatformState | null
}) {
  const supabase = createClient()
  const router = useRouter()
  const [activeFlight, setActiveFlight] = useState<string | null>(null)
  const [activeAthleteId, setActiveAthleteId] = useState<string | null>(platformState?.athlete_id ?? null)
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(platformState?.attempt_id ?? null)
  const [localAttempts, setLocalAttempts] = useState(attempts)
  const [scoring, setScoring] = useState(false)
  const [selectedEventType, setSelectedEventType] = useState(eventTypes[0]?.id ?? '')
  const [selectedDay, setSelectedDay] = useState(1)

  // Subscribe to realtime score updates
  useEffect(() => {
    const channel = supabase
      .channel('control-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        router.refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const attemptMap = localAttempts.reduce<Record<string, Record<number, Attempt & { scores: Score[] }>>>(
    (acc, a) => {
      if (!acc[a.athlete_id]) acc[a.athlete_id] = {}
      acc[a.athlete_id][a.attempt_number] = a
      return acc
    },
    {}
  )

  // Visible flights filtered by event type + day
  const visibleFlights = flights.filter(
    f => f.event_type?.id === selectedEventType && f.competition_day === selectedDay
  )

  async function setOnPlatform(athleteId: string, flightId: string, attemptId: string | null) {
    setActiveAthleteId(athleteId)
    setActiveAttemptId(attemptId)
    await supabase
      .from('platform_state')
      .upsert({
        tournament_id: tournament.id,
        flight_id: flightId,
        athlete_id: athleteId,
        attempt_id: attemptId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tournament_id' })
  }

  async function submitScore(attemptId: string, result: 'good_rep' | 'no_rep') {
    setScoring(true)

    // Mark attempt as completed
    await supabase.from('attempts').update({ status: 'completed' }).eq('id', attemptId)

    // Insert score (admin judge)
    await supabase.from('scores').upsert({
      attempt_id: attemptId,
      judge_label: 'Admin',
      result,
    }, { onConflict: 'attempt_id,judge_id' })

    setScoring(false)
    router.refresh()
  }

  async function ensureAttempts(athleteId: string) {
    // Create all 3 attempts for each event type if they don't exist
    const inserts = []
    for (const et of eventTypes) {
      for (let n = 1; n <= 3; n++) {
        const existing = localAttempts.find(
          a => a.athlete_id === athleteId && a.event_type_id === et.id && a.attempt_number === n
        )
        if (!existing) {
          inserts.push({ athlete_id: athleteId, event_type_id: et.id, attempt_number: n, status: 'pending' })
        }
      }
    }
    if (inserts.length > 0) {
      const { data } = await supabase.from('attempts').insert(inserts).select('*, scores(*)')
      if (data) setLocalAttempts(prev => [...prev, ...(data as Array<Attempt & { scores: Score[] }>)])
    }
  }

  async function handleSetActive(athlete: { id: string }, flightId: string) {
    await ensureAttempts(athlete.id)
    const currentAttempt = localAttempts.find(
      a => a.athlete_id === athlete.id &&
           a.event_type_id === selectedEventType &&
           a.status !== 'completed'
    )
    await setOnPlatform(athlete.id, flightId, currentAttempt?.id ?? null)
  }

  async function updateDeclaredWeight(attemptId: string, weight: string) {
    const w = parseFloat(weight)
    if (isNaN(w)) return
    await supabase.from('attempts').update({ declared_weight: w }).eq('id', attemptId)
    setLocalAttempts(prev => prev.map(a => a.id === attemptId ? { ...a, declared_weight: w } : a))
  }

  const activeAthleteName = flights
    .flatMap(f => f.flight_athletes)
    .find(fa => fa.athlete?.id === activeAthleteId)?.athlete?.name

  const activeAttempt = localAttempts.find(a => a.id === activeAttemptId)

  return (
    <div className="space-y-6">
      {/* Now on Platform banner */}
      {activeAthleteId && (
        <div className="bg-[#e8440a]/10 border border-[#e8440a]/40 rounded-xl p-4 flex items-center gap-3">
          <Radio size={18} className="text-[#e8440a] animate-pulse" />
          <div>
            <div className="text-xs text-[#e8440a] font-semibold uppercase tracking-wider">Now on Platform</div>
            <div className="text-white font-bold">{activeAthleteName ?? 'Unknown'}</div>
          </div>
          {activeAttempt && (
            <div className="ml-auto text-right">
              <div className="text-xs text-zinc-400">Attempt {activeAttempt.attempt_number}</div>
              <div className="text-[#e8440a] font-bold">{activeAttempt.declared_weight ?? '—'} kg</div>
            </div>
          )}
        </div>
      )}

      {/* Active attempt scoring */}
      {activeAttemptId && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Score Active Attempt</h3>
          <div className="flex gap-4">
            <button
              disabled={scoring}
              onClick={() => submitScore(activeAttemptId, 'good_rep')}
              className="flex-1 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black text-lg rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle size={22} />
              GOOD REP
            </button>
            <button
              disabled={scoring}
              onClick={() => submitScore(activeAttemptId, 'no_rep')}
              className="flex-1 py-4 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black text-lg rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <XCircle size={22} />
              NO REP
            </button>
          </div>
        </div>
      )}

      {/* Flight selector */}
      <div className="flex gap-3">
        <select
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
          value={selectedEventType}
          onChange={e => setSelectedEventType(e.target.value)}
        >
          {eventTypes.map(et => (
            <option key={et.id} value={et.id}>{et.name}</option>
          ))}
        </select>
        <select
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
          value={selectedDay}
          onChange={e => setSelectedDay(Number(e.target.value))}
        >
          <option value={1}>Day 1</option>
          <option value={2}>Day 2</option>
          <option value={3}>Day 3</option>
        </select>
      </div>

      {/* Flights */}
      {visibleFlights.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          No flights for this selection. Generate flights first.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleFlights
            .sort((a, b) => a.platform_order - b.platform_order)
            .map(flight => (
              <FlightAccordion
                key={flight.id}
                flight={flight}
                activeAthleteId={activeAthleteId}
                selectedEventType={selectedEventType}
                attemptMap={attemptMap}
                onSetActive={handleSetActive}
                onScoreAttempt={submitScore}
                onUpdateWeight={updateDeclaredWeight}
                scoring={scoring}
                isOpen={activeFlight === flight.id || visibleFlights.length === 1}
                onToggle={() => setActiveFlight(prev => prev === flight.id ? null : flight.id)}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function FlightAccordion({
  flight,
  activeAthleteId,
  selectedEventType,
  attemptMap,
  onSetActive,
  onScoreAttempt,
  onUpdateWeight,
  scoring,
  isOpen,
  onToggle,
}: {
  flight: FlightWithAthletes
  activeAthleteId: string | null
  selectedEventType: string
  attemptMap: Record<string, Record<number, Attempt & { scores: Score[] }>>
  onSetActive: (athlete: { id: string }, flightId: string) => void
  onScoreAttempt: (attemptId: string, result: 'good_rep' | 'no_rep') => void
  onUpdateWeight: (attemptId: string, weight: string) => void
  scoring: boolean
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition-colors"
      >
        <span className="font-bold text-[#e8440a]">Flight {flight.name}</span>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <span>{flight.flight_athletes.length} athletes</span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800">
          {flight.flight_athletes
            .sort((a, b) => a.platform_order - b.platform_order)
            .map((fa, i) => {
              const athlete = fa.athlete
              if (!athlete) return null
              const isActive = activeAthleteId === athlete.id
              const attempts = attemptMap[athlete.id] ?? {}

              return (
                <div
                  key={fa.id}
                  className={`border-b border-zinc-800/50 last:border-0 p-4 ${isActive ? 'bg-[#e8440a]/5' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-xs w-5">{i + 1}</span>
                      <span className={`font-semibold ${isActive ? 'text-[#e8440a]' : 'text-white'}`}>
                        {athlete.name}
                      </span>
                      {athlete.category && (
                        <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                          {athlete.category.name}
                        </span>
                      )}
                      {isActive && (
                        <span className="text-xs bg-[#e8440a]/20 text-[#e8440a] border border-[#e8440a]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Radio size={8} className="animate-pulse" />
                          ON PLATFORM
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onSetActive(athlete, flight.id)}
                      className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                        isActive
                          ? 'bg-[#e8440a] text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {isActive ? 'Active' : 'Set Active'}
                    </button>
                  </div>

                  {/* Attempt rows */}
                  <div className="space-y-1.5">
                    {[1, 2, 3].map(n => {
                      const attempt = attempts[n]
                      const score = attempt?.scores?.[0]
                      const isGood = score?.result === 'good_rep'
                      const isNoRep = score?.result === 'no_rep'
                      const isDone = attempt?.status === 'completed'

                      return (
                        <div key={n} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-14">Attempt {n}</span>
                          {attempt ? (
                            <>
                              <input
                                type="number"
                                step="0.5"
                                defaultValue={attempt.declared_weight ?? ''}
                                onBlur={e => onUpdateWeight(attempt.id, e.target.value)}
                                className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#e8440a]"
                                placeholder="weight"
                              />
                              <span className="text-xs text-zinc-500">kg</span>
                              {isDone ? (
                                <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                  isGood ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {isGood ? '✓ GOOD' : '✗ NO REP'}
                                </span>
                              ) : (
                                isActive && (
                                  <div className="flex gap-1">
                                    <button
                                      disabled={scoring}
                                      onClick={() => onScoreAttempt(attempt.id, 'good_rep')}
                                      className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
                                    >
                                      Good
                                    </button>
                                    <button
                                      disabled={scoring}
                                      onClick={() => onScoreAttempt(attempt.id, 'no_rep')}
                                      className="text-xs px-2 py-1 bg-red-800 hover:bg-red-700 text-white rounded transition-colors"
                                    >
                                      No Rep
                                    </button>
                                  </div>
                                )
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-zinc-700">—</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
