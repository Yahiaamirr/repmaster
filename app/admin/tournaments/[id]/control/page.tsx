import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LiveControlPanel } from '@/components/admin/LiveControlPanel'

export default async function ControlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tournament }, { data: flights }, { data: eventTypes }, { data: platformState }] =
    await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase
        .from('flights')
        .select(`
          *,
          event_type:event_types(id, name),
          flight_athletes(
            id,
            platform_order,
            athlete:athletes(id, name, category:categories(name))
          )
        `)
        .eq('tournament_id', id)
        .order('platform_order'),
      supabase.from('event_types').select('*').eq('tournament_id', id).order('display_order'),
      supabase
        .from('platform_state')
        .select('*')
        .eq('tournament_id', id)
        .single(),
    ])

  if (!tournament) notFound()

  // Load all attempts and scores for this tournament
  const athleteIds = (flights ?? [])
    .flatMap((f: { flight_athletes: Array<{ athlete: { id: string } | null }> }) =>
      f.flight_athletes.map((fa: { athlete: { id: string } | null }) => fa.athlete?.id)
    )
    .filter(Boolean) as string[]

  const { data: attempts } = athleteIds.length
    ? await supabase
        .from('attempts')
        .select('*, scores(*)')
        .in('athlete_id', athleteIds)
    : { data: [] }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/tournaments/${id}`} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Live Control</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{tournament.name}</p>
        </div>
      </div>

      <LiveControlPanel
        tournament={tournament}
        flights={flights ?? []}
        eventTypes={eventTypes ?? []}
        attempts={attempts ?? []}
        platformState={platformState ?? null}
      />
    </div>
  )
}
