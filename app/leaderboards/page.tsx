import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import Image from 'next/image'
import type { RiseEvent, RiseScoringMode } from '@/types/rise'
import { RiseWordmark } from '@/components/rise/RiseBrand'

export const dynamic = 'force-dynamic'

const LOGOS: Record<string, { src: string; bg: string; contain?: boolean; large?: boolean; zoom?: boolean }> = {
  'rise-battle-cycles':                    { src: '/rise/rise-logo.png',    bg: '#000000' },
  'rise-ring-pushups-challenge-mqb12k1g':  { src: '/rise/rise-logo.png',    bg: '#000000' },
  'evolve-deadlift-ladder':                { src: '/rise/evolve-logo.webp', bg: '#ffffff', contain: true },
  'lftd-hyrox':                            { src: '/rise/lftd-logo.jpg',    bg: '#d4e84a' },
  'turbo-deadhang':                        { src: '/rise/turbo-logo.jpg',   bg: '#000000' },
  'rlntlss-box-jumps':                     { src: '/rise/rlntlss-logo.png', bg: '#000000' },
  'rltnlss-mqayem06':                      { src: '/rise/rlntlss-logo.png', bg: '#000000' },
  'sassic-pushups-challenge-mqb26s3p':     { src: '/rise/sassic-logo.jpg', bg: '#ffffff', contain: true, large: true, zoom: true },
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
                className={`flex shrink-0 items-center justify-center rounded-xl overflow-hidden ${LOGOS[ev.slug]?.large ? 'h-14 w-14' : 'h-11 w-11'}`}
                style={{ background: LOGOS[ev.slug]?.bg ?? `color-mix(in srgb, ${accent} 15%, transparent)` }}
              >
                {LOGOS[ev.slug] ? (
                  <Image
                    src={LOGOS[ev.slug].src}
                    alt={ev.name}
                    width={56}
                    height={56}
                    className={`w-full h-full ${LOGOS[ev.slug].contain ? `object-contain${LOGOS[ev.slug].zoom ? ' scale-[2.2]' : ' p-1'}` : 'object-cover'}`}
                  />
                ) : null}
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
