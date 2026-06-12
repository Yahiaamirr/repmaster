'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const DEFAULT_LIFTS = ['MU', 'PU', 'Dips', 'Squat']
const DEFAULT_CATEGORIES = [
  { name: 'Female', display_order: 0 },
  { name: '-66', display_order: 1 },
  { name: '-73', display_order: 2 },
  { name: '-80', display_order: 3 },
  { name: '-87', display_order: 4 },
  { name: '-94', display_order: 5 },
  { name: '-101', display_order: 5 },  // same order = grouped in flights
]

export default function NewTournamentPage() {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [flightSize, setFlightSize] = useState(8)
  const [judgesPerAttempt, setJudgesPerAttempt] = useState(1)
  const [days, setDays] = useState(2)
  const [lifts, setLifts] = useState(DEFAULT_LIFTS)
  const [newLift, setNewLift] = useState('')
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES)
  const [newCatName, setNewCatName] = useState('')
  const [newCatOrder, setNewCatOrder] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Tournament name is required'); return }
    setSaving(true)
    setError('')

    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
        '-' + Date.now().toString(36)

      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({ name: name.trim(), slug, date_start: dateStart || null, date_end: dateEnd || null, flight_size: flightSize, judges_per_attempt: judgesPerAttempt })
        .select('id')
        .single()

      if (tErr) throw tErr

      // Insert event types
      if (lifts.length > 0) {
        const { error: liftErr } = await supabase.from('event_types').insert(
          lifts.map((name, i) => ({ tournament_id: tournament.id, name, display_order: i }))
        )
        if (liftErr) throw liftErr
      }

      // Insert categories
      if (categories.length > 0) {
        const { error: catErr } = await supabase.from('categories').insert(
          categories.map(c => ({ tournament_id: tournament.id, name: c.name, display_order: c.display_order }))
        )
        if (catErr) throw catErr
      }

      // Create platform_state row
      await supabase.from('platform_state').insert({ tournament_id: tournament.id })

      router.push(`/admin/tournaments/${tournament.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/tournaments" className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Tournament</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Configure your competition</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <Section title="Basic Info">
          <Field label="Tournament Name">
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. RAGE WAR Egypt 2026"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <input className="input" type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </Field>
            <Field label="End Date">
              <input className="input" type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Competition Days">
              <select className="input" value={days} onChange={e => setDays(Number(e.target.value))}>
                <option value={1}>1 Day</option>
                <option value={2}>2 Days</option>
                <option value={3}>3 Days</option>
              </select>
            </Field>
            <Field label="Athletes per Flight">
              <input className="input" type="number" min={4} max={20} value={flightSize} onChange={e => setFlightSize(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Judges per Attempt">
            <select className="input" value={judgesPerAttempt} onChange={e => setJudgesPerAttempt(Number(e.target.value))}>
              <option value={1}>1 Judge</option>
              <option value={2}>2 Judges (majority)</option>
              <option value={3}>3 Judges (majority)</option>
            </select>
          </Field>
        </Section>

        {/* Lifts */}
        <Section title="Lifts / Events">
          <p className="text-zinc-400 text-sm mb-3">Drag to reorder. These define the scoring columns.</p>
          <div className="space-y-2 mb-3">
            {lifts.map((lift, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm font-medium">{lift}</span>
                <button type="button" onClick={() => setLifts(l => l.filter((_, j) => j !== i))}
                  className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Add lift (e.g. Muscle Up)"
              value={newLift}
              onChange={e => setNewLift(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); if (newLift.trim()) { setLifts(l => [...l, newLift.trim()]); setNewLift('') } }
              }}
            />
            <button type="button" onClick={() => { if (newLift.trim()) { setLifts(l => [...l, newLift.trim()]); setNewLift('') } }}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </Section>

        {/* Categories */}
        <Section title="Weight Categories">
          <p className="text-zinc-400 text-sm mb-3">
            Categories with the same <strong>Group Order</strong> are sorted together in flights (e.g. -94 and -101 compete as one group).
          </p>
          <div className="space-y-2 mb-3">
            {categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm font-medium">{cat.name}</span>
                <span className="text-xs text-zinc-500 w-16 text-right">order: {cat.display_order}</span>
                <button type="button" onClick={() => setCategories(c => c.filter((_, j) => j !== i))}
                  className="text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Category name (e.g. -80)"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
            />
            <input
              className="input w-20 text-sm"
              type="number"
              min={0}
              placeholder="order"
              value={newCatOrder}
              onChange={e => setNewCatOrder(Number(e.target.value))}
            />
            <button type="button"
              onClick={() => {
                if (newCatName.trim()) {
                  setCategories(c => [...c, { name: newCatName.trim(), display_order: newCatOrder }])
                  setNewCatName('')
                }
              }}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors">
              <Plus size={16} />
            </button>
          </div>
        </Section>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          {saving ? 'Creating...' : 'Create Tournament'}
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
          border-color: #7c3aed;
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">{title}</h2>
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
