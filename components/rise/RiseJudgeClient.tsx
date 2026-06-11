'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchScopedEntries, pickActiveEntry } from '@/lib/rise'
import type { RiseEntry, RiseEvent } from '@/types/rise'
import { brandVars } from '@/lib/rise-theme'
import { JudgeCounter } from './JudgeCounter'
import { JudgeTimer } from './JudgeTimer'
import { JudgeMeasure } from './JudgeMeasure'

export function RiseJudgeClient({
  event,
  label,
  scope,
  initialEntries,
}: {
  event: RiseEvent
  label: string
  scope: { team_id?: string; competitor_id?: string }
  initialEntries: RiseEntry[]
}) {
  const supabase = createClient()
  const [entry, setEntry] = useState<RiseEntry | null>(pickActiveEntry(initialEntries))

  const reresolve = useCallback(async () => {
    const entries = await fetchScopedEntries(supabase, event.id, scope)
    setEntry(prev => {
      const picked = pickActiveEntry(entries)
      // Keep optimistic local counter if the same entry and our value is ahead
      if (prev && picked && prev.id === picked.id && prev.counter > picked.counter) {
        return { ...picked, counter: prev.counter }
      }
      return picked
    })
  }, [event.id, scope.team_id, scope.competitor_id])

  // Re-resolve when control room creates/advances entries or another device scores.
  useEffect(() => {
    const channel = supabase
      .channel(`rise-judge-${event.id}-${scope.team_id ?? scope.competitor_id ?? 'x'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_entries', filter: `event_id=eq.${event.id}` }, reresolve)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_rounds', filter: `event_id=eq.${event.id}` }, reresolve)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event.id, reresolve])

  const onLocalChange = useCallback((next: Partial<RiseEntry>) => {
    setEntry(prev => (prev ? { ...prev, ...next } : prev))
  }, [])

  if (!entry) return <WaitingState event={event} label={label} />

  const common = { event, entry, label, onLocalChange }
  if (event.scoring_mode === 'reps') return <JudgeCounter {...common} />
  if (event.scoring_mode === 'measure_max') return <JudgeMeasure {...common} />
  return <JudgeTimer {...common} />
}

function WaitingState({ event, label }: { event: RiseEvent; label: string }) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center text-center px-8 select-none" style={brandVars(event.slug)}>
      <div className="flex items-center gap-1.5 text-xs text-[var(--brand-text,#2f5fe0)] mb-8">
        <Radio size={10} className="animate-pulse" />
        <span className="font-mono">{event.name}</span>
      </div>
      <Clock size={48} className="text-zinc-700 mb-6" />
      <p className="text-white text-lg font-bold">{label}</p>
      <p className="text-zinc-500 text-sm mt-2 max-w-xs">
        Waiting for the control room to put you on the clock. This screen updates automatically.
      </p>
    </div>
  )
}
