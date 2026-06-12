import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Tournament } from '@/types/database'
import { Plus, Calendar, Users, ChevronRight } from 'lucide-react'

export default async function TournamentsPage() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage all your competitions</p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold rounded-lg transition-colors text-sm"
        >
          <Plus size={15} />
          New Tournament
        </Link>
      </div>

      {!tournaments || tournaments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3">
          {tournaments.map((t: Tournament) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function TournamentCard({ tournament: t }: { tournament: Tournament }) {
  const statusColor = {
    setup: 'bg-zinc-700 text-zinc-300',
    live: 'bg-green-500/20 text-green-400 border border-green-500/30',
    ended: 'bg-zinc-800 text-zinc-500',
  }[t.status]

  return (
    <Link
      href={`/admin/tournaments/${t.id}`}
      className="flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 transition-all group"
    >
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white">{t.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {t.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500 text-sm">
            {t.date_start && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(t.date_start).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </span>
            )}
          </div>
        </div>
      </div>
      <ChevronRight size={16} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-24 border border-dashed border-zinc-800 rounded-2xl">
      <div className="text-4xl mb-4">🏆</div>
      <h2 className="text-lg font-semibold mb-2">No tournaments yet</h2>
      <p className="text-zinc-400 text-sm mb-6">Create your first competition to get started</p>
      <Link
        href="/admin/tournaments/new"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold rounded-lg transition-colors text-sm"
      >
        <Plus size={15} />
        Create Tournament
      </Link>
    </div>
  )
}
