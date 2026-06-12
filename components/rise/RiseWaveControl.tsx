'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Play, Flag, RotateCcw, Timer, Users, FastForward, Ban, Plus, Minus } from 'lucide-react'
import { ENTRY_SELECT, timerStart, timerStop, timerResume } from '@/lib/rise'
import {
  formatMs, formatPenalty, teamGenderOf, entryPenaltyMs, entryIsDnf, entryFinalMs,
  RISE_TIME_CAP_DEFAULT, RISE_WAVE_SIZE_DEFAULT,
} from '@/types/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseTeam } from '@/types/rise'

// Team-timed control (e.g. Hyrox): teams ordered female-first, grouped into waves.
// The operator starts a wave, finishes each team, and can apply time penalties or
// DNF a team. A team that passes the time cap is auto-DNF'd.
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
      if (entry && !entryIsDnf(entry) && !entry.timer_running && entry.time_ms == null) {
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
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, time_ms: null, timer_running: false, timer_started_at: null, status: 'pending', meta: {} } : e)))
    await supabase.from('rise_entries').update({ time_ms: null, timer_running: false, timer_started_at: null, status: 'pending', meta: {} }).eq('id', entry.id)
  }

  const setDnf = useCallback(async (teamId: string, value: boolean) => {
    const entry = entries.find(e => e.team_id === teamId)
    if (!entry) return
    const meta = { ...(entry.meta ?? {}), dnf: value }
    const patch: Partial<RiseEntry> = { meta }
    // DNF'ing a running team: keep their time by recording elapsed (capped), then stop.
    if (value && entry.timer_running && entry.timer_started_at) {
      patch.time_ms = Math.min(capSec * 1000, Math.max(0, Date.now() - new Date(entry.timer_started_at).getTime()))
      patch.timer_running = false
      patch.status = 'done'
    }
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, ...patch } : e)))
    await supabase.from('rise_entries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', entry.id)
  }, [entries, supabase, setEntries, capSec])

  async function adjustPenalty(teamId: string, deltaMs: number) {
    const entry = entries.find(e => e.team_id === teamId)
    if (!entry) return
    const meta = { ...(entry.meta ?? {}), penalty_ms: entryPenaltyMs(entry) + deltaMs }
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, meta } : e)))
    await supabase.from('rise_entries').update({ meta, updated_at: new Date().toISOString() }).eq('id', entry.id)
  }

  // A running team that passes the time cap is auto-DNF'd.
  const dnfRef = useRef(setDnf)
  dnfRef.current = setDnf
  useEffect(() => {
    const id = setInterval(() => {
      for (const e of entries) {
        if (e.timer_running && e.timer_started_at && e.team_id && !entryIsDnf(e)) {
          if (Date.now() - new Date(e.timer_started_at).getTime() >= capSec * 1000) {
            dnfRef.current(e.team_id, true)
          }
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
          {waveSize} teams / wave · past {Math.round(capSec / 60)} min → auto-DNF · female teams first
        </span>
      </div>

      {waves.map((wave, wi) => {
        const anyRunning = wave.some(t => entryFor(t.id)?.timer_running)
        const allStarted = wave.every(t => {
          const e = entryFor(t.id)
          return e && (e.timer_running || e.time_ms != null || entryIsDnf(e))
        })
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
                  onPenalty={(delta) => adjustPenalty(t.id, delta)}
                  onDnf={(value) => setDnf(t.id, value)}
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
  team, gender, entry, capSec, onFinish, onResume, onReset, onPenalty, onDnf,
}: {
  team: RiseTeam
  gender: 'M' | 'F' | null
  entry: RiseEntry | null
  capSec: number
  onFinish: () => void
  onResume: () => void
  onReset: () => void
  onPenalty: (deltaMs: number) => void
  onDnf: (value: boolean) => void
}) {
  const dnf = entry ? entryIsDnf(entry) : false
  const penalty = entry ? entryPenaltyMs(entry) : 0
  const done = entry?.time_ms != null
  const running = !!entry?.timer_running
  const finalMs = entry ? entryFinalMs(entry) : null

  return (
    <div className={`rounded-xl border p-4 ${dnf ? 'border-red-500/40 bg-red-500/5' : done ? 'border-green-500/40 bg-green-500/5' : running ? 'border-[#2f5fe0]/50 bg-[#102047]' : 'border-zinc-800 bg-zinc-900'}`}>
      <div className="flex items-center gap-2 mb-2">
        {gender && <span className={`text-[10px] font-bold ${gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{gender}</span>}
        <span className="font-bold text-white truncate">{team.name}</span>
        {dnf && <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">DNF</span>}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <span className="text-3xl font-black tabular-nums text-white block">
            {dnf ? <span className="text-red-400 text-2xl">DNF</span>
              : running && entry?.timer_started_at ? <LiveClock startedAt={entry.timer_started_at} capSec={capSec} />
              : done ? formatMs(finalMs) : <span className="text-zinc-700">—</span>}
          </span>
          {dnf && finalMs != null && (
            <span className="text-[11px] text-zinc-400">time {formatMs(finalMs)}</span>
          )}
          {penalty !== 0 && !dnf && (
            <span className="text-[11px] text-amber-400">penalty {formatPenalty(penalty)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {running && (
            <button onClick={onFinish} className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold rounded-lg transition-colors">
              <Flag size={13} /> Finish
            </button>
          )}
          {done && !dnf && (
            <button onClick={onResume} title="Resume from this time" className="flex items-center gap-1 px-3 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] text-white text-xs font-semibold rounded-lg transition-colors">
              <FastForward size={13} /> Resume
            </button>
          )}
          {(done || running || dnf || penalty !== 0) && (
            <button onClick={onReset} title="Reset" className="text-zinc-500 hover:text-white p-1.5"><RotateCcw size={14} /></button>
          )}
        </div>
      </div>

      {/* Penalty + DNF controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
        <div className="flex items-center gap-1">
          <PenaltyBtn label="−30" onClick={() => onPenalty(-30000)} />
          <PenaltyBtn label="−5" onClick={() => onPenalty(-5000)} />
          <span className="text-xs text-zinc-500 w-3 text-center"><Minus size={11} className="inline" /></span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">pen</span>
          <span className="text-xs text-zinc-500 w-3 text-center"><Plus size={11} className="inline" /></span>
          <PenaltyBtn label="+5" onClick={() => onPenalty(5000)} />
          <PenaltyBtn label="+30" onClick={() => onPenalty(30000)} />
        </div>
        <button
          onClick={() => onDnf(!dnf)}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${dnf ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-red-950/60 text-red-400 border border-red-900/60 hover:bg-red-900/50'}`}
        >
          <Ban size={12} /> {dnf ? 'Un-DNF' : 'DNF'}
        </button>
      </div>
    </div>
  )
}

function PenaltyBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-1.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold rounded tabular-nums transition-colors">
      {label}
    </button>
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
  return <span className={ms >= capSec * 1000 ? 'text-red-400' : 'text-[#4d7bff]'}>{formatMs(ms)}</span>
}
