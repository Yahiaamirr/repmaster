import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RiseScoringMode } from '@/types/rise'

export const dynamic = 'force-dynamic'

const SCORING_MODES: RiseScoringMode[] = ['reps', 'time_fastest', 'time_longest', 'measure_max']

type RoundInput = { id?: string; name?: string; duration_sec?: number | null }

function defaultUnit(mode: RiseScoringMode): string {
  switch (mode) {
    case 'reps': return 'reps'
    case 'time_fastest':
    case 'time_longest': return 'sec'
    case 'measure_max': return 'cm'
  }
}

// Edit an existing RISE event (admin only). Updates name/type/scoring config and
// syncs its rounds. The slug is intentionally left unchanged so existing public,
// register and judge links / QR codes keep working.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  let body: {
    name?: string
    is_team?: boolean
    scoring_mode?: string
    unit?: string
    config?: Record<string, unknown>
    rounds?: RoundInput[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { data: existing } = await supabase.from('rise_events').select('id, slug').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

  const name = (body.name ?? '').trim()
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Name must be between 2 and 80 characters.' }, { status: 400 })
  }

  const scoring_mode = body.scoring_mode as RiseScoringMode
  if (!SCORING_MODES.includes(scoring_mode)) {
    return NextResponse.json({ error: 'Invalid scoring mode.' }, { status: 400 })
  }

  const is_team = body.is_team === true
  const unit = (body.unit ?? '').trim() || defaultUnit(scoring_mode)
  const config = (body.config && typeof body.config === 'object') ? body.config : {}
  const rounds = Array.isArray(body.rounds) ? body.rounds : []

  // Update the event row (slug stays the same).
  const { error: updErr } = await supabase
    .from('rise_events')
    .update({ name, scoring_mode, is_team, unit, config })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Sync rounds: update existing (by id), insert new, delete removed.
  const { data: currentRounds } = await supabase.from('rise_rounds').select('id').eq('event_id', id)
  const currentIds = new Set((currentRounds ?? []).map(r => r.id as string))
  const keptIds = new Set<string>()

  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i]
    const rowName = (r.name ?? '').trim() || `Round ${i + 1}`
    const duration_sec = typeof r.duration_sec === 'number' && r.duration_sec > 0 ? r.duration_sec : null

    if (r.id && currentIds.has(r.id)) {
      keptIds.add(r.id)
      const { error } = await supabase
        .from('rise_rounds')
        .update({ name: rowName, duration_sec, display_order: i + 1 })
        .eq('id', r.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase
        .from('rise_rounds')
        .insert({ event_id: id, name: rowName, display_order: i + 1, duration_sec, status: 'pending', config: {} })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Delete rounds the user removed (cascades their entries).
  const toDelete = [...currentIds].filter(rid => !keptIds.has(rid))
  if (toDelete.length > 0) {
    const { error } = await supabase.from('rise_rounds').delete().in('id', toDelete)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ slug: existing.slug })
}

// Delete a RISE event (admin only). The event's teams, competitors, rounds,
// entries and judge tokens are removed automatically via on-delete cascade.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

  const { error } = await supabase.from('rise_events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
