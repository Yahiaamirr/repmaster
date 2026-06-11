import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RiseScoringMode } from '@/types/rise'

export const dynamic = 'force-dynamic'

const SCORING_MODES: RiseScoringMode[] = ['reps', 'time_fastest', 'time_longest', 'measure_max']

type RoundInput = { name?: string; duration_sec?: number | null }

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base || 'event'}-${Date.now().toString(36)}`
}

// Create a new RISE event (admin only). Inserts the rise_events row plus its
// rounds. Starts with an empty roster — no teams, competitors, entries or tokens.
export async function POST(request: Request) {
  const supabase = await createClient()

  // Require an authenticated admin session (RLS also enforces this).
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

  // Next display_order = max existing + 1.
  const { data: last } = await supabase
    .from('rise_events')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const display_order = (last?.display_order ?? 0) + 1

  // Insert the event, retrying on slug collision.
  let event: { id: string; slug: string } | null = null
  let lastError = ''
  for (let attempt = 0; attempt < 5 && !event; attempt++) {
    const slug = slugify(name)
    const { data, error } = await supabase
      .from('rise_events')
      .insert({ name, slug, scoring_mode, is_team, unit, config, status: 'setup', display_order })
      .select('id, slug')
      .single()

    if (!error) { event = data; break }
    lastError = error.message
    // 23505 = unique_violation (slug clash) — retry with a fresh suffix.
    if (error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  if (!event) {
    return NextResponse.json({ error: lastError || 'Could not create event.' }, { status: 500 })
  }

  // Insert rounds (if any). Best-effort cleanup if this fails so we don't leave
  // a half-built event behind.
  const cleanRounds = rounds
    .map((r, i) => ({
      event_id: event!.id,
      name: (r.name ?? '').trim() || `Round ${i + 1}`,
      display_order: i + 1,
      duration_sec: typeof r.duration_sec === 'number' && r.duration_sec > 0 ? r.duration_sec : null,
      status: 'pending' as const,
      config: {},
    }))

  if (cleanRounds.length > 0) {
    const { error: roundsErr } = await supabase.from('rise_rounds').insert(cleanRounds)
    if (roundsErr) {
      await supabase.from('rise_events').delete().eq('id', event.id)
      return NextResponse.json({ error: roundsErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ slug: event.slug })
}

function defaultUnit(mode: RiseScoringMode): string {
  switch (mode) {
    case 'reps': return 'reps'
    case 'time_fastest':
    case 'time_longest': return 'sec'
    case 'measure_max': return 'cm'
  }
}
