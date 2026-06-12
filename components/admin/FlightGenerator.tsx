'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EventType } from '@/types/database'
import { Shuffle } from 'lucide-react'

export function FlightGenerator({
  tournamentId,
  eventTypes,
}: {
  tournamentId: string
  eventTypes: EventType[]
}) {
  const router = useRouter()
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? '')
  const [day, setDay] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/flights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: tournamentId,
          event_type_id: eventTypeId,
          competition_day: day,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(`Generated ${data.flights} flights`)
      router.refresh()
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
        <Shuffle size={16} className="text-[#7c3aed]" />
        Generate Flights
      </h2>
      <p className="text-zinc-400 text-xs mb-4">
        Sorts athletes by opener weight per lift, chains categories in order, splits into flights.
        Re-running replaces existing flights for this combination.
      </p>

      <div className="space-y-3">
        <div>
          <label className="label">Lift / Event</label>
          <select className="input" value={eventTypeId} onChange={e => setEventTypeId(e.target.value)}>
            {eventTypes.map(et => (
              <option key={et.id} value={et.id}>{et.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Competition Day</label>
          <select className="input" value={day} onChange={e => setDay(Number(e.target.value))}>
            <option value={1}>Day 1</option>
            <option value={2}>Day 2</option>
            <option value={3}>Day 3</option>
          </select>
        </div>

        {result && (
          <p className={`text-xs ${result.startsWith('Generated') ? 'text-green-400' : 'text-red-400'}`}>
            {result}
          </p>
        )}

        <button
          onClick={generate}
          disabled={loading || !eventTypeId}
          className="w-full py-2 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {loading ? 'Generating...' : 'Generate Flights'}
        </button>
      </div>

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
        .input:focus { border-color: #7c3aed; }
        .label { display: block; font-size: 12px; font-weight: 500; color: #9ca3af; margin-bottom: 4px; }
      `}</style>
    </div>
  )
}
