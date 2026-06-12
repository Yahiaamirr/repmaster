import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight, Users, User, Timer, Dumbbell, ArrowUp, Trophy } from 'lucide-react'
import type { RiseEvent, RiseScoringMode } from '@/types/rise'
import { RiseWordmark } from '@/components/rise/RiseBrand'

export const dynamic = 'force-dynamic'

const ICONS: Record<string, React.ReactNode> = {
  'rise-battle-cycles': <Users size={20} />,
  'evolve-deadlift-ladder': <Dumbbell size={20} />,
  'lftd-hyrox': <Timer size={20} />,
  'turbo-deadhang': <User size={20} />,
  'rlntlss-box-jumps': <ArrowUp size={20} />,
}

// Per-event accent, mirroring each board's sponsor theme.
const ACCENTS: Record<string, string> = {
  'evolve-deadlift-ladder': '#ffffff',
  'turbo-deadhang': '#ec2124',
  'lftd-hyrox': '#dae07c',
  'rlntlss-box-jumps': '#ffffff',
}
const DEFAULT_ACCENT = '#4d7bff'

function modeLabel(mode: RiseScoringMode): string {
  return { reps: 'Most reps', time_fastest: 'Fastest time', time_longest: 'Longest time', measure_max: 'Highest measure' }[mode]
}

export default async function LeaderboardsPage() {
  const supabase = await createClient()
  const { data: events } = await supabase.from('rise_events').select('*').order('display_order')
  const list = (events as RiseEvent[] | null) ?? []

  return (
    <div className="min-h-[100dvh] bg-[#05070f] text-white">
      <header className="relative text-center py-14 px-4 border-b border-[#1a2547] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(47,95,224,0.22),transparent_60%)]" />
        <div className="relative">
          <div className="flex justify-center mb-5">
            <RiseWordmark className="h-10 sm:h-12 w-auto" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Leaderboards</h1>
          <p className="text-zinc-400 mt-3 text-sm uppercase tracking-[0.3em]">Choose an event to watch live</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map(ev => {
          const accent = ACCENTS[ev.slug] ?? DEFAULT_ACCENT
          return (
            <Link
              key={ev.id}
              href={`/rise/${ev.slug}`}
              style={{ ['--accent' as string]: accent }}
              className="group relative flex items-center gap-4 rounded-2xl border border-[#1a2547] bg-[#0b1226] px-5 py-5 transition-colors hover:border-[var(--accent)]/60 hover:bg-[#101a3a]"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
              >
                {ICONS[ev.slug] ?? <Trophy size={20} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg truncate">{ev.name}</p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider truncate">
                  {ev.is_team ? 'Team' : 'Individual'} · {modeLabel(ev.scoring_mode)}
                </p>
              </div>
              {ev.status === 'live' && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
                </span>
              )}
              <ChevronRight size={18} className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]" />
            </Link>
          )
        })}
        {list.length === 0 && (
          <p className="col-span-full text-center text-zinc-600 py-12">No events yet.</p>
        )}
      </div>
    </div>
  )
}
