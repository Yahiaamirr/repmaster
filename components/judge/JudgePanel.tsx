'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Radio, Clock } from 'lucide-react'

interface PlatformStateRow {
  tournament_id: string
  athlete_id: string | null
  attempt_id: string | null
  athlete?: { id: string; name: string; category?: { name: string } | null } | null
  attempt?: {
    id: string
    attempt_number: number
    declared_weight: number | null
    event_type?: { name: string } | null
  } | null
}

type ScoredResult = 'good_rep' | 'no_rep' | null

export function JudgePanel({
  token,
  judgeLabel,
  tournament,
  platformState: initialState,
}: {
  token: string
  judgeLabel: string
  tournament: { id: string; name: string; status: string }
  platformState: PlatformStateRow | null
}) {
  const supabase = createClient()
  const [platformState, setPlatformState] = useState(initialState)
  const [scored, setScored] = useState<ScoredResult>(null)
  const [submitting, setSubmitting] = useState(false)
  const [lastAttemptId, setLastAttemptId] = useState<string | null>(null)

  // Reset scored state when attempt changes
  useEffect(() => {
    const newAttemptId = platformState?.attempt_id ?? null
    if (newAttemptId !== lastAttemptId) {
      setScored(null)
      setLastAttemptId(newAttemptId)
    }
  }, [platformState?.attempt_id])

  // Subscribe to platform state changes
  useEffect(() => {
    const channel = supabase
      .channel(`judge-${token}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'platform_state' },
        async payload => {
          const row = payload.new as { tournament_id: string }
          if (row.tournament_id !== tournament.id) return
          const { data } = await supabase
            .from('platform_state')
            .select(`
              *,
              athlete:athletes(id, name, category:categories(name)),
              attempt:attempts(id, attempt_number, declared_weight, event_type:event_types(name))
            `)
            .eq('tournament_id', tournament.id)
            .single()
          if (data) setPlatformState(data as PlatformStateRow)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [tournament.id, token])

  const submitScore = useCallback(async (result: 'good_rep' | 'no_rep') => {
    const attemptId = platformState?.attempt_id
    if (!attemptId || submitting || scored) return

    setSubmitting(true)
    await supabase.from('scores').insert({
      attempt_id: attemptId,
      judge_label: judgeLabel,
      result,
    })
    setScored(result)
    setSubmitting(false)
  }, [platformState?.attempt_id, submitting, scored, judgeLabel])

  const athlete = platformState?.athlete
  const attempt = platformState?.attempt
  const hasActiveAttempt = !!attempt?.id && !!athlete?.id

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col select-none">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 font-mono">{tournament.name}</p>
          <p className="text-sm font-bold text-white">{judgeLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <Radio size={10} className="animate-pulse" />
          LIVE
        </div>
      </div>

      {/* Main content */}
      {!hasActiveAttempt ? (
        <WaitingState />
      ) : scored ? (
        <ScoredState result={scored} athlete={athlete!} attempt={attempt!} />
      ) : (
        <ActiveAttemptState
          athlete={athlete!}
          attempt={attempt!}
          onScore={submitScore}
          submitting={submitting}
        />
      )}
    </div>
  )
}

function WaitingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <Clock size={48} className="text-zinc-700 mb-6" />
      <p className="text-zinc-400 text-lg font-semibold">Waiting</p>
      <p className="text-zinc-600 text-sm mt-2">Next athlete will appear automatically</p>
    </div>
  )
}

function ScoredState({
  result,
  athlete,
  attempt,
}: {
  result: 'good_rep' | 'no_rep'
  athlete: { name: string; category?: { name: string } | null }
  attempt: { attempt_number: number; declared_weight: number | null; event_type?: { name: string } | null }
}) {
  const isGood = result === 'good_rep'
  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center text-center px-8 ${
        isGood ? 'bg-green-950/30' : 'bg-red-950/30'
      }`}
    >
      {isGood ? (
        <CheckCircle2 size={80} className="text-green-400 mb-6" />
      ) : (
        <XCircle size={80} className="text-red-400 mb-6" />
      )}
      <p className={`text-4xl font-black mb-2 ${isGood ? 'text-green-400' : 'text-red-400'}`}>
        {isGood ? 'GOOD REP' : 'NO REP'}
      </p>
      <p className="text-zinc-400 text-sm mt-2">{athlete.name}</p>
      <p className="text-zinc-600 text-xs mt-1">
        {attempt.event_type?.name} · Attempt {attempt.attempt_number} · {attempt.declared_weight ?? '?'} kg
      </p>
      <p className="text-zinc-600 text-xs mt-6">Waiting for next athlete…</p>
    </div>
  )
}

function ActiveAttemptState({
  athlete,
  attempt,
  onScore,
  submitting,
}: {
  athlete: { name: string; category?: { name: string } | null }
  attempt: { attempt_number: number; declared_weight: number | null; event_type?: { name: string } | null }
  onScore: (result: 'good_rep' | 'no_rep') => void
  submitting: boolean
}) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Athlete info */}
      <div className="px-6 py-8 text-center border-b border-zinc-800">
        {athlete.category && (
          <p className="text-[#e8440a] text-xs font-bold tracking-widest uppercase mb-2">
            {athlete.category.name}
          </p>
        )}
        <p className="text-3xl font-black text-white mb-4">{athlete.name}</p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">
            {attempt.event_type?.name}
          </span>
          <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">
            Attempt {attempt.attempt_number}
          </span>
        </div>
        {attempt.declared_weight && (
          <p className="text-5xl font-black text-[#e8440a] mt-4">
            {attempt.declared_weight}
            <span className="text-xl text-zinc-400 ml-1">kg</span>
          </p>
        )}
      </div>

      {/* Score buttons — take up rest of screen */}
      <div className="flex flex-1 gap-0">
        <button
          disabled={submitting}
          onClick={() => onScore('good_rep')}
          className="flex-1 flex flex-col items-center justify-center gap-4 bg-green-700 hover:bg-green-600 active:bg-green-800 disabled:opacity-50 transition-colors text-white"
          style={{ minHeight: '40vh' }}
        >
          <CheckCircle2 size={56} />
          <span className="font-black text-2xl tracking-wide">GOOD REP</span>
        </button>
        <button
          disabled={submitting}
          onClick={() => onScore('no_rep')}
          className="flex-1 flex flex-col items-center justify-center gap-4 bg-red-800 hover:bg-red-700 active:bg-red-900 disabled:opacity-50 transition-colors text-white"
          style={{ minHeight: '40vh' }}
        >
          <XCircle size={56} />
          <span className="font-black text-2xl tracking-wide">NO REP</span>
        </button>
      </div>
    </div>
  )
}
