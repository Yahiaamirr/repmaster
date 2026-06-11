'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Athlete, Category, EventType, AthleteOpener } from '@/types/database'
import { Trash2, Edit3, Check, X } from 'lucide-react'

export function AthleteTable({
  athletes,
  categories,
  eventTypes,
  openers,
  tournamentId,
}: {
  athletes: Athlete[]
  categories: Category[]
  eventTypes: EventType[]
  openers: AthleteOpener[]
  tournamentId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editOpeners, setEditOpeners] = useState<Record<string, string>>({})

  const openerMap = openers.reduce<Record<string, Record<string, number>>>((acc, o) => {
    if (!acc[o.athlete_id]) acc[o.athlete_id] = {}
    acc[o.athlete_id][o.event_type_id] = o.opener_weight ?? 0
    return acc
  }, {})

  // Group by day then category
  const days = [...new Set(athletes.map(a => a.competition_day))].sort()

  async function deleteAthlete(id: string) {
    if (!confirm('Delete this athlete?')) return
    await supabase.from('athletes').delete().eq('id', id)
    router.refresh()
  }

  function startEdit(athlete: Athlete) {
    setEditingId(athlete.id)
    const current: Record<string, string> = {}
    eventTypes.forEach(et => {
      current[et.id] = String(openerMap[athlete.id]?.[et.id] ?? '')
    })
    setEditOpeners(current)
  }

  async function saveOpeners(athleteId: string) {
    const rows = eventTypes
      .filter(et => editOpeners[et.id] !== undefined && editOpeners[et.id] !== '')
      .map(et => ({
        athlete_id: athleteId,
        event_type_id: et.id,
        opener_weight: parseFloat(editOpeners[et.id]) || null,
      }))

    // Upsert openers
    for (const row of rows) {
      await supabase.from('athlete_openers').upsert(row, {
        onConflict: 'athlete_id,event_type_id',
      })
    }
    setEditingId(null)
    router.refresh()
  }

  if (athletes.length === 0) {
    return (
      <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-xl">
        <p className="text-zinc-400">No athletes yet. Add the first one.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {days.map(day => (
        <div key={day}>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Day {day}</h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-zinc-400 font-medium">Category</th>
                  {eventTypes.map(et => (
                    <th key={et.id} className="text-center px-3 py-3 text-zinc-400 font-medium text-xs">{et.name}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {athletes
                  .filter(a => a.competition_day === day)
                  .sort((a, b) => (a.category?.display_order ?? 99) - (b.category?.display_order ?? 99))
                  .map((athlete, i) => (
                    <tr
                      key={athlete.id}
                      className={`border-b border-zinc-800/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-zinc-800/20'}`}
                    >
                      <td className="px-4 py-3 font-medium text-white">{athlete.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                          {athlete.category?.name ?? '—'}
                        </span>
                      </td>
                      {eventTypes.map(et => (
                        <td key={et.id} className="px-3 py-3 text-center">
                          {editingId === athlete.id ? (
                            <input
                              className="w-16 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-1 text-xs text-center text-white outline-none focus:border-[#e8440a]"
                              type="number"
                              step="0.5"
                              value={editOpeners[et.id] ?? ''}
                              onChange={e => setEditOpeners(o => ({ ...o, [et.id]: e.target.value }))}
                            />
                          ) : (
                            <span className={openerMap[athlete.id]?.[et.id] ? 'text-white' : 'text-zinc-600'}>
                              {openerMap[athlete.id]?.[et.id] ?? '—'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {editingId === athlete.id ? (
                            <>
                              <button onClick={() => saveOpeners(athlete.id)} className="text-green-400 hover:text-green-300 p-1">
                                <Check size={14} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-white p-1">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(athlete)} className="text-zinc-500 hover:text-white p-1 transition-colors">
                                <Edit3 size={14} />
                              </button>
                              <button onClick={() => deleteAthlete(athlete.id)} className="text-zinc-600 hover:text-red-400 p-1 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
