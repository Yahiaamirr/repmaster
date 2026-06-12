import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Supervisor-driven participant registration for a RISE event. A supervisor
// opens the event's supervisor link/QR and registers participants one after
// another. Captures name + gender (required) and phone + email (optional).
// Validated server-side and inserted with the service role (no anon RLS write).
export async function POST(request: Request) {
  let body: { eventId?: string; name?: string; gender?: string; phone?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const gender = body.gender === 'F' ? 'F' : body.gender === 'M' ? 'M' : null
  const phone = (body.phone ?? '').trim()
  const email = (body.email ?? '').trim()

  if (!body.eventId || name.length < 2 || name.length > 80 || !gender) {
    return NextResponse.json({ error: 'Please enter a valid name and gender.' }, { status: 400 })
  }
  if (phone && (phone.length < 5 || phone.length > 20)) {
    return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 })
  }
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: event } = await supabase
    .from('rise_events')
    .select('id')
    .eq('id', body.eventId)
    .single()
  if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

  const meta: Record<string, unknown> = {
    supervisor_registered: true,
    registered_at: new Date().toISOString(),
  }
  if (phone) meta.phone = phone
  if (email) meta.email = email

  const { error } = await supabase
    .from('rise_competitors')
    .insert({ event_id: event.id, name, gender, meta })

  if (error) return NextResponse.json({ error: 'Could not register. Try again.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
