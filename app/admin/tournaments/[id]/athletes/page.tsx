import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AddAthleteForm } from '@/components/admin/AddAthleteForm'
import { AthleteTable } from '@/components/admin/AthleteTable'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AthletesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tournament }, { data: athletes }, { data: categories }, { data: eventTypes }] =
    await Promise.all([
      supabase.from('tournaments').select('id, name, flight_size').eq('id', id).single(),
      supabase
        .from('athletes')
        .select('*, category:categories(id, name, display_order)')
        .eq('tournament_id', id)
        .order('created_at'),
      supabase.from('categories').select('*').eq('tournament_id', id).order('display_order'),
      supabase.from('event_types').select('*').eq('tournament_id', id).order('display_order'),
    ])

  if (!tournament) notFound()

  // Load openers for all athletes
  const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
  const { data: openers } = athleteIds.length
    ? await supabase.from('athlete_openers').select('*').in('athlete_id', athleteIds)
    : { data: [] }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/tournaments/${id}`} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Athletes</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{tournament.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <AddAthleteForm
            tournamentId={id}
            categories={categories ?? []}
            eventTypes={eventTypes ?? []}
          />
        </div>
        <div className="lg:col-span-2">
          <AthleteTable
            athletes={athletes ?? []}
            categories={categories ?? []}
            eventTypes={eventTypes ?? []}
            openers={openers ?? []}
            tournamentId={id}
          />
        </div>
      </div>
    </div>
  )
}
