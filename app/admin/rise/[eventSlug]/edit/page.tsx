'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ChevronLeft, AlertTriangle } from 'lucide-react'
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

type RoundRow = { id?: string; name: string; duration_sec: number | null }

export default function EditRiseEventPage() {
  const router = useRouter()
  const supabase = createClient()
  const { eventSlug } = useParams<{ eventSlug: string }>()

  const [eventId, setEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [name, setName] = useState('')
  const [isTeam, setIsTeam] = useState(false)
  const [scoringMode, setScoringMode] = useState<RiseScoringMode>('reps')
  const [unit, setUnit] = useState('reps')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [rounds, setRounds] = useState<RoundRow[]>([])

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  // Load the event + rounds and pre-fill the form.
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: ev } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
      if (!active) return
      if (!ev) { setNotFound(true); setLoading(false); return }
      const e = ev as RiseEvent
      setEventId(e.id)
      setName(e.name)
      setIsTeam(e.is_team)
      setScoringMode(e.scoring_mode)
      setUnit(e.unit)
      setConfig(e.config ?? {})
      const { data: rs } = await supabase.from('rise_rounds').select('*').eq('event_id', e.id).order('display_order')
      if (!active) return
      setRounds(((rs as RiseRound[] | null) ?? []).map(r => ({ id: r.id, name: r.name, duration_sec: r.duration_sec })))
      setLoading(false)
    })()
    return () => { active = false }
  }, [supabase, eventSlug])

  function changeScoringMode(mode: RiseScoringMode) {
    setScoringMode(mode)
    setUnit(defaultUnit(mode))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Event name is required'); return }
    if (!eventId) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`/api/rise/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          is_team: isTeam,
          scoring_mode: scoringMode,
          unit: unit.trim() || defaultUnit(scoringMode),
          config,
          rounds: rounds
            .filter(r => r.name.trim() || r.id)
            .map(r => ({ id: r.id, name: r.name.trim(), duration_sec: r.duration_sec })),
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Failed to save changes')
      router.push(`/admin/rise/${payload.slug}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!eventId) return
    const ok = window.confirm(
      `Delete “${name}”?\n\nThis permanently removes the event and all of its athletes, teams, rounds, scores and judge links. This cannot be undone.`
    )
    if (!ok) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/rise/events/${eventId}`, { method: 'DELETE' })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || 'Failed to delete event')
      router.push('/admin/rise')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete event')
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl text-zinc-500 text-sm">Loading…</div>
  }
  if (notFound) {
    return (
      <div className="max-w-2xl">
        <Link href="/admin/rise" className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-[#4d7bff] mb-4 transition-colors">
          <ChevronLeft size={16} /> All RISE events
        </Link>
        <p className="text-zinc-300">Event not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Link href={`/admin/rise/${eventSlug}`} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-[#4d7bff] mb-4 transition-colors">
        <ChevronLeft size={16} /> Back to event
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold">Edit Event</h1>
        <p className="text-zinc-400 text-sm mt-0.5">Rename or change this event&apos;s settings. The shareable link stays the same.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
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

        <Section title="Rounds">
          <p className="text-zinc-400 text-sm mb-3">Each round can have an optional duration in seconds. Removing a round deletes its recorded scores.</p>
          <div className="space-y-2 mb-3">
            {rounds.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
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
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* Danger zone */}
      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">
          <AlertTriangle size={15} /> Danger Zone
        </h2>
        <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Delete this event</p>
            <p className="text-xs text-zinc-500 mt-0.5">Removes the event and all its athletes, teams, rounds, scores and judge links. Cannot be undone.</p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Trash2 size={15} /> {deleting ? 'Deleting…' : 'Delete Event'}
          </button>
        </div>
      </div>

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
