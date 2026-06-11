import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { attempt_id, judge_label, result, token } = await req.json()

  if (!attempt_id || !result || !['good_rep', 'no_rep'].includes(result)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Validate judge token if provided
  if (token) {
    const { data: jt } = await supabase
      .from('judge_tokens')
      .select('id, tournament_id')
      .eq('token', token)
      .single()
    if (!jt) return NextResponse.json({ error: 'Invalid judge token' }, { status: 401 })
  }

  const { error } = await supabase.from('scores').insert({
    attempt_id,
    judge_label: judge_label ?? 'Judge',
    result,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark attempt as completed
  await supabase.from('attempts').update({ status: 'completed' }).eq('id', attempt_id)

  return NextResponse.json({ ok: true })
}
