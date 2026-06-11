'use client'

import type { EventType, AthleteOpener } from '@/types/database'

interface FlightRow {
  id: string
  name: string
  competition_day: number
  platform_order: number
  event_type: { name: string } | null
  flight_athletes: Array<{
    platform_order: number
    athlete: { id: string; name: string; category: { name: string } | null } | null
  }>
}

export function FlightList({
  flights,
  openers,
  eventTypes,
}: {
  flights: FlightRow[]
  openers: AthleteOpener[]
  eventTypes: EventType[]
}) {
  const openerMap = openers.reduce<Record<string, Record<string, number>>>((acc, o) => {
    if (!acc[o.athlete_id]) acc[o.athlete_id] = {}
    acc[o.athlete_id][o.event_type_id] = o.opener_weight ?? 0
    return acc
  }, {})

  const etMap = eventTypes.reduce<Record<string, EventType>>((acc, et) => {
    acc[et.id] = et
    return acc
  }, {})

  if (flights.length === 0) {
    return (
      <div className="text-center py-16 bg-zinc-900 border border-zinc-800 rounded-xl">
        <p className="text-zinc-400 text-sm">No flights generated yet. Use the panel to generate.</p>
      </div>
    )
  }

  // Group by event type + day
  const groups: Record<string, FlightRow[]> = {}
  flights.forEach(f => {
    const key = `${f.event_type?.name ?? 'Unknown'} · Day ${f.competition_day}`
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  })

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([groupLabel, groupFlights]) => {
        const liftName = groupFlights[0]?.event_type?.name ?? ''
        const etEntry = eventTypes.find(et => et.name === liftName)

        return (
          <div key={groupLabel}>
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{groupLabel}</h3>
            <div className="grid gap-4">
              {groupFlights
                .sort((a, b) => a.platform_order - b.platform_order)
                .map(flight => (
                  <div key={flight.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#e8440a]/10 border-b border-zinc-800 flex items-center justify-between">
                      <span className="font-bold text-[#e8440a] text-sm">Flight {flight.name}</span>
                      <span className="text-xs text-zinc-500">{flight.flight_athletes.length} athletes</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left px-4 py-2 text-zinc-500 font-medium text-xs">#</th>
                          <th className="text-left px-4 py-2 text-zinc-500 font-medium text-xs">Athlete</th>
                          <th className="text-left px-4 py-2 text-zinc-500 font-medium text-xs">Category</th>
                          <th className="text-right px-4 py-2 text-zinc-500 font-medium text-xs">Opener</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flight.flight_athletes
                          .sort((a, b) => a.platform_order - b.platform_order)
                          .map((fa, i) => {
                            const opener = etEntry
                              ? openerMap[fa.athlete?.id ?? '']?.[etEntry.id]
                              : undefined

                            return (
                              <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                                <td className="px-4 py-2.5 text-zinc-500 text-xs">{i + 1}</td>
                                <td className="px-4 py-2.5 font-medium text-white">{fa.athlete?.name ?? '—'}</td>
                                <td className="px-4 py-2.5">
                                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">
                                    {fa.athlete?.category?.name ?? '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {opener ? (
                                    <span className="text-[#e8440a] font-semibold">{opener}</span>
                                  ) : (
                                    <span className="text-zinc-600">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
