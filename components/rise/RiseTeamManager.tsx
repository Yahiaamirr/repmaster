'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, Users, Shuffle, Search, UserPlus, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RiseCompetitor, RiseTeam } from '@/types/rise'

// Manage which athletes are on which team. Every team is shown as a card at once
// (no master/detail pane switching) so members can be added/removed across teams
// quickly. Used on the event setup page (with team create/rename/delete +
// auto-assign) and in the live control room (add/remove only).
// Writes go through the authenticated browser client; realtime keeps surfaces in sync.
export function RiseTeamManager({
  eventId,
  initialTeams,
  initialCompetitors,
  allowTeamEdits = false,
  collapsible = false,
  defaultOpen = true,
}: {
  eventId: string
  initialTeams: RiseTeam[]
  initialCompetitors: RiseCompetitor[]
  allowTeamEdits?: boolean
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const supabase = createClient()
  const [teams, setTeams] = useState<RiseTeam[]>(initialTeams)
  const [competitors, setCompetitors] = useState<RiseCompetitor[]>(initialCompetitors)
  const [busy, setBusy] = useState(false)
  const [newTeam, setNewTeam] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addingTo, setAddingTo] = useState<string | null>(null) // team whose add-picker is open
  const [addSearch, setAddSearch] = useState('')
  const [open, setOpen] = useState(defaultOpen)

  // Keep teams + roster fresh if athletes are reassigned elsewhere (other device,
  // setup page vs control room, self-registration).
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
      .channel(`rise-teammgr-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_teams', filter: `event_id=eq.${eventId}` }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_competitors', filter: `event_id=eq.${eventId}` }, refetch)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, eventId])

  const unassigned = useMemo(
    () => competitors.filter(c => !c.team_id).sort((a, b) => a.name.localeCompare(b.name)),
    [competitors],
  )
  const membersOf = (teamId: string) =>
    competitors.filter(c => c.team_id === teamId).sort((a, b) => a.name.localeCompare(b.name))

  // A team's gender is the majority of its current members (empty = undetermined).
  function teamGender(teamId: string): 'M' | 'F' | null {
    const members = competitors.filter(c => c.team_id === teamId)
    if (members.length === 0) return null
    const m = members.filter(c => c.gender === 'M').length
    return m >= members.length - m ? 'M' : 'F'
  }

  async function assign(competitorId: string, teamId: string | null) {
    setCompetitors(prev => prev.map(c => (c.id === competitorId ? { ...c, team_id: teamId } : c)))
    await supabase.from('rise_competitors').update({ team_id: teamId }).eq('id', competitorId)
  }

  // Create a brand-new athlete directly on a team (quick-add for walk-ins / no-show swaps).
  async function createMember(teamId: string, name: string, gender: 'M' | 'F') {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    const { data } = await supabase
      .from('rise_competitors')
      .insert({ event_id: eventId, name: trimmed, gender, team_id: teamId })
      .select('*')
      .single()
    if (data) setCompetitors(prev => [...prev, data as RiseCompetitor])
    setBusy(false)
  }

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
    if (data) setTeams(prev => [...prev, data as RiseTeam])
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
    if (addingTo === t.id) setAddingTo(null)
    await supabase.from('rise_teams').delete().eq('id', t.id)
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

  function toggleAdd(teamId: string) {
    setAddSearch('')
    setAddingTo(prev => (prev === teamId ? null : teamId))
  }

  const headerRight = (
    <span className="text-xs text-zinc-500">{teams.length} teams · {unassigned.length} unassigned</span>
  )

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      {/* Header */}
      {collapsible ? (
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 text-left">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#4d7bff] uppercase tracking-wider">
            <Users size={15} /> Teams
          </h2>
          <div className="flex items-center gap-3">
            {headerRight}
            <ChevronDown size={16} className={`text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#4d7bff] uppercase tracking-wider">
            <Users size={15} /> Teams
          </h2>
          {headerRight}
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          {/* Toolbar: auto-assign + new team (setup only) */}
          {allowTeamEdits && (
            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={addTeam} className="flex items-center gap-1.5">
                <input
                  value={newTeam}
                  onChange={e => setNewTeam(e.target.value)}
                  placeholder="New team"
                  className="w-44 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#2f5fe0]"
                />
                <button type="submit" disabled={!newTeam.trim() || busy}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Plus size={14} /> Team
                </button>
              </form>
              {unassigned.length > 0 && teams.length > 0 && (
                <button onClick={randomAssign} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  title="Randomly distribute unassigned into teams, keeping men and women on separate teams">
                  <Shuffle size={14} /> Auto-assign
                </button>
              )}
            </div>
          )}

          {teams.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              {allowTeamEdits ? 'No teams yet — add one above.' : 'No teams have been created for this event yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  members={membersOf(team.id)}
                  gender={teamGender(team.id)}
                  unassigned={unassigned}
                  allowTeamEdits={allowTeamEdits}
                  busy={busy}
                  isEditing={editId === team.id}
                  editName={editName}
                  setEditName={setEditName}
                  onStartRename={() => { setEditId(team.id); setEditName(team.name) }}
                  onSaveRename={() => saveRename(team.id)}
                  onCancelRename={() => setEditId(null)}
                  onDelete={() => deleteTeam(team)}
                  isAdding={addingTo === team.id}
                  onToggleAdd={() => toggleAdd(team.id)}
                  addSearch={addSearch}
                  setAddSearch={setAddSearch}
                  onAdd={(id) => assign(id, team.id)}
                  onRemove={(id) => assign(id, null)}
                  onCreate={(name, gender) => createMember(team.id, name, gender)}
                />
              ))}
              <UnassignedCard unassigned={unassigned} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GenderBadge({ g }: { g: 'M' | 'F' }) {
  return <span className={`text-[10px] font-bold ${g === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{g}</span>
}

function TeamCard({
  team, members, gender, unassigned, allowTeamEdits, busy,
  isEditing, editName, setEditName, onStartRename, onSaveRename, onCancelRename, onDelete,
  isAdding, onToggleAdd, addSearch, setAddSearch, onAdd, onRemove, onCreate,
}: {
  team: RiseTeam
  members: RiseCompetitor[]
  gender: 'M' | 'F' | null
  unassigned: RiseCompetitor[]
  allowTeamEdits: boolean
  busy: boolean
  isEditing: boolean
  editName: string
  setEditName: (v: string) => void
  onStartRename: () => void
  onSaveRename: () => void
  onCancelRename: () => void
  onDelete: () => void
  isAdding: boolean
  onToggleAdd: () => void
  addSearch: string
  setAddSearch: (v: string) => void
  onAdd: (competitorId: string) => void
  onRemove: (competitorId: string) => void
  onCreate: (name: string, gender: 'M' | 'F') => void
}) {
  const addable = unassigned.filter(c => c.name.toLowerCase().includes(addSearch.trim().toLowerCase()))
  const [newName, setNewName] = useState('')
  const [newGender, setNewGender] = useState<'M' | 'F'>('M')

  function submitNew(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    onCreate(newName, newGender)
    setNewName('')
  }
  return (
    <div className="group/card flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 min-h-[26px]">
        {gender && <GenderBadge g={gender} />}
        {isEditing ? (
          <>
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSaveRename(); if (e.key === 'Escape') onCancelRename() }}
              className="flex-1 min-w-0 bg-zinc-800 border border-[#2f5fe0]/50 rounded px-2 py-1 text-sm text-white outline-none"
            />
            <button onClick={onSaveRename} className="text-green-400" title="Save"><Check size={14} /></button>
            <button onClick={onCancelRename} className="text-zinc-400" title="Cancel"><X size={14} /></button>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-0 font-bold text-white truncate">{team.name}</span>
            <span className="text-[11px] text-zinc-500 tabular-nums">{members.length}</span>
            {allowTeamEdits && (
              <>
                <button onClick={onStartRename} title="Rename"
                  className="text-zinc-500 hover:text-[#4d7bff] opacity-0 group-hover/card:opacity-100 transition-opacity"><Pencil size={12} /></button>
                <button onClick={onDelete} title="Delete"
                  className="text-zinc-500 hover:text-red-400 opacity-0 group-hover/card:opacity-100 transition-opacity"><Trash2 size={12} /></button>
              </>
            )}
          </>
        )}
      </div>

      {/* Members */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {members.length === 0 ? (
          <span className="text-xs text-zinc-600 italic">No members yet</span>
        ) : (
          members.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-zinc-800 pl-2 pr-1 py-0.5 text-xs text-zinc-200">
              <GenderBadge g={c.gender} />
              <span className="truncate max-w-[110px]">{c.name}</span>
              <button onClick={() => onRemove(c.id)} title="Remove from team"
                className="text-zinc-500 hover:text-red-400 transition-colors"><X size={12} /></button>
            </span>
          ))
        )}
      </div>

      {/* Add member */}
      <div className="mt-auto pt-1">
        <button onClick={onToggleAdd} disabled={busy}
          className="flex items-center gap-1 text-xs font-semibold text-[#4d7bff] hover:text-white transition-colors disabled:opacity-50">
          <UserPlus size={13} /> {isAdding ? 'Done' : 'Add member'}
        </button>
        {isAdding && (
          <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 space-y-2">
            {/* Pick an existing unassigned athlete */}
            {unassigned.length > 0 && (
              <div>
                {unassigned.length > 6 && (
                  <div className="flex items-center gap-2 rounded-md bg-zinc-800 border border-zinc-700 px-2 mb-1.5">
                    <Search size={13} className="text-zinc-500" />
                    <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Search unassigned…"
                      className="flex-1 bg-transparent py-1.5 text-xs text-white outline-none placeholder:text-zinc-600" />
                  </div>
                )}
                <ul className="max-h-44 overflow-y-auto space-y-0.5 pr-0.5">
                  {addable.map(c => (
                    <li key={c.id}>
                      <button onClick={() => onAdd(c.id)}
                        className="w-full flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-zinc-200 hover:bg-zinc-800 transition-colors">
                        <GenderBadge g={c.gender} />
                        <span className="flex-1 min-w-0 truncate">{c.name}</span>
                        <Plus size={12} className="text-[#4d7bff]" />
                      </button>
                    </li>
                  ))}
                  {addable.length === 0 && <li className="px-2 py-2 text-center text-zinc-600 text-xs">No match.</li>}
                </ul>
              </div>
            )}

            {/* Create a brand-new athlete on this team */}
            <form onSubmit={submitNew} className={`flex items-center gap-1.5 ${unassigned.length > 0 ? 'pt-2 border-t border-zinc-800/70' : ''}`}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="New athlete name…"
                className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#2f5fe0] placeholder:text-zinc-600"
              />
              <div className="flex rounded overflow-hidden border border-zinc-700 shrink-0">
                {(['M', 'F'] as const).map(g => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setNewGender(g)}
                    className={`px-2 py-1.5 text-xs font-bold transition-colors ${
                      newGender === g
                        ? g === 'F' ? 'bg-pink-500/20 text-pink-300' : 'bg-sky-500/20 text-sky-300'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={!newName.trim() || busy}
                className="flex items-center gap-1 px-2 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors shrink-0"
              >
                <UserPlus size={12} /> Add
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function UnassignedCard({ unassigned }: { unassigned: RiseCompetitor[] }) {
  return (
    <div className="flex flex-col rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-3">
      <div className="flex items-center gap-2 mb-2 min-h-[26px]">
        <span className="flex-1 min-w-0 font-bold text-zinc-400 truncate">Unassigned</span>
        <span className="text-[11px] text-zinc-500 tabular-nums">{unassigned.length}</span>
      </div>
      {unassigned.length === 0 ? (
        <span className="text-xs text-zinc-600 italic">Everyone is on a team 🎉</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {unassigned.map(c => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-400">
              <GenderBadge g={c.gender} />
              <span className="truncate max-w-[110px]">{c.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
