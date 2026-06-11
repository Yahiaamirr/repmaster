import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { JudgePanel } from '@/components/judge/JudgePanel'

export const dynamic = 'force-dynamic'

export default async function JudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: judgeToken } = await supabase
    .from('judge_tokens')
    .select('*, tournament:tournaments(id, name, status)')
    .eq('token', token)
    .single()

  if (!judgeToken) notFound()

  const tournament = judgeToken.tournament as { id: string; name: string; status: string }

  // Load platform state with active attempt
  const { data: platformState } = await supabase
    .from('platform_state')
    .select(`
      *,
      athlete:athletes(id, name, category:categories(name)),
      attempt:attempts(id, attempt_number, declared_weight, event_type:event_types(name))
    `)
    .eq('tournament_id', tournament.id)
    .single()

  return (
    <JudgePanel
      token={token}
      judgeLabel={judgeToken.label ?? `Judge ${judgeToken.judge_number ?? 1}`}
      tournament={tournament}
      platformState={platformState ?? null}
    />
  )
}
