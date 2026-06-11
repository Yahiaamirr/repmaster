'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Category, EventType } from '@/types/database'
import { UserPlus } from 'lucide-react'

export function AddAthleteForm({
  tournamentId,
  categories,
  eventTypes,
}: {
  tournamentId: string
  categories: Category[]
  eventTypes: EventType[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [day, setDay] = useState(1)
  const [bodyWeight, setBodyWeight] = useState('')
  const [openers, setOpeners] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name required'); return }
    setSaving(true)
    setError('')

    try {
      const { data: athlete, error: aErr } = await supabase
        .from('athletes')
        .insert({
          tournament_id: tournamentId,
          name: name.trim(),
          category_id: categoryId || null,
          competition_day: day,
          body_weight_kg: bodyWeight ? parseFloat(bodyWeight) : null,
        })
        .select('id')
        .single()

      if (aErr) throw aErr

      // Insert openers
      const openerRows = eventTypes
        .filter(et => openers[et.id]?.trim())
        .map(et => ({
          athlete_id: athlete.id,
          event_type_id: et.id,
          opener_weight: parseFloat(openers[et.id]),
        }))

      if (openerRows.length > 0) {
        const { error: oErr } = await supabase.from('athlete_openers').insert(openerRows)
        if (oErr) throw oErr
      }

      // Reset form
      setName('')
      setBodyWeight('')
      setOpeners({})
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add athlete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
        <UserPlus size={16} className="text-[#e8440a]" />
        Add Athlete
      </h2>
      <form onSubmit={handleAdd} className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— none —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Day</label>
            <select className="input" value={day} onChange={e => setDay(Number(e.target.value))}>
              <option value={1}>Day 1</option>
              <option value={2}>Day 2</option>
              <option value={3}>Day 3</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Body Weight (kg)</label>
          <input className="input" type="number" step="0.1" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)} placeholder="Optional" />
        </div>

        {eventTypes.length > 0 && (
          <div>
            <label className="label mb-2">Openers (kg or reps)</label>
            <div className="space-y-2">
              {eventTypes.map(et => (
                <div key={et.id} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-14 shrink-0">{et.name}</span>
                  <input
                    className="input text-sm py-1.5"
                    type="number"
                    step="0.5"
                    placeholder="—"
                    value={openers[et.id] ?? ''}
                    onChange={e => setOpeners(o => ({ ...o, [et.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-[#e8440a] hover:bg-[#c73a08] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {saving ? 'Adding...' : 'Add Athlete'}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          background: #1c1c1c;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 8px 10px;
          color: white;
          font-size: 13px;
          outline: none;
        }
        .input:focus { border-color: #e8440a; }
        .label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #9ca3af;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  )
}
