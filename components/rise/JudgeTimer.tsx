'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Square, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { timerStart, timerStop } from '@/lib/rise'
import { formatMs } from '@/types/rise'
import type { RiseEntry, RiseEvent } from '@/types/rise'
import { JudgeHeader } from './JudgeHeader'

export function JudgeTimer({
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
  const [displayMs, setDisplayMs] = useState(0)
  const rafRef = useRef<number | null>(null)

  const running = entry.timer_running
  const goalWord = event.scoring_mode === 'time_fastest' ? 'Fastest wins' : 'Longest wins'

  // Live ticking clock, isolated to this component. GPU-free text update only.
  useEffect(() => {
    if (running && entry.timer_started_at) {
      const startedAt = new Date(entry.timer_started_at).getTime()
      const tick = () => {
        setDisplayMs(Math.max(0, Date.now() - startedAt))
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    }
    setDisplayMs(entry.time_ms ?? 0)
  }, [running, entry.timer_started_at, entry.time_ms])

  async function start() {
    if (busy) return
    setBusy(true)
    onLocalChange({ timer_running: true, timer_started_at: new Date().toISOString(), status: 'active' })
    await timerStart(supabase, entry.id)
    setBusy(false)
  }

  async function stop() {
    if (busy) return
    setBusy(true)
    const { data } = await timerStop(supabase, entry.id)
    const row = (data as RiseEntry | null)
    onLocalChange({ timer_running: false, status: 'done', time_ms: row?.time_ms ?? displayMs })
    setBusy(false)
  }

  async function reset() {
    if (busy) return
    setBusy(true)
    onLocalChange({ timer_running: false, timer_started_at: null, time_ms: null, status: 'pending' })
    await supabase
      .from('rise_entries')
      .update({ timer_running: false, timer_started_at: null, time_ms: null, status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', entry.id)
    setBusy(false)
  }

  const finished = !running && entry.time_ms != null

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none">
      <JudgeHeader eventName={event.name} label={label} right={goalWord} onBack={onBack} />

      {/* Clock */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <p
          className={`text-[18vw] sm:text-[120px] leading-none font-black tabular-nums tracking-tight ${
            running ? 'text-white' : finished ? 'text-[#2f5fe0]' : 'text-zinc-600'
          }`}
        >
          {formatMs(running ? displayMs : entry.time_ms ?? 0)}
        </p>
        <p className="text-zinc-600 text-xs uppercase tracking-[0.3em] mt-3">
          {running ? 'Running' : finished ? 'Recorded' : 'Ready'}
        </p>
      </div>

      {/* Controls */}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {!running ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={start}
              disabled={busy}
              className="w-full h-32 flex items-center justify-center gap-4 bg-[#2f5fe0] active:bg-[#2348b8] disabled:opacity-60 text-white font-black text-3xl rounded-3xl transition-colors"
            >
              <Play size={40} fill="currentColor" />
              {finished ? 'RESTART' : 'START'}
            </button>
            {finished && (
              <button
                onClick={reset}
                disabled={busy}
                className="w-full h-14 flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 active:bg-zinc-800 text-zinc-400 font-semibold rounded-2xl transition-colors"
              >
                <RotateCcw size={18} />
                Clear time
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={stop}
            disabled={busy}
            className="w-full h-32 flex items-center justify-center gap-4 bg-zinc-100 active:bg-white disabled:opacity-60 text-zinc-950 font-black text-3xl rounded-3xl transition-colors"
          >
            <Square size={36} fill="currentColor" />
            STOP
          </button>
        )}
      </div>
    </div>
  )
}
