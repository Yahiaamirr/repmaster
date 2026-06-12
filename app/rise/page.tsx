import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import Image from 'next/image'
import type { RiseEvent } from '@/types/rise'
import { RiseWordmark, RiseCoBrandFooter } from '@/components/rise/RiseBrand'

export const dynamic = 'force-dynamic'

const LOGOS: Record<string, { src: string; bg: string }> = {
  'rise-battle-cycles':    { src: '/rise/rise-logo.png',    bg: 'bg-black' },
  'evolve-deadlift-ladder':{ src: '/rise/evolve-logo.webp', bg: 'bg-white' },
  'lftd-hyrox':            { src: '/rise/lftd-logo.jpg',    bg: 'bg-[#d4e84a]' },
  'turbo-deadhang':        { src: '/rise/turbo-logo.jpg',   bg: 'bg-black' },
  'rlntlss-box-jumps':     { src: '/rise/rlntlss-logo.png', bg: 'bg-black' },
}

export default async function RiseIndexPage() {
  const supabase = await createClient()
  const { data: events } = await supabase.from('rise_events').select('*').order('display_order')
  const list = (events as RiseEvent[] | null) ?? []

  return (
    <div className="min-h-[100dvh] bg-[#05070f] text-white">
      <header className="relative text-center py-14 px-4 border-b border-[#1a2547] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(47,95,224,0.25),transparent_60%)]" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-[#4d7bff] text-xs font-bold tracking-[4px] uppercase mb-6">
            <span className="w-1.5 h-1.5 bg-[#4d7bff] rounded-full animate-pulse" />
            Live Now
          </div>
          <div className="flex justify-center">
            <RiseWordmark className="h-16 sm:h-24 w-auto" />
          </div>
          <p className="text-zinc-400 mt-5 text-sm uppercase tracking-[0.3em]">Opening Event · Live Leaderboards</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
        {list.map(ev => (
          <Link
            key={ev.id}
            href={`/rise/${ev.slug}`}
            className="group flex items-center gap-4 rounded-2xl border border-[#1a2547] bg-[#0b1226] px-5 py-5 transition-colors hover:border-[#2f5fe0]/50 hover:bg-[#101a3a]"
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl overflow-hidden ${LOGOS[ev.slug]?.bg ?? 'bg-[#2f5fe0]/15'}`}>
              {LOGOS[ev.slug] ? (
                <Image src={LOGOS[ev.slug].src} alt={ev.name} width={44} height={44} className="w-full h-full object-cover" />
              ) : null}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg truncate">{ev.name}</p>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                {ev.is_team ? 'Team event' : 'Individual · Men & Women'}
              </p>
            </div>
            <ChevronRight size={20} className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-[#2f5fe0]" />
          </Link>
        ))}
        {list.length === 0 && (
          <p className="text-center text-zinc-600 py-12">No events seeded yet. Run the RISE migrations.</p>
        )}
        <RiseCoBrandFooter />
      </div>
    </div>
  )
}
