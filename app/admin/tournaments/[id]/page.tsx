import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Users, Layers, Radio, QrCode, ExternalLink, Settings } from 'lucide-react'
import { TournamentStatusButton } from '@/components/admin/TournamentStatusButton'

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()

  if (!tournament) notFound()

  const [{ count: athleteCount }, { count: flightCount }] = await Promise.all([
    supabase.from('athletes').select('id', { count: 'exact', head: true }).eq('tournament_id', id),
    supabase.from('flights').select('id', { count: 'exact', head: true }).eq('tournament_id', id),
  ])

  const leaderboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/leaderboard/${id}`
  const scoreboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/leaderboard/${id}?display=1`

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>
          {tournament.date_start && (
            <p className="text-zinc-400 text-sm">
              {new Date(tournament.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {tournament.date_end && tournament.date_end !== tournament.date_start && (
                <> — {new Date(tournament.date_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</>
              )}
            </p>
          )}
        </div>
        <TournamentStatusButton tournament={tournament} />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Athletes" value={athleteCount ?? 0} />
        <StatCard label="Flights Generated" value={flightCount ?? 0} />
        <StatCard label="Flight Size" value={tournament.flight_size} />
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <NavCard
          href={`/admin/tournaments/${id}/athletes`}
          icon={<Users size={20} />}
          title="Athletes"
          description="Add athletes, set openers and weight classes"
          count={athleteCount ?? 0}
        />
        <NavCard
          href={`/admin/tournaments/${id}/flights`}
          icon={<Layers size={20} />}
          title="Flights"
          description="Generate and view flight assignments"
          count={flightCount ?? 0}
        />
        <NavCard
          href={`/admin/tournaments/${id}/control`}
          icon={<Radio size={20} />}
          title="Live Control"
          description="Run the event — score attempts, set on platform"
          highlight={tournament.status === 'live'}
        />
      </div>

      {/* Public links */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Public Links</h2>
        <div className="space-y-3">
          <PublicLink label="Leaderboard" url={leaderboardUrl} icon={<QrCode size={14} />} />
          <PublicLink label="Scoreboard Display" url={scoreboardUrl} icon={<ExternalLink size={14} />} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    setup: 'bg-zinc-700 text-zinc-300',
    live: 'bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse',
    ended: 'bg-zinc-800 text-zinc-500',
  }[status] ?? 'bg-zinc-700 text-zinc-300'

  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles}`}>{status}</span>
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="text-zinc-400 text-xs mt-1">{label}</div>
    </div>
  )
}

function NavCard({
  href, icon, title, description, count, highlight,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  count?: number
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`block bg-zinc-900 hover:bg-zinc-800 border rounded-xl p-5 transition-all group ${
        highlight ? 'border-[#e8440a]/50 hover:border-[#e8440a]' : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className={`mb-3 ${highlight ? 'text-[#e8440a]' : 'text-zinc-400 group-hover:text-white'} transition-colors`}>
        {icon}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-white">{title}</span>
        {count !== undefined && (
          <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <p className="text-zinc-400 text-sm">{description}</p>
    </Link>
  )
}

function PublicLink({ label, url, icon }: { label: string; url: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-zinc-500 mt-0.5 font-mono truncate max-w-xs">{url}</div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
        >
          {icon}
          Open
        </a>
      </div>
    </div>
  )
}
