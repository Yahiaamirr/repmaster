'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, Users, Shuffle, Search, UserMinus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RiseCompetitor, RiseTeam } from '@/types/rise'

// Group an event's individual competitors into teams. Master–detail UI:
// a sidebar of teams (plus an "Unassigned" bucket), and a detail pane to add
// athletes to the selected team or assign teams to unassigned athletes.
// Writes go through the authenticated browser client (RLS allows admin writes).
export function RiseTeams({
  eventId,
  initialTeams,
  initialCompetitors,
}: {
  eventId: string
  initialTeams: RiseTeam[]
  initialCompetitors: RiseCompetitor[]
}) {
  const supabase = createClient()
  const [teams, setTeams] = useState<RiseTeam[]>(initialTeams)
  const [competitors, setCompetitors] = useState<RiseCompetitor[]>(initialCompetitors)

  const [selected, setSelected] = useState<string>('unassigned') // team id | 'unassigned'
  const [search, setSearch] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)

  // Keep teams + roster fresh if athletes are added elsewhere (e.g. self-registration).
  useEffect(() => {
    const refetch = async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase.from('rise_teams').select('*').eq('event_id', eventId).order('display_order'),
        supabase.from('rise_competitors').select('*').eq('event_id', eventId).order('name'),
      ])
      if (t) setTeams(t as RiseTeam[])
      if (c) setCompetitors(c as RiseCompetitor[])
    }
    const channel = supabase
      .channel(`rise-teams-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_teams', filter: `event_id=eq.${eventId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_competitors', filter: `event_id=eq.${eventId}` }, refetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId])

  async function addTeam(e: React.FormEvent) {
    e.preventDefault()
    const name = newTeam.trim()
    if (!name || busy) return
    setBusy(true)
    const display_order = (teams[teams.length - 1]?.display_order ?? 0) + 1
    const { data } = await supabase
      .from('rise_teams')
      .insert({ event_id: eventId, name, display_order })
      .select('*')
      .single()
    if (data) { setTeams(prev => [...prev, data as RiseTeam]); setSelected((data as RiseTeam).id) }
    setNewTeam('')
    setBusy(false)
  }

  async function saveRename(id: string) {
    const name = editName.trim()
    if (!name) return
    setTeams(prev => prev.map(t => (t.id === id ? { ...t, name } : t)))
    setEditId(null)
    await supabase.from('rise_teams').update({ name }).eq('id', id)
  }

  async function deleteTeam(t: RiseTeam) {
    const members = competitors.filter(c => c.team_id === t.id).length
    const msg = members > 0
      ? `Delete “${t.name}”? Its ${members} member(s) become unassigned (athletes are kept).`
      : `Delete “${t.name}”?`
    if (!window.confirm(msg)) return
    setTeams(prev => prev.filter(x => x.id !== t.id))
    setCompetitors(prev => prev.map(c => (c.team_id === t.id ? { ...c, team_id: null } : c)))
    if (selected === t.id) setSelected('unassigned')
    await supabase.from('rise_teams').delete().eq('id', t.id)
  }

  async function assign(competitorId: string, teamId: string | null) {
    setCompetitors(prev => prev.map(c => (c.id === competitorId ? { ...c, team_id: teamId } : c)))
    await supabase.from('rise_competitors').update({ team_id: teamId }).eq('id', competitorId)
  }

  // A team's gender is the majority of its current members (empty = undetermined).
  function teamGender(teamId: string): 'M' | 'F' | null {
    const members = competitors.filter(c => c.team_id === teamId)
    if (members.length === 0) return null
    const m = members.filter(c => c.gender === 'M').length
    return m >= members.length - m ? 'M' : 'F'
  }

  // Randomly distribute unassigned athletes into teams, keeping each team
  // single-gender: existing team genders are respected, empty teams are split
  // between men/women by need, then each gender is spread evenly (smallest team
  // first) across its teams.
  async function randomAssign() {
    const pool = competitors.filter(c => !c.team_id)
    if (pool.length === 0 || teams.length === 0 || busy) return
    if (!window.confirm(
      `Randomly assign ${pool.length} unassigned athlete(s) into teams, keeping men and women on separate teams?`
    )) return

    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    const uM = shuffle(pool.filter(c => c.gender === 'M'))
    const uF = shuffle(pool.filter(c => c.gender === 'F'))

    const gender: Record<string, 'M' | 'F' | null> = {}
    const count: Record<string, number> = {}
    for (const t of teams) {
      gender[t.id] = teamGender(t.id)
      count[t.id] = competitors.filter(c => c.team_id === t.id).length
    }

    // Allocate empty teams to the gender whose teams are currently most crowded.
    const athM = competitors.filter(c => c.team_id && c.gender === 'M').length + uM.length
    const athF = competitors.filter(c => c.team_id && c.gender === 'F').length + uF.length
    let teamsM = teams.filter(t => gender[t.id] === 'M').length
    let teamsF = teams.filter(t => gender[t.id] === 'F').length
    for (const t of teams.filter(t => gender[t.id] === null)) {
      const rM = athM > 0 ? (teamsM === 0 ? Infinity : athM / teamsM) : -1
      const rF = athF > 0 ? (teamsF === 0 ? Infinity : athF / teamsF) : -1
      if (rM < 0 && rF < 0) break
      if (rM >= rF) { gender[t.id] = 'M'; teamsM++ } else { gender[t.id] = 'F'; teamsF++ }
    }

    // Spread each gender's athletes into its teams, smallest team first.
    const assignment: Record<string, string> = {}
    const place = (list: RiseCompetitor[], g: 'M' | 'F') => {
      const ids = teams.filter(t => gender[t.id] === g).map(t => t.id)
      if (ids.length === 0) return list.length
      for (const c of list) {
        const best = ids.reduce((a, b) => (count[b] < count[a] ? b : a), ids[0])
        assignment[c.id] = best
        count[best]++
      }
      return 0
    }
    const leftover = place(uM, 'M') + place(uF, 'F')

    setBusy(true)
    setCompetitors(prev => prev.map(c => (assignment[c.id] ? { ...c, team_id: assignment[c.id] } : c)))
    const byTeam = new Map<string, string[]>()
    for (const [cid, tid] of Object.entries(assignment)) {
      byTeam.set(tid, [...(byTeam.get(tid) ?? []), cid])
    }
    await Promise.all(
      [...byTeam.entries()].map(([tid, ids]) =>
        supabase.from('rise_competitors').update({ team_id: tid }).in('id', ids)
      )
    )
    setBusy(false)
    if (leftover > 0) {
      window.alert(`${leftover} athlete(s) couldn’t be placed — add more teams for that gender and run it again.`)
    }
  }

  const unassigned = useMemo(() => competitors.filter(c => !c.team_id), [competitors])
  const selectedTeam = teams.find(t => t.id === selected) ?? null
  const members = useMemo(
    () => competitors.filter(c => c.team_id === selected).sort((a, b) => a.name.localeCompare(b.name)),
    [competitors, selected],
  )
  const matchesSearch = (c: RiseCompetitor) => c.name.toLowerCase().includes(search.trim().toLowerCase())

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#4d7bff] uppercase tracking-wider">
          <Users size={15} /> Teams
        </h2>
        <span className="text-xs text-zinc-500">{teams.length} teams · {unassigned.length} unassigned</span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Pick a team to add athletes, or open “Unassigned” to assign athletes to a team.</p>

      <div className="grid sm:grid-cols-[210px_1fr] gap-4">
        {/* ── Sidebar: teams + unassigned ── */}
        <div className="space-y-1.5">
          <SidebarItem
            active={selected === 'unassigned'}
            onClick={() => setSelected('unassigned')}
            label="Unassigned"
            count={unassigned.length}
            muted
          />
          <div className="h-px bg-zinc-800 my-1" />
          {teams.map(t => {
            const count = competitors.filter(c => c.team_id === t.id).length
            if (editId === t.id) {
              return (
                <div key={t.id} className="flex items-center gap-1 bg-zinc-800 border border-[#2f5fe0]/50 rounded-lg px-2 py-1.5">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(t.id); if (e.key === 'Escape') setEditId(null) }}
                    className="flex-1 min-w-0 bg-transparent text-sm text-white outline-none"
                  />
                  <button onClick={() => saveRename(t.id)} className="text-green-400" title="Save"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="text-zinc-400" title="Cancel"><X size={14} /></button>
                </div>
              )
            }
            return (
              <SidebarItem
                key={t.id}
                active={selected === t.id}
                onClick={() => setSelected(t.id)}
                label={t.name}
                count={count}
                onRename={() => { setEditId(t.id); setEditName(t.name) }}
                onDelete={() => deleteTeam(t)}
              />
            )
          })}
          <form onSubmit={addTeam} className="flex items-center gap-1.5 pt-1">
            <input
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              placeholder="New team"
              className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#2f5fe0]"
            />
            <button type="submit" disabled={!newTeam.trim() || busy}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              <Plus size={14} />
            </button>
          </form>
        </div>

        {/* ── Detail pane ── */}
        <div className="min-h-[320px]">
          {selected === 'unassigned' ? (
            <UnassignedPane
              unassigned={unassigned}
              teams={teams}
              search={search}
              setSearch={setSearch}
              matchesSearch={matchesSearch}
              assign={assign}
              randomAssign={randomAssign}
              busy={busy}
            />
          ) : selectedTeam ? (
            <TeamPane
              team={selectedTeam}
              members={members}
              unassigned={unassigned}
              search={search}
              setSearch={setSearch}
              matchesSearch={matchesSearch}
              assign={assign}
            />
          ) : (
            <p className="text-zinc-500 text-sm">Select a team.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SidebarItem({
  active, onClick, label, count, muted, onRename, onDelete,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  muted?: boolean
  onRename?: () => void
  onDelete?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
        active ? 'bg-[#2f5fe0]/15 border border-[#2f5fe0]/50' : 'border border-transparent hover:bg-zinc-800/70'
      }`}
    >
      <span className={`flex-1 min-w-0 text-sm font-semibold truncate ${muted && !active ? 'text-zinc-400' : 'text-white'}`}>{label}</span>
      <span className="text-[11px] text-zinc-500 tabular-nums">{count}</span>
      {onRename && (
        <button onClick={e => { e.stopPropagation(); onRename() }}
          className="text-zinc-500 hover:text-[#4d7bff] opacity-0 group-hover:opacity-100 transition-opacity" title="Rename"><Pencil size={12} /></button>
      )}
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete"><Trash2 size={12} /></button>
      )}
    </div>
  )
}

function GenderBadge({ g }: { g: 'M' | 'F' }) {
  return <span className={`text-[10px] font-bold w-4 shrink-0 ${g === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{g}</span>
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 mb-2">
      <Search size={15} className="text-zinc-500" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-zinc-600" />
    </div>
  )
}

// Detail pane for the Unassigned bucket: assign each athlete to a team.
function UnassignedPane({
  unassigned, teams, search, setSearch, matchesSearch, assign, randomAssign, busy,
}: {
  unassigned: RiseCompetitor[]
  teams: RiseTeam[]
  search: string
  setSearch: (v: string) => void
  matchesSearch: (c: RiseCompetitor) => boolean
  assign: (competitorId: string, teamId: string | null) => void
  randomAssign: () => void
  busy: boolean
}) {
  const list = unassigned.filter(matchesSearch)
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-white">Unassigned · {unassigned.length}</h3>
        {unassigned.length > 0 && teams.length > 0 && (
          <button onClick={randomAssign} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            title="Randomly distribute into teams, keeping men and women on separate teams">
            <Shuffle size={14} /> Auto-assign
          </button>
        )}
      </div>
      {unassigned.length === 0 ? (
        <p className="text-zinc-500 text-sm">Everyone is on a team. 🎉</p>
      ) : (
        <>
          <SearchBox value={search} onChange={setSearch} placeholder="Search athlete…" />
          <ul className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
            {list.map(c => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/60">
                <GenderBadge g={c.gender} />
                <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate">{c.name}</span>
                <select
                  value=""
                  onChange={e => e.target.value && assign(c.id, e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-[#2f5fe0]"
                >
                  <option value="">Assign to…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </li>
            ))}
            {list.length === 0 && <li className="px-2 py-6 text-center text-zinc-600 text-sm">No athletes match.</li>}
          </ul>
        </>
      )}
    </div>
  )
}

// Detail pane for a team: list members, remove them, and add unassigned athletes.
function TeamPane({
  team, members, unassigned, search, setSearch, matchesSearch, assign,
}: {
  team: RiseTeam
  members: RiseCompetitor[]
  unassigned: RiseCompetitor[]
  search: string
  setSearch: (v: string) => void
  matchesSearch: (c: RiseCompetitor) => boolean
  assign: (competitorId: string, teamId: string | null) => void
}) {
  const addable = unassigned.filter(matchesSearch)
  return (
    <div>
      <h3 className="text-sm font-bold text-white mb-2">{team.name} · {members.length}</h3>

      {/* Members */}
      {members.length === 0 ? (
        <p className="text-zinc-500 text-sm mb-4">No athletes on this team yet — add some below.</p>
      ) : (
        <ul className="space-y-1 mb-4">
          {members.map(c => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg bg-zinc-800/50 px-2 py-1.5">
              <GenderBadge g={c.gender} />
              <span className="flex-1 min-w-0 text-sm text-white truncate">{c.name}</span>
              <button onClick={() => assign(c.id, null)} title="Remove from team"
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors">
                <UserMinus size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add unassigned */}
      <div className="border-t border-zinc-800 pt-3">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Add athletes <span className="text-zinc-600">· {unassigned.length} unassigned</span>
        </p>
        {unassigned.length === 0 ? (
          <p className="text-zinc-600 text-sm">No unassigned athletes left.</p>
        ) : (
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Search unassigned…" />
            <ul className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
              {addable.map(c => (
                <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/60">
                  <GenderBadge g={c.gender} />
                  <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate">{c.name}</span>
                  <button onClick={() => assign(c.id, team.id)} title={`Add to ${team.name}`}
                    className="flex items-center gap-1 px-2 py-1 bg-[#2f5fe0] hover:bg-[#2348b8] text-white text-xs font-semibold rounded-md transition-colors">
                    <Plus size={13} /> Add
                  </button>
                </li>
              ))}
              {addable.length === 0 && <li className="px-2 py-6 text-center text-zinc-600 text-sm">No athletes match.</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
