import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FlightGenerator } from '@/components/admin/FlightGenerator'
import { FlightList } from '@/components/admin/FlightList'

export default async function FlightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tournament }, { data: eventTypes }, { data: flights }] = await Promise.all([
    supabase.from('tournaments').select('id, name, flight_size').eq('id', id).single(),
    supabase.from('event_types').select('*').eq('tournament_id', id).order('display_order'),
    supabase
      .from('flights')
      .select(`
        *,
        event_type:event_types(name),
        flight_athletes(
          platform_order,
          athlete:athletes(id, name, category:categories(name))
        )
      `)
      .eq('tournament_id', id)
      .order('platform_order'),
  ])

  if (!tournament) notFound()

  // Load all openers for context
  const { data: openers } = await supabase
    .from('athlete_openers')
    .select('id, athlete_id, event_type_id, opener_weight, extras')
    .in('event_type_id', (eventTypes ?? []).map((et: { id: string }) => et.id))

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/tournaments/${id}`} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Flights</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{tournament.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <FlightGenerator
            tournamentId={id}
            eventTypes={eventTypes ?? []}
          />
        </div>
        <div className="lg:col-span-2">
          <FlightList
            flights={flights ?? []}
            openers={openers ?? []}
            eventTypes={eventTypes ?? []}
          />
        </div>
      </div>
    </div>
  )
}
