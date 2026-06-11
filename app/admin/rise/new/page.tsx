'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { RiseEvent, RiseRound, RiseScoringMode } from '@/types/rise'

const SCORING_MODES: { value: RiseScoringMode; label: string }[] = [
  { value: 'reps', label: 'Most reps' },
  { value: 'time_fastest', label: 'Fastest time' },
  { value: 'time_longest', label: 'Longest time' },
  { value: 'measure_max', label: 'Highest measure' },
]

function defaultUnit(mode: RiseScoringMode): string {
  switch (mode) {
    case 'reps': return 'reps'
    case 'time_fastest':
    case 'time_longest': return 'sec'
    case 'measure_max': return 'cm'
  }
}

type RoundRow = { name: string; duration_sec: number | null }

export default function NewRiseEventPage() {
  const router = useRouter()
  const supabase = createClient()

  const [startFrom, setStartFrom] = useState<'blank' | 'copy'>('blank')
  const [existing, setExisting] = useState<Pick<RiseEvent, 'id' | 'name' | 'slug'>[]>([])
  const [sourceId, setSourceId] = useState('')

  const [name, setName] = useState('')
  const [isTeam, setIsTeam] = useState(false)
  const [scoringMode, setScoringMode] = useState<RiseScoringMode>('reps')
  const [unit, setUnit] = useState('reps')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [rounds, setRounds] = useState<RoundRow[]>([{ name: 'Qualification', duration_sec: null }])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load existing events for the "Copy from" picker.
  useEffect(() => {
    supabase
      .from('rise_events')
      .select('id, name, slug')
      .order('display_order')
      .then(({ data }) => setExisting((data as Pick<RiseEvent, 'id' | 'name' | 'slug'>[] | null) ?? []))
  }, [supabase])

  // When scoring mode changes on a blank form, follow with the suggested unit.
  function changeScoringMode(mode: RiseScoringMode) {
    setScoringMode(mode)
    setUnit(defaultUnit(mode))
  }

  // Prefill the whole form from an existing event's settings + rounds.
  async function loadSource(id: string) {
    setSourceId(id)
    setError('')
    if (!id) return
    const [{ data: ev }, { data: rs }] = await Promise.all([
      supabase.from('rise_events').select('*').eq('id', id).single(),
      supabase.from('rise_rounds').select('*').eq('event_id', id).order('display_order'),
    ])
    if (ev) {
      const e = ev as RiseEvent
      setIsTeam(e.is_team)
      setScoringMode(e.scoring_mode)
      setUnit(e.unit)
      setConfig(e.config ?? {})
    }
    const list = (rs as RiseRound[] | null) ?? []
    setRounds(
      list.length
        ? list.map(r => ({ name: r.name, duration_sec: r.duration_sec }))
        : [{ name: 'Qualification', duration_sec: null }]
    )
    // Name is intentionally left for the user to set (must be unique).
    setName('')
  }

  function switchStartFrom(next: 'blank' | 'copy') {
    setStartFrom(next)
    setError('')
    if (next === 'blank') {
      setSourceId('')
      setConfig({})
      setRounds([{ name: 'Qualification', duration_sec: null }])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Event name is required'); return }
    if (startFrom === 'copy' && !sourceId) { setError('Pick an event to copy from'); return }
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/rise/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          is_team: isTeam,
          scoring_mode: scoringMode,
          unit: unit.trim() || defaultUnit(scoringMode),
          config,
          rounds: rounds
            .filter(r => r.name.trim())
            .map(r => ({ name: r.name.trim(), duration_sec: r.duration_sec })),
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to create event')
      router.push(`/admin/rise/${payload.slug}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <Link href="/admin/rise" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-[#4d7bff] mb-4 transition-colors">
        <ChevronLeft size={16} /> All RISE events
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">New RISE Event</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Start from scratch or copy an existing event&apos;s settings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Start from */}
        <Section title="Start From">
          <div className="grid grid-cols-2 gap-3">
            <ToggleCard active={startFrom === 'blank'} onClick={() => switchStartFrom('blank')}
              title="Blank" desc="A fresh configuration" />
            <ToggleCard active={startFrom === 'copy'} onClick={() => switchStartFrom('copy')}
              title="Copy from existing" desc="Reuse another event's settings" />
          </div>

          {startFrom === 'copy' && (
            <Field label="Copy settings from">
              <select className="input" value={sourceId} onChange={e => loadSource(e.target.value)}>
                <option value="">Select an event…</option>
                {existing.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mt-1.5">
                Scoring mode, unit, config and rounds are copied. Athletes, teams and scores are not.
              </p>
            </Field>
          )}
        </Section>

        {/* Basics */}
        <Section title="Event Details">
          <Field label="Event Name">
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Evolve Deadlift Ladder" required />
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-2 gap-3">
              <ToggleCard active={!isTeam} onClick={() => setIsTeam(false)} title="Individual" desc="Athletes register themselves" />
              <ToggleCard active={isTeam} onClick={() => setIsTeam(true)} title="Team" desc="Fixed teams & rosters" />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Scoring Mode">
              <select className="input" value={scoringMode} onChange={e => changeScoringMode(e.target.value as RiseScoringMode)}>
                {SCORING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Unit">
              <input className="input" value={unit} onChange={e => setUnit(e.target.value)} placeholder="reps / sec / cm" />
            </Field>
          </div>
        </Section>

        {/* Rounds */}
        <Section title="Rounds">
          <p className="text-zinc-400 text-sm mb-3">Each round can have an optional duration in seconds.</p>
          <div className="space-y-2 mb-3">
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <input
                  className="input flex-1 text-sm"
                  value={r.name}
                  placeholder={`Round ${i + 1}`}
                  onChange={e => setRounds(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                />
                <input
                  className="input w-28 text-sm"
                  type="number"
                  min={0}
                  placeholder="sec"
                  value={r.duration_sec ?? ''}
                  onChange={e => setRounds(rs => rs.map((x, j) => j === i ? { ...x, duration_sec: e.target.value ? Number(e.target.value) : null } : x))}
                />
                <button type="button" onClick={() => setRounds(rs => rs.filter((_, j) => j !== i))}
                  className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setRounds(rs => [...rs, { name: '', duration_sec: null }])}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm">
            <Plus size={15} /> Add round
          </button>
        </Section>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          {saving ? 'Creating…' : 'Create Event'}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          background: #1c1c1c;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 8px 12px;
          color: white;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: #2f5fe0;
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-[#4d7bff] uppercase tracking-wider mb-4">{title}</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ToggleCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border px-4 py-3 transition-colors ${
        active ? 'border-[#2f5fe0] bg-[#2f5fe0]/10' : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
      }`}
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
    </button>
  )
}
