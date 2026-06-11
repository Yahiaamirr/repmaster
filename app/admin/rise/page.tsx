import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Radio, Settings, ExternalLink, Users, User, Plus } from 'lucide-react'
import type { RiseEvent } from '@/types/rise'
import { RiseWordmark } from '@/components/rise/RiseBrand'

export const dynamic = 'force-dynamic'

export default async function AdminRisePage() {
  const supabase = await createClient()
  const { data: events } = await supabase.from('rise_events').select('*').order('display_order')
  const list = (events as RiseEvent[] | null) ?? []

  // Competitor counts per event
  const counts: Record<string, number> = {}
  if (list.length) {
    const { data: comps } = await supabase
      .from('rise_competitors')
      .select('event_id')
      .in('event_id', list.map(e => e.id))
    for (const c of (comps as { event_id: string }[] | null) ?? []) {
      counts[c.event_id] = (counts[c.event_id] ?? 0) + 1
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <span className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
          <RiseWordmark className="h-8 w-auto" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">RISE Opening Event</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Five live events. Open a control room to run scoring, and share the public leaderboard.
          </p>
        </div>
        <Link
          href="/admin/rise/new"
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#2f5fe0] hover:bg-[#2348b8] text-white font-semibold rounded-lg transition-colors text-sm"
        >
          <Plus size={15} />
          New Event
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-300 font-semibold">No RISE events found.</p>
          <p className="text-zinc-500 text-sm mt-2">
            Create one below, or run <code className="text-[#2f5fe0]">002_rise.sql</code>, <code className="text-[#2f5fe0]">003_rise_seed.sql</code>{' '}
            and <code className="text-[#2f5fe0]">004_rise_participants.sql</code> in the Supabase SQL editor.
          </p>
          <Link
            href="/admin/rise/new"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#2f5fe0] hover:bg-[#2348b8] text-white font-semibold rounded-lg transition-colors text-sm"
          >
            <Plus size={15} />
            New Event
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {list.map(ev => (
            <div key={ev.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f5fe0]/15 text-[#2f5fe0]">
                    {ev.is_team ? <Users size={18} /> : <User size={18} />}
                  </span>
                  <div>
                    <p className="font-bold text-white leading-tight">{ev.name}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">
                      {ev.is_team ? 'Team' : `${counts[ev.id] ?? 0} athletes`} · {modeLabel(ev)}
                    </p>
                  </div>
                </div>
                <StatusBadge status={ev.status} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <CardLink href={`/admin/rise/${ev.slug}`} icon={<Settings size={14} />} label="Setup" />
                <CardLink href={`/admin/rise/${ev.slug}/control`} icon={<Radio size={14} />} label="Control" highlight />
                <CardLink href={`/rise/${ev.slug}`} icon={<ExternalLink size={14} />} label="Board" external />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function modeLabel(ev: RiseEvent) {
  return {
    reps: 'Most reps',
    time_fastest: 'Fastest time',
    time_longest: 'Longest time',
    measure_max: 'Highest (cm)',
  }[ev.scoring_mode]
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    {
      setup: 'bg-zinc-700 text-zinc-300',
      live: 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse',
      ended: 'bg-zinc-800 text-zinc-500',
    }[status] ?? 'bg-zinc-700 text-zinc-300'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles}`}>{status}</span>
}

function CardLink({
  href, icon, label, highlight, external,
}: {
  href: string
  icon: React.ReactNode
  label: string
  highlight?: boolean
  external?: boolean
}) {
  const cls = `flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
    highlight ? 'bg-[#2f5fe0] hover:bg-[#2348b8] text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
  }`
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {label}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {icon}
      {label}
    </Link>
  )
}
