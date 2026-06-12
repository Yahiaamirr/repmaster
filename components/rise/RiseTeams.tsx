'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, Users, Shuffle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RiseCompetitor, RiseTeam } from '@/types/rise'

// Group an event's individual competitors into teams: create/rename/delete
// teams and assign each athlete to one (or leave them unassigned). Writes go
// straight through the authenticated browser client (RLS allows admin writes).
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
    let athM = competitors.filter(c => c.team_id && c.gender === 'M').length + uM.length
    let athF = competitors.filter(c => c.team_id && c.gender === 'F').length + uF.length
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
      if (ids.length === 0) return list.length // leftovers
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

  const unassigned = competitors.filter(c => !c.team_id).length

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#4d7bff] uppercase tracking-wider mb-1">
        <Users size={15} /> Teams
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Create teams and assign athletes. {unassigned > 0 && <span className="text-zinc-400">{unassigned} unassigned.</span>}
      </p>

      {unassigned > 0 && teams.length > 0 && (
        <button
          onClick={randomAssign}
          disabled={busy}
          className="flex items-center gap-1.5 mb-4 px-3 py-2 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          title="Randomly distribute unassigned athletes into teams, keeping men and women on separate teams"
        >
          <Shuffle size={15} /> Randomly assign {unassigned} unassigned
        </button>
      )}

      {/* Teams + add */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {teams.map(t => {
          const count = competitors.filter(c => c.team_id === t.id).length
          return editId === t.id ? (
            <span key={t.id} className="flex items-center gap-1 bg-zinc-800 border border-[#2f5fe0]/50 rounded-lg px-2 py-1">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveRename(t.id); if (e.key === 'Escape') setEditId(null) }}
                className="bg-transparent text-sm text-white outline-none w-24"
              />
              <button onClick={() => saveRename(t.id)} className="text-green-400" title="Save"><Check size={14} /></button>
              <button onClick={() => setEditId(null)} className="text-zinc-400" title="Cancel"><X size={14} /></button>
            </span>
          ) : (
            <span key={t.id} className="group flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5">
              <span className="text-sm font-semibold text-white">{t.name}</span>
              <span className="text-[10px] text-zinc-500 tabular-nums">{count}</span>
              <button onClick={() => { setEditId(t.id); setEditName(t.name) }}
                className="text-zinc-500 hover:text-[#4d7bff] opacity-0 group-hover:opacity-100 transition-opacity" title="Rename"><Pencil size={12} /></button>
              <button onClick={() => deleteTeam(t)}
                className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete"><Trash2 size={12} /></button>
            </span>
          )
        })}
        <form onSubmit={addTeam} className="flex items-center gap-1.5">
          <input
            value={newTeam}
            onChange={e => setNewTeam(e.target.value)}
            placeholder="New team"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-[#2f5fe0] w-32"
          />
          <button type="submit" disabled={!newTeam.trim() || busy}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
            <Plus size={14} />
          </button>
        </form>
      </div>

      {/* Assignment list */}
      {competitors.length === 0 ? (
        <p className="text-zinc-500 text-sm">No athletes yet. Add athletes first, then group them into teams.</p>
      ) : (
        <ul className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
          {competitors.map(c => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/60">
              <span className={`text-[10px] font-bold w-4 ${c.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{c.gender}</span>
              <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate">{c.name}</span>
              <select
                value={c.team_id ?? ''}
                onChange={e => assign(c.id, e.target.value || null)}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white outline-none focus:border-[#2f5fe0]"
              >
                <option value="">Unassigned</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
