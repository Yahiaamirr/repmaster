import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateFlights, buildCategoryGroups } from '@/lib/flight-generator'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { tournament_id, event_type_id, competition_day } = await req.json()

  if (!tournament_id || !event_type_id || !competition_day) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Load tournament for flight_size
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, flight_size')
    .eq('id', tournament_id)
    .single()

  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })

  // Load categories in order
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, display_order')
    .eq('tournament_id', tournament_id)
    .order('display_order')

  // Load athletes for this day (attendance = true)
  const { data: athletes } = await supabase
    .from('athletes')
    .select('id, name, category_id, competition_day, categories(name, display_order)')
    .eq('tournament_id', tournament_id)
    .eq('competition_day', competition_day)
    .eq('attendance', true)

  // Load openers for this event type
  const athleteIds = (athletes ?? []).map((a: { id: string }) => a.id)
  const { data: openers } = athleteIds.length
    ? await supabase
        .from('athlete_openers')
        .select('athlete_id, opener_weight')
        .eq('event_type_id', event_type_id)
        .in('athlete_id', athleteIds)
    : { data: [] }

  const openerMap = (openers ?? []).reduce<Record<string, number>>((acc, o: { athlete_id: string; opener_weight: number | null }) => {
    acc[o.athlete_id] = o.opener_weight ?? 0
    return acc
  }, {})

  const categoryGroups = buildCategoryGroups(categories ?? [])

  type AthleteRow = {
    id: string
    categories: { name: string; display_order: number } | { name: string; display_order: number }[] | null
  }

  function getCategoryData(cat: AthleteRow['categories']) {
    if (!cat) return { name: '', display_order: 99 }
    if (Array.isArray(cat)) return cat[0] ?? { name: '', display_order: 99 }
    return cat
  }

  const athletesForGen = (athletes ?? []).map((a: AthleteRow) => {
    const cat = getCategoryData(a.categories)
    return {
      athlete_id: a.id,
      category_name: cat.name,
      category_order: cat.display_order,
      opener_weight: openerMap[a.id] ?? null,
    }
  })

  const generatedFlights = generateFlights({
    tournament_id,
    event_type_id,
    competition_day,
    athletes: athletesForGen,
    flight_size: tournament.flight_size,
    category_groups: categoryGroups,
  })

  // Delete existing flights for this event+day
  await supabase
    .from('flights')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('event_type_id', event_type_id)
    .eq('competition_day', competition_day)

  // Insert new flights
  for (const gf of generatedFlights) {
    const { data: flight, error: fErr } = await supabase
      .from('flights')
      .insert({
        tournament_id,
        event_type_id,
        competition_day,
        name: gf.name,
        platform_order: gf.platform_order,
      })
      .select('id')
      .single()

    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

    if (gf.athlete_ids.length > 0) {
      await supabase.from('flight_athletes').insert(
        gf.athlete_ids.map((athlete_id, idx) => ({
          flight_id: flight.id,
          athlete_id,
          platform_order: idx,
        }))
      )
    }
  }

  return NextResponse.json({ ok: true, flights: generatedFlights.length })
}
