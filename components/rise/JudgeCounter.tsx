'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { adjustCounter, setPhase } from '@/lib/rise'
import type { RiseEntry, RiseEvent } from '@/types/rise'
import { JudgeHeader } from './JudgeHeader'

export function JudgeCounter({
  event,
  entry,
  label,
  onLocalChange,
  onBack,
}: {
  event: RiseEvent
  entry: RiseEntry
  label: string
  onLocalChange: (next: Partial<RiseEntry>) => void
  onBack?: () => void
}) {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)

  // RISE final has a chipper phase before the AMRAP that actually scores.
  const chipper = event.config.chipper
  const isFinalChipper =
    event.is_team && entry.phase === 'chipper' && !!chipper &&
    (chipper.mu > 0 || chipper.pu > 0 || chipper.dips > 0)

  async function bump(delta: number) {
    if (busy) return
    setBusy(true)
    // Optimistic local update for instant feedback
    onLocalChange({ counter: Math.max(0, entry.counter + delta) })
    await adjustCounter(supabase, entry.id, delta)
    setBusy(false)
  }

  async function startAmrap() {
    onLocalChange({ phase: 'amrap', counter: 0 })
    await setPhase(supabase, entry.id, 'amrap')
    await adjustCounter(supabase, entry.id, -entry.counter) // reset to 0 for AMRAP
  }

  if (isFinalChipper) {
    return (
      <ChipperView
        chipper={chipper!}
        label={label}
        onStartAmrap={startAmrap}
      />
    )
  }

  const phaseLabel = entry.phase === 'amrap' ? 'AMRAP' : event.unit.toUpperCase()

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none touch-none">
      <JudgeHeader eventName={event.name} label={label} right={phaseLabel} onBack={onBack} />

      {/* Live count */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-[28vw] leading-none font-black text-white tabular-nums">
          {entry.counter}
        </p>
        <p className="text-zinc-600 text-sm uppercase tracking-widest mt-2">{phaseLabel}</p>
      </div>

      {/* − / + buttons */}
      <div className="flex gap-0 h-[34vh]">
        <button
          onClick={() => bump(-1)}
          disabled={busy}
          className="flex-1 flex items-center justify-center bg-zinc-800 active:bg-zinc-700 disabled:opacity-60 text-white"
        >
          <Minus size={72} strokeWidth={3} />
        </button>
        <button
          onClick={() => bump(1)}
          disabled={busy}
          className="flex-[2] flex items-center justify-center bg-[#e8440a] active:bg-[#c63808] disabled:opacity-60 text-white"
        >
          <Plus size={96} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

function ChipperView({
  chipper,
  label,
  onStartAmrap,
}: {
  chipper: { mu: number; pu: number; dips: number }
  label: string
  onStartAmrap: () => void
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none px-6 py-6">
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="text-xs text-zinc-500 mb-6">Complete the buy-in, then start the AMRAP.</p>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {([['Muscle-ups', chipper.mu], ['Pull-ups', chipper.pu], ['Dips', chipper.dips]] as const)
          .filter(([, n]) => n > 0)
          .map(([name, n]) => (
            <div
              key={name}
              className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-5"
            >
              <span className="text-xl font-bold text-white">{name}</span>
              <span className="text-4xl font-black text-[#e8440a] tabular-nums">{n}</span>
            </div>
          ))}
      </div>

      <button
        onClick={onStartAmrap}
        className="mt-6 w-full py-6 bg-[#e8440a] active:bg-[#c63808] text-white font-black text-2xl rounded-2xl tracking-wide"
      >
        START AMRAP →
      </button>
    </div>
  )
}
