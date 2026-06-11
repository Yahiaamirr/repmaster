'use client'

import { useState } from 'react'
import { Minus, Plus, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { setMeasure } from '@/lib/rise'
import type { RiseEntry, RiseEvent } from '@/types/rise'
import { JudgeHeader } from './JudgeHeader'

export function JudgeMeasure({
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
  const [value, setValue] = useState<number>(entry.measure_value ?? 100)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(entry.measure_value != null)

  function adjust(delta: number) {
    setValue(v => Math.max(0, Math.round((v + delta) * 10) / 10))
    setSaved(false)
  }

  async function save() {
    if (busy) return
    setBusy(true)
    onLocalChange({ measure_value: value, status: 'done' })
    await setMeasure(supabase, entry.id, value)
    setSaved(true)
    setBusy(false)
  }

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none">
      <JudgeHeader eventName={event.name} label={label} right="Highest wins" onBack={onBack} />

      {/* Value */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="flex items-baseline">
          <span className="text-[26vw] sm:text-[140px] leading-none font-black text-white tabular-nums">
            {value}
          </span>
          <span className="text-3xl font-bold text-zinc-500 ml-2">{event.unit}</span>
        </div>
        <p className={`text-xs uppercase tracking-[0.3em] mt-4 ${saved ? 'text-green-400' : 'text-zinc-600'}`}>
          {saved ? '✓ Saved to leaderboard' : 'Unsaved'}
        </p>
      </div>

      {/* Steppers */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <StepButton label="−5" onClick={() => adjust(-5)} icon={<Minus size={20} />} />
        <StepButton label="+5" onClick={() => adjust(5)} icon={<Plus size={20} />} accent />
        <StepButton label="−1" onClick={() => adjust(-1)} icon={<Minus size={20} />} />
        <StepButton label="+1" onClick={() => adjust(1)} icon={<Plus size={20} />} accent />
      </div>

      {/* Save */}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={save}
          disabled={busy || saved}
          className="w-full h-20 flex items-center justify-center gap-3 bg-[#2f5fe0] active:bg-[#2348b8] disabled:opacity-40 text-white font-black text-2xl rounded-3xl transition-colors"
        >
          <Check size={28} strokeWidth={3} />
          {saved ? 'SAVED' : 'SAVE RESULT'}
        </button>
      </div>
    </div>
  )
}

function StepButton({
  label,
  icon,
  onClick,
  accent,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`h-20 flex items-center justify-center gap-2 rounded-2xl font-black text-2xl transition-colors ${
        accent
          ? 'bg-[#2f5fe0]/15 text-[#2f5fe0] border border-[#2f5fe0]/30 active:bg-[#2f5fe0]/25'
          : 'bg-zinc-900 text-zinc-300 border border-zinc-800 active:bg-zinc-800'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
