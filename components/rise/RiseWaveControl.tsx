'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Play, Flag, RotateCcw, Timer, Users, FastForward } from 'lucide-react'
import { ENTRY_SELECT, timerStart, timerStop, timerResume } from '@/lib/rise'
import { formatMs, teamGenderOf, RISE_TIME_CAP_DEFAULT, RISE_WAVE_SIZE_DEFAULT } from '@/types/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseTeam } from '@/types/rise'

// Team-timed control (e.g. Hyrox): teams ordered female-first, grouped into waves.
// The operator starts a wave (both teams' timers); each team is timed to a cap and
// finished individually. Multiple waves can run at once.
export function RiseWaveControl({
  event, teams, competitors, entries, setEntries, busy, setBusy, supabase,
}: {
  event: RiseEvent
  teams: RiseTeam[]
  competitors: RiseCompetitor[]
  entries: RiseEntry[]
  setEntries: (updater: (prev: RiseEntry[]) => RiseEntry[]) => void
  busy: boolean
  setBusy: (b: boolean) => void
  supabase: SupabaseClient
}) {
  const capSec = event.config.time_cap_sec ?? RISE_TIME_CAP_DEFAULT
  const waveSize = event.config.wave_size ?? RISE_WAVE_SIZE_DEFAULT

  // Female teams first, then by display order; chunk into waves.
  const genderRank = (g: 'M' | 'F' | null) => (g === 'F' ? 0 : g === 'M' ? 1 : 2)
  const ordered = [...teams].sort(
    (a, b) =>
      genderRank(teamGenderOf(competitors, a.id)) - genderRank(teamGenderOf(competitors, b.id)) ||
      a.display_order - b.display_order,
  )
  const waves: RiseTeam[][] = []
  for (let i = 0; i < ordered.length; i += waveSize) waves.push(ordered.slice(i, i + waveSize))

  const entryFor = (teamId: string) => entries.find(e => e.team_id === teamId) ?? null

  const ensureEntry = useCallback(async (teamId: string): Promise<RiseEntry | null> => {
    const existing = entries.find(e => e.team_id === teamId)
    if (existing) return existing
    const { data } = await supabase
      .from('rise_entries')
      .insert({ event_id: event.id, team_id: teamId, status: 'pending' })
      .select(ENTRY_SELECT)
      .single()
    if (data) { setEntries(prev => [...prev, data as RiseEntry]); return data as RiseEntry }
    return null
  }, [entries, event.id, supabase, setEntries])

  async function startWave(wave: RiseTeam[]) {
    if (busy) return
    setBusy(true)
    for (const t of wave) {
      const entry = await ensureEntry(t.id)
      if (entry && !entry.timer_running && entry.time_ms == null) {
        await timerStart(supabase, entry.id)
        const now = new Date().toISOString()
        setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, timer_running: true, timer_started_at: now, status: 'active' } : e)))
      }
    }
    setBusy(false)
  }

  const finishTeam = useCallback(async (teamId: string) => {
    const entry = entries.find(e => e.team_id === teamId)
    if (!entry || !entry.timer_running) return
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, timer_running: false } : e)))
    await timerStop(supabase, entry.id)
    const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('id', entry.id).single()
    if (data) setEntries(prev => prev.map(e => (e.id === entry.id ? (data as RiseEntry) : e)))
  }, [entries, supabase, setEntries])

  // Continue a stopped team timer from its recorded time (after an accidental finish).
  async function resumeTeam(teamId: string) {
    const entry = entries.find(e => e.team_id === teamId)
    if (!entry || entry.time_ms == null) return
    const priorMs = entry.time_ms
    const startedAt = new Date(Date.now() - priorMs).toISOString()
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, timer_running: true, timer_started_at: startedAt, time_ms: null, status: 'active' } : e)))
    await timerResume(supabase, entry.id, priorMs)
  }

  async function resetTeam(teamId: string) {
    const entry = entries.find(e => e.team_id === teamId)
    if (!entry) return
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, time_ms: null, timer_running: false, timer_started_at: null, status: 'pending' } : e)))
    await supabase.from('rise_entries').update({ time_ms: null, timer_running: false, timer_started_at: null, status: 'pending' }).eq('id', entry.id)
  }

  // Auto-finish a team whose timer reaches the cap.
  const capRef = useRef(finishTeam)
  capRef.current = finishTeam
  useEffect(() => {
    const id = setInterval(() => {
      for (const e of entries) {
        if (e.timer_running && e.timer_started_at) {
          const elapsed = Date.now() - new Date(e.timer_started_at).getTime()
          if (elapsed >= capSec * 1000 && e.team_id) capRef.current(e.team_id)
        }
      }
    }, 1000)
    return () => clearInterval(id)
  }, [entries, capSec])

  if (teams.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <Users size={28} className="text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">No teams yet. Create teams and assign athletes on the event page, then run waves here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-zinc-300">
          <Timer size={16} className="text-[#4d7bff]" />
          <span className="text-sm font-semibold">Wave control</span>
        </div>
        <span className="text-xs text-zinc-500">
          {waveSize} teams / wave · {Math.round(capSec / 60)} min cap · female teams first
        </span>
      </div>

      {waves.map((wave, wi) => {
        const anyRunning = wave.some(t => entryFor(t.id)?.timer_running)
        const allStarted = wave.every(t => { const e = entryFor(t.id); return e && (e.timer_running || e.time_ms != null) })
        return (
          <div key={wi} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Wave {wi + 1}</span>
              {!allStarted && (
                <button
                  onClick={() => startWave(wave)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  <Play size={14} /> {anyRunning ? 'Start remaining' : 'Start wave'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wave.map(t => (
                <TeamTimerCard
                  key={t.id}
                  team={t}
                  gender={teamGenderOf(competitors, t.id)}
                  entry={entryFor(t.id)}
                  capSec={capSec}
                  onFinish={() => finishTeam(t.id)}
                  onResume={() => resumeTeam(t.id)}
                  onReset={() => resetTeam(t.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TeamTimerCard({
  team, gender, entry, capSec, onFinish, onResume, onReset,
}: {
  team: RiseTeam
  gender: 'M' | 'F' | null
  entry: RiseEntry | null
  capSec: number
  onFinish: () => void
  onResume: () => void
  onReset: () => void
}) {
  const done = entry?.time_ms != null
  const running = !!entry?.timer_running
  return (
    <div className={`rounded-xl border p-4 ${done ? 'border-green-500/40 bg-green-500/5' : running ? 'border-[#2f5fe0]/50 bg-[#102047]' : 'border-zinc-800 bg-zinc-900'}`}>
      <div className="flex items-center gap-2 mb-2">
        {gender && <span className={`text-[10px] font-bold ${gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{gender}</span>}
        <span className="font-bold text-white truncate">{team.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-black tabular-nums text-white">
          {running && entry?.timer_started_at
            ? <LiveClock startedAt={entry.timer_started_at} capSec={capSec} />
            : done ? formatMs(entry!.time_ms) : <span className="text-zinc-700">—</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {running && (
            <button onClick={onFinish} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg transition-colors">
              <Flag size={13} /> Finish
            </button>
          )}
          {done && (
            <button onClick={onResume} title="Resume from this time" className="flex items-center gap-1 px-3 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] text-white text-xs font-semibold rounded-lg transition-colors">
              <FastForward size={13} /> Resume
            </button>
          )}
          {(done || running) && (
            <button onClick={onReset} title="Reset" className="text-zinc-500 hover:text-white p-1.5"><RotateCcw size={14} /></button>
          )}
        </div>
      </div>
    </div>
  )
}

function LiveClock({ startedAt, capSec }: { startedAt: string; capSec: number }) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const start = new Date(startedAt).getTime()
    const tick = () => setMs(Math.min(capSec * 1000, Date.now() - start))
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [startedAt, capSec])
  return <span className={ms >= capSec * 1000 ? 'text-amber-400' : 'text-[#4d7bff]'}>{formatMs(ms)}</span>
}
