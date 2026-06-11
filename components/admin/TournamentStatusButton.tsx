'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Tournament } from '@/types/database'

export function TournamentStatusButton({ tournament }: { tournament: Tournament }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const next = tournament.status === 'setup' ? 'live' : tournament.status === 'live' ? 'ended' : null

  if (!next) return null

  async function advance() {
    setLoading(true)
    await supabase.from('tournaments').update({ status: next }).eq('id', tournament.id)
    router.refresh()
    setLoading(false)
  }

  const label = next === 'live' ? 'Go Live' : 'End Tournament'
  const style = next === 'live'
    ? 'bg-green-600 hover:bg-green-500 text-white'
    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'

  return (
    <button
      onClick={advance}
      disabled={loading}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${style}`}
    >
      {loading ? '...' : label}
    </button>
  )
}
