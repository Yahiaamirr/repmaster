import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight, Users, User, Timer, Dumbbell, ArrowUp } from 'lucide-react'
import type { RiseEvent } from '@/types/rise'

export const dynamic = 'force-dynamic'

const ICONS: Record<string, React.ReactNode> = {
  'rise-battle-cycles': <Users size={20} />,
  'evolve-deadlift-ladder': <Dumbbell size={20} />,
  'lftd-hyrox': <Timer size={20} />,
  'turbo-deadhang': <User size={20} />,
  'rlntlss-box-jumps': <ArrowUp size={20} />,
}

export default async function RiseIndexPage() {
  const supabase = await createClient()
  const { data: events } = await supabase.from('rise_events').select('*').order('display_order')
  const list = (events as RiseEvent[] | null) ?? []

  return (
    <div className="min-h-[100dvh] bg-[#0d0800] text-white">
      <header className="text-center py-12 px-4 border-b border-[#2a1a00]">
        <div className="inline-flex items-center gap-2 text-[#e8440a] text-xs font-bold tracking-[4px] uppercase mb-4">
          <span className="w-1.5 h-1.5 bg-[#e8440a] rounded-full animate-pulse" />
          Live Now
        </div>
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight">RISE Opening Event</h1>
        <p className="text-zinc-500 mt-3">Pick an event to follow the live leaderboard.</p>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        {list.map(ev => (
          <Link
            key={ev.id}
            href={`/rise/${ev.slug}`}
            className="group flex items-center gap-4 rounded-2xl border border-[#2a1200] bg-[#120a00] px-5 py-5 transition-colors hover:border-[#e8440a]/50 hover:bg-[#1a0c00]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8440a]/15 text-[#e8440a]">
              {ICONS[ev.slug] ?? <User size={20} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg truncate">{ev.name}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                {ev.is_team ? 'Team event' : 'Individual · Men & Women'}
              </p>
            </div>
            <ChevronRight size={20} className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#e8440a]" />
          </Link>
        ))}
        {list.length === 0 && (
          <p className="text-center text-zinc-600 py-12">No events seeded yet. Run the RISE migrations.</p>
        )}
      </div>
    </div>
  )
}
