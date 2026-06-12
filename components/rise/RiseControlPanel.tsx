'use client'

import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Play, Flag, ListPlus, RotateCcw, AlertTriangle, UserCheck, Search, Save, Pencil, Venus } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { ENTRY_SELECT, adjustCounter } from '@/lib/rise'
import { rankEntries, entryValue, formatMs } from '@/types/rise'
import { RiseWaveControl } from './RiseWaveControl'
import { eventShowsWomen } from './RiseLeaderboard'
import type {
  RiseCompetitor, RiseEntry, RiseEvent, RiseRound, RiseScoringMode, RiseStatus, RiseTeam,
} from '@/types/rise'

export function RiseControlPanel({
  event: initialEvent,
  teams,
  rounds: initialRounds,
  competitors,
  initialEntries,
}: {
  event: RiseEvent
  teams: RiseTeam[]
  rounds: RiseRound[]
  competitors: RiseCompetitor[]
  initialEntries: RiseEntry[]
}) {
  const supabase = createClient()
  const [event, setEvent] = useState(initialEvent)
  const [rounds, setRounds] = useState(initialRounds)
  const [entries, setEntries] = useState(initialEntries)
  const [busy, setBusy] = useState(false)

  async function refetch() {
    const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', event.id)
    if (data) setEntries(data as RiseEntry[])
  }

  useEffect(() => {
    const channel = supabase
      .channel(`rise-control-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_entries', filter: `event_id=eq.${event.id}` }, refetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event.id])

  async function setStatus(status: RiseStatus) {
    setEvent(prev => ({ ...prev, status }))
    await supabase.from('rise_events').update({ status }).eq('id', event.id)
  }

  async function resetEvent() {
    if (busy) return
    if (!window.confirm(
      'Reset this event?\n\nThis permanently clears ALL scores, timers, counters and round progress for this event. Athletes, teams and judge links are kept.\n\nThis cannot be undone.'
    )) return
    setBusy(true)
    await supabase.from('rise_entries').delete().eq('event_id', event.id)
    await supabase.from('rise_rounds').update({ status: 'pending' }).eq('event_id', event.id)
    await supabase.from('rise_events').update({ status: 'setup' }).eq('id', event.id)
    setEntries([])
    setRounds(prev => prev.map(r => ({ ...r, status: 'pending' })))
    setEvent(prev => ({ ...prev, status: 'setup' }))
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <StatusBar event={event} onSet={setStatus} onReset={resetEvent} busy={busy} />
      {!event.is_team && !event.config.team_timed && (
        <WomenColumnPanel event={event} setEvent={setEvent} supabase={supabase} />
      )}
      <AttendancePanel
        supabase={supabase}
        eventId={event.id}
        teams={teams}
        isTeam={event.is_team}
        initialCompetitors={competitors}
      />
      {event.is_team ? (
        <TeamControl
          event={event}
          teams={teams}
          rounds={rounds}
          setRounds={setRounds}
          entries={entries}
          setEntries={setEntries}
          busy={busy}
          setBusy={setBusy}
          supabase={supabase}
        />
      ) : event.config.team_timed ? (
        <RiseWaveControl
          event={event}
          teams={teams}
          competitors={competitors}
          entries={entries}
          setEntries={setEntries}
          busy={busy}
          setBusy={setBusy}
          supabase={supabase}
        />
      ) : (
        <IndividualControl
          event={event}
          competitors={competitors}
          entries={entries}
          setEntries={setEntries}
          busy={busy}
          setBusy={setBusy}
          supabase={supabase}
        />
      )}
      <ScoreOverridePanel
        event={event}
        entries={entries}
        setEntries={setEntries}
        supabase={supabase}
      />
    </div>
  )
}

function StatusBar({ event, onSet, onReset, busy }: { event: RiseEvent; onSet: (s: RiseStatus) => void; onReset: () => void; busy: boolean }) {
  const opts: RiseStatus[] = ['setup', 'live', 'ended']
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div>
        <h1 className="text-lg font-bold text-white">{event.name}</h1>
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Live control room</p>
      </div>
      <div className="flex items-center gap-1.5">
        {opts.map(s => (
          <button
            key={s}
            onClick={() => onSet(s)}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold uppercase tracking-wider transition-colors ${
              event.status === s
                ? s === 'live' ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-[#2f5fe0] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={onReset}
          disabled={busy}
          className="ml-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold uppercase tracking-wider bg-red-950/60 text-red-400 border border-red-900/60 hover:bg-red-900/50 disabled:opacity-50 transition-colors"
          title="Clear all scores and round progress for this event"
        >
          <AlertTriangle size={13} />
          Reset
        </button>
      </div>
    </div>
  )
}

// ── Leaderboard display: women's column toggle ──────────────
function WomenColumnPanel({
  event, setEvent, supabase,
}: {
  event: RiseEvent
  setEvent: (updater: (prev: RiseEvent) => RiseEvent) => void
  supabase: SupabaseClient
}) {
  const [saving, setSaving] = useState(false)
  const showWomen = eventShowsWomen(event)

  async function toggle() {
    if (saving) return
    const next = !showWomen
    setSaving(true)
    setEvent(prev => ({ ...prev, config: { ...prev.config, show_women_on_leaderboard: next } }))
    const { error } = await supabase
      .from('rise_events')
      .update({ config: { ...event.config, show_women_on_leaderboard: next } })
      .eq('id', event.id)
    if (error) setEvent(prev => ({ ...prev, config: { ...prev.config, show_women_on_leaderboard: showWomen } }))
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <Venus size={16} className="text-pink-400" />
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Women&apos;s column</h2>
          <p className="text-xs text-zinc-500">Show a separate women&apos;s leaderboard for this event.</p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={showWomen}
        aria-label="Show women's column on the leaderboard"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${showWomen ? 'bg-[#2f5fe0]' : 'bg-zinc-700'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showWomen ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

// ── RISE (team) control ─────────────────────────────────────
function ScoreOverridePanel({
  event, entries, setEntries, supabase,
}: {
  event: RiseEvent
  entries: RiseEntry[]
  setEntries: (updater: (prev: RiseEntry[]) => RiseEntry[]) => void
  supabase: SupabaseClient
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...entries]
      .filter(entry => {
        const label = entryLabel(entry).toLowerCase()
        return !needle || label.includes(needle)
      })
      .sort((a, b) => entryLabel(a).localeCompare(entryLabel(b)))
  }, [entries, q])

  function draftFor(entry: RiseEntry) {
    return drafts[entry.id] ?? overrideInputValue(entry, event.scoring_mode)
  }

  async function saveOverride(entry: RiseEntry) {
    setError(null)
    const parsed = scorePatchFromInput(event.scoring_mode, draftFor(entry))
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }

    const patch = { ...parsed.patch, updated_at: new Date().toISOString() }
    setSavingId(entry.id)
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, ...patch } : e)))
    const { error: updateError } = await supabase.from('rise_entries').update(patch).eq('id', entry.id)
    if (updateError) {
      setError(updateError.message)
      await refetchEntry(supabase, entry.id, setEntries)
    } else {
      setDrafts(prev => {
        const next = { ...prev }
        delete next[entry.id]
        return next
      })
    }
    setSavingId(null)
  }

  async function clearScore(entry: RiseEntry) {
    setError(null)
    const patch = clearPatchForMode(event.scoring_mode)
    setSavingId(entry.id)
    setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, ...patch } : e)))
    const { error: updateError } = await supabase.from('rise_entries').update(patch).eq('id', entry.id)
    if (updateError) {
      setError(updateError.message)
      await refetchEntry(supabase, entry.id, setEntries)
    } else {
      setDrafts(prev => ({ ...prev, [entry.id]: '' }))
    }
    setSavingId(null)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Pencil size={16} className="text-[#4d7bff]" />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Manual score override</h2>
        </div>
        <span className="text-xs text-zinc-500">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">
              Set an exact {scoreLabel(event.scoring_mode)}. Overrides stop running timers and mark the score done.
            </p>
            {entries.length > 6 && (
              <div className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 sm:w-64">
                <Search size={15} className="text-zinc-500" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Search score..."
                  className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">
              {entries.length === 0 ? 'No score entries exist yet.' : 'No matching scores.'}
            </p>
          ) : (
            <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 overflow-hidden">
              {rows.map(entry => (
                <div key={entry.id} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 bg-zinc-950/30 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{entryLabel(entry)}</p>
                    <p className="text-xs text-zinc-500">
                      Current: <span className="text-zinc-300 tabular-nums">{entryValue(entry, event.scoring_mode, event.unit)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={draftFor(entry)}
                      onChange={e => setDrafts(prev => ({ ...prev, [entry.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveOverride(entry) }}
                      placeholder={scorePlaceholder(event.scoring_mode)}
                      inputMode={event.scoring_mode === 'time_fastest' || event.scoring_mode === 'time_longest' ? 'decimal' : 'numeric'}
                      className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white text-right tabular-nums outline-none focus:border-[#2f5fe0]"
                    />
                    <button
                      onClick={() => saveOverride(entry)}
                      disabled={savingId === entry.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white rounded-lg font-semibold text-xs transition-colors"
                    >
                      <Save size={14} /> Save
                    </button>
                    <button
                      onClick={() => clearScore(entry)}
                      disabled={savingId === entry.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg font-semibold text-xs transition-colors"
                    >
                      <RotateCcw size={14} /> Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function entryLabel(entry: RiseEntry): string {
  return entry.team?.name ?? entry.competitor?.name ?? 'Unassigned entry'
}

function scoreLabel(mode: RiseScoringMode): string {
  if (mode === 'measure_max') return 'measurement'
  if (mode === 'time_fastest' || mode === 'time_longest') return 'time'
  return 'rep count'
}

function scorePlaceholder(mode: RiseScoringMode): string {
  if (mode === 'measure_max') return '125.5'
  if (mode === 'time_fastest' || mode === 'time_longest') return '1:23.45'
  return '42'
}

function overrideInputValue(entry: RiseEntry, mode: RiseScoringMode): string {
  if (mode === 'measure_max') return entry.measure_value == null ? '' : String(entry.measure_value)
  if (mode === 'time_fastest' || mode === 'time_longest') return entry.time_ms == null ? '' : formatMs(entry.time_ms)
  return entry.counter ? String(entry.counter) : ''
}

function scorePatchFromInput(mode: RiseScoringMode, input: string):
  | { ok: true; patch: Partial<RiseEntry> }
  | { ok: false; message: string } {
  const raw = input.trim()
  if (!raw) return { ok: false, message: 'Enter a score before saving.' }

  if (mode === 'time_fastest' || mode === 'time_longest') {
    const ms = parseTimeInput(raw)
    if (ms == null) return { ok: false, message: 'Use seconds or m:ss.xx for time overrides.' }
    return { ok: true, patch: { time_ms: ms, timer_running: false, timer_started_at: null, status: 'done' } }
  }

  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return { ok: false, message: 'Score must be a positive number.' }
  if (mode === 'measure_max') return { ok: true, patch: { measure_value: value, status: 'done' } }
  return { ok: true, patch: { counter: Math.floor(value), status: 'done' } }
}

function parseTimeInput(input: string): number | null {
  const parts = input.split(':').map(part => part.trim())
  if (parts.some(part => part === '')) return null
  let seconds = 0
  if (parts.length === 1) {
    seconds = Number(parts[0])
  } else {
    for (let i = 0; i < parts.length; i += 1) {
      const value = Number(parts[i])
      if (!Number.isFinite(value) || value < 0) return null
      seconds = seconds * 60 + value
    }
  }
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Math.round(seconds * 1000)
}

function clearPatchForMode(mode: RiseScoringMode): Partial<RiseEntry> {
  const updated_at = new Date().toISOString()
  if (mode === 'measure_max') return { measure_value: null, status: 'pending', updated_at }
  if (mode === 'time_fastest' || mode === 'time_longest') {
    return { time_ms: null, timer_running: false, timer_started_at: null, status: 'pending', updated_at }
  }
  return { counter: 0, status: 'pending', updated_at }
}

async function refetchEntry(
  supabase: SupabaseClient,
  entryId: string,
  setEntries: (updater: (prev: RiseEntry[]) => RiseEntry[]) => void
) {
  const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('id', entryId).single()
  if (data) setEntries(prev => prev.map(e => (e.id === entryId ? (data as RiseEntry) : e)))
}

// RISE team control
function TeamControl({
  event, teams, rounds, setRounds, entries, setEntries, busy, setBusy, supabase,
}: any) {
  const ev = event as RiseEvent
  const roundList = rounds as RiseRound[]
  const allEntries = entries as RiseEntry[]
  const qual = roundList.find(r => r.name.toLowerCase().includes('qual'))
  const final = roundList.find(r => r.name.toLowerCase().includes('final'))
  const chipper = ev.config.chipper ?? { mu: 0, pu: 0, dips: 0 }
  const [chip, setChip] = useState(chipper)

  async function setRoundStatus(roundId: string, status: 'pending' | 'active' | 'done') {
    setRounds((prev: RiseRound[]) => prev.map(r => (r.id === roundId ? { ...r, status } : r)))
    await supabase.from('rise_rounds').update({ status }).eq('id', roundId)
  }

  async function startQual() {
    if (!qual || busy) return
    setBusy(true)
    // Create a team entry for each team if missing
    const existing = new Set(allEntries.filter(e => e.round_id === qual.id).map(e => e.team_id))
    const inserts = (teams as RiseTeam[])
      .filter(t => !existing.has(t.id))
      .map(t => ({ event_id: ev.id, round_id: qual.id, team_id: t.id, counter: 0, status: 'active' }))
    if (inserts.length) await supabase.from('rise_entries').insert(inserts)
    if (final) await setRoundStatus(final.id, 'pending')
    await setRoundStatus(qual.id, 'active')
    const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', ev.id)
    if (data) setEntries(data as RiseEntry[])
    setBusy(false)
  }

  async function advanceToFinal() {
    if (!final || !qual || busy) return
    setBusy(true)
    // Save chipper config
    await supabase.from('rise_events').update({ config: { ...ev.config, chipper: chip } }).eq('id', ev.id)
    // Top 2 teams by qual counter
    const qualEntries = allEntries.filter(e => e.round_id === qual.id).sort((a, b) => b.counter - a.counter)
    const top2 = qualEntries.slice(0, 2)
    const existing = new Set(allEntries.filter(e => e.round_id === final.id).map(e => e.team_id))
    const inserts = top2
      .filter(e => e.team_id && !existing.has(e.team_id))
      .map(e => ({ event_id: ev.id, round_id: final.id, team_id: e.team_id, counter: 0, phase: 'chipper', status: 'active' }))
    if (inserts.length) await supabase.from('rise_entries').insert(inserts)
    await setRoundStatus(qual.id, 'done')
    await setRoundStatus(final.id, 'active')
    const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', ev.id)
    if (data) setEntries(data as RiseEntry[])
    setBusy(false)
  }

  async function override(entry: RiseEntry, delta: number) {
    setEntries((prev: RiseEntry[]) => prev.map(e => (e.id === entry.id ? { ...e, counter: Math.max(0, e.counter + delta) } : e)))
    await adjustCounter(supabase, entry.id, delta)
  }

  const activeRound = roundList.find(r => r.status === 'active') ?? qual
  const roundEntries = allEntries
    .filter(e => e.round_id === activeRound?.id)
    .sort((a, b) => b.counter - a.counter)

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Round Flow</h2>
        <div className="flex flex-wrap gap-3 items-center">
          <button onClick={startQual} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors">
            <Play size={16} /> Start Qualification (3:00)
          </button>
          <span className="text-zinc-600">→</span>
          <div className="flex items-center gap-2">
            {(['mu', 'pu', 'dips'] as const).map(k => (
              <label key={k} className="flex items-center gap-1 text-xs text-zinc-400">
                {k.toUpperCase()}
                <input
                  type="number"
                  value={(chip as any)[k]}
                  onChange={e => setChip({ ...chip, [k]: Number(e.target.value) })}
                  className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white outline-none focus:border-[#2f5fe0]"
                />
              </label>
            ))}
          </div>
          <button onClick={advanceToFinal} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-950 rounded-lg font-semibold text-sm transition-colors">
            <Flag size={16} /> Advance Top 2 → Final (6:00)
          </button>
        </div>
        {activeRound && <p className="text-xs text-zinc-500 mt-3">Active round: <span className="text-[#2f5fe0] font-semibold">{activeRound.name}</span></p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {roundEntries.length === 0 ? (
          <p className="text-zinc-500 text-sm col-span-full text-center py-8">Start a round to create team counters.</p>
        ) : (
          roundEntries.map((e, i) => (
            <div key={e.id} className={`rounded-xl border p-4 ${i === 0 ? 'border-[#2f5fe0]/50 bg-[#102047]' : 'border-zinc-800 bg-zinc-900'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-white">{e.team?.name ?? 'Team'}</span>
                {e.phase && <span className="text-[10px] uppercase tracking-widest text-zinc-500">{e.phase}</span>}
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => override(e, -1)} className="h-12 w-12 flex items-center justify-center bg-zinc-800 active:bg-zinc-700 rounded-lg text-white"><Minus size={20} /></button>
                <span className="text-5xl font-black tabular-nums text-[#2f5fe0]">{e.counter}</span>
                <button onClick={() => override(e, 1)} className="h-12 w-12 flex items-center justify-center bg-[#2f5fe0] active:bg-[#2348b8] rounded-lg text-white"><Plus size={20} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// ── Attendance / check-in ───────────────────────────────────
function AttendancePanel({
  supabase, eventId, teams, isTeam, initialCompetitors,
}: {
  supabase: SupabaseClient
  eventId: string
  teams: RiseTeam[]
  isTeam: boolean
  initialCompetitors: RiseCompetitor[]
}) {
  const [comps, setComps] = useState<RiseCompetitor[]>(initialCompetitors)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  // Reflect check-ins from other devices and auto-attendance (recorded scores) live.
  useEffect(() => {
    const channel = supabase
      .channel(`rise-attendance-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_competitors', filter: `event_id=eq.${eventId}` }, payload => {
        const row = payload.new as RiseCompetitor
        if (!row?.id) return
        setComps(prev => prev.map(c => (c.id === row.id ? { ...c, checked_in: row.checked_in, checked_in_at: row.checked_in_at, team_id: row.team_id } : c)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId])

  const present = comps.filter(c => c.checked_in).length

  async function toggle(c: RiseCompetitor) {
    const next = !c.checked_in
    const checked_in_at = next ? new Date().toISOString() : null
    setComps(prev => prev.map(x => (x.id === c.id ? { ...x, checked_in: next, checked_in_at } : x)))
    await supabase.from('rise_competitors').update({ checked_in: next, checked_in_at }).eq('id', c.id)
  }

  const filtered = useMemo(
    () => comps.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [comps, q]
  )
  const teamName = (id: string | null) => teams.find(t => t.id === id)?.name ?? 'No team'

  // Group by team for team events; otherwise one flat list.
  const groups: { key: string; label: string | null; list: RiseCompetitor[] }[] = isTeam
    ? teams.map(t => ({ key: t.id, label: t.name, list: filtered.filter(c => c.team_id === t.id) }))
    : [{ key: 'all', label: null, list: filtered }]

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-green-400" />
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Check-in</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums">
            <span className="text-green-400 font-bold">{present}</span>
            <span className="text-zinc-500"> / {comps.length} present</span>
          </span>
          <span className="text-xs text-zinc-500">{open ? 'Hide' : 'Show'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {comps.length > 8 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3">
              <Search size={15} className="text-zinc-500" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search athlete…"
                className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              />
            </div>
          )}
          <div className="space-y-3">
            {groups.map(g => (
              <div key={g.key}>
                {g.label && <p className="text-xs font-bold text-[#4d7bff] mb-1.5">{g.label}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {g.list.map(c => (
                    <button
                      key={c.id}
                      onClick={() => toggle(c)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                        c.checked_in
                          ? 'bg-green-500/10 border-green-500/40 text-white'
                          : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center h-5 w-5 rounded-full border shrink-0 ${
                          c.checked_in ? 'bg-green-500 border-green-500 text-zinc-950' : 'border-zinc-600'
                        }`}
                      >
                        {c.checked_in && <UserCheck size={12} />}
                      </span>
                      <span className={`text-[10px] font-bold w-3 ${c.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{c.gender}</span>
                      <span className="flex-1 min-w-0 text-sm truncate">{c.name}</span>
                      {isTeam && !g.label && <span className="text-[10px] text-zinc-600">{teamName(c.team_id)}</span>}
                    </button>
                  ))}
                  {g.list.length === 0 && (
                    <p className="text-xs text-zinc-600 py-1">No athletes{g.label ? ' on this team' : ''}.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Individual control ──────────────────────────────────────
function IndividualControl({
  event, competitors, entries, setEntries, busy, setBusy, supabase,
}: any) {
  const ev = event as RiseEvent
  const comps = competitors as RiseCompetitor[]
  const allEntries = entries as RiseEntry[]

  async function addAll() {
    setBusy(true)
    const have = new Set(allEntries.map(e => e.competitor_id))
    const inserts = comps.filter(c => !have.has(c.id)).map(c => ({ event_id: ev.id, competitor_id: c.id, status: 'pending' }))
    if (inserts.length) await supabase.from('rise_entries').insert(inserts)
    const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', ev.id)
    if (data) setEntries(data as RiseEntry[])
    setBusy(false)
  }

  async function clearEntry(entry: RiseEntry) {
    setEntries((prev: RiseEntry[]) => prev.map(e => (e.id === entry.id ? { ...e, counter: 0, time_ms: null, measure_value: null, timer_running: false, timer_started_at: null, status: 'pending' } : e)))
    await supabase.from('rise_entries').update({ counter: 0, time_ms: null, measure_value: null, timer_running: false, timer_started_at: null, status: 'pending' }).eq('id', entry.id)
  }

  const ranked = rankEntries(allEntries, ev.scoring_mode)

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Scoring</h2>
          <p className="text-xs text-zinc-500 mt-1">Judges score via the judge link. This is the live mirror — clear a result to let an athlete re-attempt.</p>
        </div>
        <button onClick={addAll} disabled={busy} className="flex items-center gap-2 px-4 py-2.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition-colors shrink-0">
          <ListPlus size={16} /> Add all athletes to board
        </button>
      </div>

      {ranked.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-8">No athletes on the board yet.</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {ranked.map((e, i) => {
            const done = ev.scoring_mode === 'reps' ? e.counter > 0 : ev.scoring_mode === 'measure_max' ? e.measure_value != null : e.time_ms != null
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-sm text-zinc-500 tabular-nums">{done ? i + 1 : '—'}</span>
                <span className={`text-[10px] font-bold w-4 ${e.competitor?.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{e.competitor?.gender}</span>
                <span className="flex-1 min-w-0 text-white truncate">{e.competitor?.name}</span>
                <span className="font-black tabular-nums text-[#2f5fe0]">{done || e.timer_running ? entryValue(e, ev.scoring_mode, ev.unit) : <span className="text-zinc-700">—</span>}</span>
                {done && (
                  <button onClick={() => clearEntry(e)} className="text-zinc-500 hover:text-white p-1" title="Clear result"><RotateCcw size={15} /></button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
