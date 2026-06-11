import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Public athlete self-registration for an individual RISE event.
// Validated server-side and inserted with the service role (no anon RLS write).
export async function POST(request: Request) {
  let body: { eventId?: string; name?: string; gender?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const gender = body.gender === 'F' ? 'F' : body.gender === 'M' ? 'M' : null

  if (!body.eventId || name.length < 2 || name.length > 80 || !gender) {
    return NextResponse.json({ error: 'Please enter a valid name and gender.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: event } = await supabase
    .from('rise_events')
    .select('id, name, is_team')
    .eq('id', body.eventId)
    .single()

  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  if (event.is_team) {
    return NextResponse.json({ error: 'This event has fixed teams and is not open for registration.' }, { status: 403 })
  }

  // Avoid obvious duplicates (same name already registered for this event).
  const { data: existing } = await supabase
    .from('rise_competitors')
    .select('id')
    .eq('event_id', event.id)
    .ilike('name', name)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const { error } = await supabase
    .from('rise_competitors')
    .insert({ event_id: event.id, name, gender, meta: { self_registered: true } })

  if (error) return NextResponse.json({ error: 'Could not register. Try again.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
