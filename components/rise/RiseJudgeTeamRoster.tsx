'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronRight, CheckCircle2, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ENTRY_SELECT, logJudge } from '@/lib/rise'
import { entryValue, teamGenderOf } from '@/types/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseTeam } from '@/types/rise'
import { JudgeCounter } from './JudgeCounter'
import { JudgeTimer } from './JudgeTimer'
import { JudgeMeasure } from './JudgeMeasure'
import { brandVars } from '@/lib/rise-theme'

// Judge roster for team-timed events (e.g. Hyrox): pick a TEAM (shown with its
// member names), then run that team's timer. One device can score many teams.
export function RiseJudgeTeamRoster({
  event,
  token,
  label,
  teams,
  competitors,
  initialEntries,
}: {
  event: RiseEvent
  token: string
  label: string
  teams: RiseTeam[]
  competitors: RiseCompetitor[]
  initialEntries: RiseEntry[]
}) {
  const supabase = createClient()
  const [entries, setEntries] = useState<RiseEntry[]>(initialEntries)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  // Keep recorded results fresh across devices.
  useEffect(() => {
    const channel = supabase
      .channel(`rise-team-roster-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_entries', filter: `event_id=eq.${event.id}` }, async () => {
        const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', event.id)
        if (data) setEntries(data as RiseEntry[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event.id])

  const entryFor = (teamId: string) => entries.find(e => e.team_id === teamId) ?? null
  const membersOf = (teamId: string) => competitors.filter(c => c.team_id === teamId)

  async function selectTeam(t: RiseTeam) {
    let entry = entryFor(t.id)
    if (!entry) {
      setCreating(true)
      const { data } = await supabase
        .from('rise_entries')
        .insert({ event_id: event.id, team_id: t.id, status: 'pending' })
        .select(ENTRY_SELECT)
        .single()
      setCreating(false)
      if (data) {
        entry = data as RiseEntry
        setEntries(prev => [...prev, entry as RiseEntry])
      }
    }
    if (entry) logJudge(supabase, token, entry.id)
    setSelectedId(t.id)
  }

  function onLocalChange(next: Partial<RiseEntry>) {
    setEntries(prev => prev.map(e => (e.team_id === selectedId ? { ...e, ...next } : e)))
  }

  // Female teams first, then by display order.
  const genderRank = (g: 'M' | 'F' | null) => (g === 'F' ? 0 : g === 'M' ? 1 : 2)
  const ordered = useMemo(
    () => [...teams].sort(
      (a, b) =>
        genderRank(teamGenderOf(competitors, a.id)) - genderRank(teamGenderOf(competitors, b.id)) ||
        a.display_order - b.display_order,
    ),
    [teams, competitors],
  )
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return ordered
    return ordered.filter(t =>
      t.name.toLowerCase().includes(needle) ||
      membersOf(t.id).some(m => m.name.toLowerCase().includes(needle)),
    )
  }, [ordered, q, competitors])

  // ── Selected: render the right control for this team ──
  const selected = teams.find(t => t.id === selectedId)
  const selectedEntry = selectedId ? entryFor(selectedId) : null
  if (selected && selectedEntry) {
    const common = {
      event,
      entry: selectedEntry,
      label: selected.name,
      onLocalChange,
      onBack: () => setSelectedId(null),
    }
    if (event.scoring_mode === 'reps') return <JudgeCounter {...common} />
    if (event.scoring_mode === 'measure_max') return <JudgeMeasure {...common} />
    return <JudgeTimer {...common} />
  }

  // ── Team list ──
  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col select-none" style={brandVars(event.slug)}>
      <div className="px-4 pt-4 pb-3 border-b border-zinc-900">
        <p className="text-xs text-zinc-500 font-mono">{event.name}</p>
        <p className="text-sm font-bold text-white">{label}</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3">
          <Search size={16} className="text-zinc-500" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search team or athlete…"
            className="flex-1 bg-transparent py-2.5 text-white text-sm outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <Users size={40} className="text-zinc-700 mb-4" />
          <p className="text-zinc-400 text-sm">No teams yet. Ask the organiser to create teams and assign athletes.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {filtered.map(t => {
            const e = entryFor(t.id)
            const gender = teamGenderOf(competitors, t.id)
            const members = membersOf(t.id)
            const done = e && (e.time_ms != null)
            const running = e?.timer_running
            return (
              <li key={t.id}>
                <button
                  onClick={() => selectTeam(t)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-900 disabled:opacity-50"
                >
                  {gender && (
                    <span className={`text-[10px] font-bold w-5 shrink-0 ${gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{gender}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{t.name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {members.length ? members.map(m => m.name).join(' · ') : 'No athletes assigned'}
                    </p>
                  </div>
                  {done ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-400 shrink-0">
                      <CheckCircle2 size={14} />
                      {entryValue(e!, event.scoring_mode, event.unit)}
                    </span>
                  ) : running ? (
                    <span className="text-xs font-bold text-[var(--brand-text,#4d7bff)] shrink-0">Running…</span>
                  ) : (
                    <span className="text-xs text-zinc-600 shrink-0">Tap to score</span>
                  )}
                  <ChevronRight size={16} className="text-zinc-700 shrink-0" />
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-zinc-600 text-sm">No teams match.</li>
          )}
        </ul>
      )}
    </div>
  )
}
