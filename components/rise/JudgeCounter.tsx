'use client'

import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { adjustCounter, adjustMovement, setPhase } from '@/lib/rise'
import { MOVEMENT_LABEL, movementLoad, movementReps } from '@/types/rise'
import type { RiseEntry, RiseEvent, RiseMovement } from '@/types/rise'
import { JudgeHeader } from './JudgeHeader'
import { brandVars } from '@/lib/rise-theme'

export function JudgeCounter({
  event,
  entry,
  label,
  movement,
  onLocalChange,
  onBack,
}: {
  event: RiseEvent
  entry: RiseEntry
  label: string
  movement?: RiseMovement
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

  // Movement judges count one movement (meta.reps); the team total is their sum.
  const reps = movementReps(entry)
  const count = movement ? reps[movement] : entry.counter

  async function bump(delta: number) {
    if (busy) return
    setBusy(true)
    if (movement) {
      // Optimistic: update this movement's count and the derived total.
      const next = Math.max(0, reps[movement] + delta)
      const nextReps = { ...reps, [movement]: next }
      onLocalChange({ meta: { ...entry.meta, reps: nextReps }, counter: nextReps.mu + nextReps.pu + nextReps.dips })
      await adjustMovement(supabase, entry.id, movement, delta)
    } else {
      onLocalChange({ counter: Math.max(0, entry.counter + delta) })
      await adjustCounter(supabase, entry.id, delta)
    }
    setBusy(false)
  }

  async function startAmrap() {
    if (movement) {
      // Gate done: flip the shared team entry to AMRAP and zero all three counts.
      const zero = { mu: 0, pu: 0, dips: 0 }
      onLocalChange({ phase: 'amrap', counter: 0, meta: { ...entry.meta, reps: zero } })
      await supabase
        .from('rise_entries')
        .update({ phase: 'amrap', counter: 0, meta: { ...entry.meta, reps: zero }, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
    } else {
      onLocalChange({ phase: 'amrap', counter: 0 })
      await setPhase(supabase, entry.id, 'amrap')
      await adjustCounter(supabase, entry.id, -entry.counter) // reset to 0 for AMRAP
    }
  }

  if (isFinalChipper) {
    return (
      <ChipperView
        chipper={chipper!}
        label={label}
        highlight={movement}
        onStartAmrap={startAmrap}
      />
    )
  }

  const movementName = movement ? MOVEMENT_LABEL[movement] : null
  const load = movement ? movementLoad(event.config, movement) : undefined
  const headerRight = movement
    ? `${movementName}${entry.phase === 'amrap' ? ' · AMRAP' : ''}`
    : entry.phase === 'amrap' ? 'AMRAP' : event.unit.toUpperCase()
  const subLabel = movement
    ? `${movementName}${load ? ` · ${load} kg` : ''}`
    : entry.phase === 'amrap' ? 'AMRAP' : event.unit.toUpperCase()

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none touch-none" style={brandVars(event.slug)}>
      <JudgeHeader eventName={event.name} label={label} right={headerRight} onBack={onBack} />

      {/* Live count */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-[28vw] leading-none font-black text-white tabular-nums">
          {count}
        </p>
        <p className="text-zinc-600 text-sm uppercase tracking-widest mt-2">{subLabel}</p>
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
          className="flex-[2] flex items-center justify-center bg-[var(--brand,#2f5fe0)] active:bg-[var(--brand-press,#2348b8)] disabled:opacity-60 text-[var(--brand-contrast,#fff)]"
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
  highlight,
  onStartAmrap,
}: {
  chipper: { mu: number; pu: number; dips: number; mu_kg?: number; pu_kg?: number; dips_kg?: number }
  label: string
  highlight?: RiseMovement
  onStartAmrap: () => void
}) {
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none px-6 py-6">
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="text-xs text-zinc-500 mb-6">Complete the buy-in, then start the AMRAP.</p>

      <div className="flex-1 flex flex-col justify-center gap-4">
        {([
          ['mu', 'Muscle-ups', chipper.mu, chipper.mu_kg],
          ['pu', 'Pull-ups', chipper.pu, chipper.pu_kg],
          ['dips', 'Dips', chipper.dips, chipper.dips_kg],
        ] as const)
          .filter(([, , n]) => n > 0)
          .map(([key, name, n, kg]) => {
            const on = highlight === key
            return (
              <div
                key={key}
                className={`flex items-center justify-between rounded-2xl px-6 py-5 border ${
                  on ? 'bg-[var(--brand,#2f5fe0)]/15 border-[var(--brand,#2f5fe0)]/60' : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <div className="min-w-0">
                  <span className={`text-xl font-bold block ${on ? 'text-white' : 'text-white'}`}>{name}</span>
                  {kg ? <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{kg} kg</span> : null}
                </div>
                <span className="text-4xl font-black text-[var(--brand-text,#2f5fe0)] tabular-nums">{n}</span>
              </div>
            )
          })}
      </div>

      <button
        onClick={onStartAmrap}
        className="mt-6 w-full py-6 bg-[var(--brand,#2f5fe0)] active:bg-[var(--brand-press,#2348b8)] text-[var(--brand-contrast,#fff)] font-black text-2xl rounded-2xl tracking-wide"
      >
        START AMRAP →
      </button>
    </div>
  )
}
