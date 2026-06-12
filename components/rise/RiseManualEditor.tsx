'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Wand2, Save, RotateCcw, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { rankEntries, entryValue, isTeamScored } from '@/types/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseManualResult, RiseTeam } from '@/types/rise'

type Row = {
  competitor_id: string | null
  team_id: string | null
  name: string
  gender: 'M' | 'F' | null
  included: boolean
  value: string
}

// Build editor rows from the roster, pre-filled with any saved manual results.
function buildRows(
  competitors: RiseCompetitor[],
  teams: RiseTeam[],
  isTeam: boolean,
  manual: RiseManualResult[],
): Row[] {
  if (isTeam) {
    const byTeam = new Map(manual.filter(m => m.team_id).map(m => [m.team_id, m]))
    const rows = teams.map(t => {
      const m = byTeam.get(t.id)
      return { competitor_id: null, team_id: t.id, name: t.name, gender: null, included: m?.included ?? true, value: m?.value_text ?? '', rank: m?.manual_rank ?? 9999 }
    })
    return sortByRank(rows)
  }
  const byComp = new Map(manual.filter(m => m.competitor_id).map(m => [m.competitor_id, m]))
  const rows = competitors.map(c => {
    const m = byComp.get(c.id)
    return { competitor_id: c.id, team_id: null, name: c.name, gender: c.gender, included: m?.included ?? true, value: m?.value_text ?? '', rank: m?.manual_rank ?? 9999 }
  })
  return sortByRank(rows)
}

function sortByRank(rows: (Row & { rank: number })[]): Row[] {
  return [...rows]
    .sort((a, b) => (a.rank - b.rank) || a.name.localeCompare(b.name))
    .map(({ rank: _rank, ...r }) => r)
}

export function RiseManualEditor({
  event,
  competitors,
  teams,
  initialManual,
  initialEntries,
}: {
  event: RiseEvent
  competitors: RiseCompetitor[]
  teams: RiseTeam[]
  initialManual: RiseManualResult[]
  initialEntries: RiseEntry[]
}) {
  const supabase = createClient()
  const router = useRouter()
  const isTeam = isTeamScored(event)
  const [rows, setRows] = useState<Row[]>(() => buildRows(competitors, teams, isTeam, initialManual))
  const [published, setPublished] = useState(!!event.manual_leaderboard)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  // Genders present, as columns (individual events split Men / Women like the board).
  const groups: { key: 'M' | 'F' | 'all'; label: string | null }[] = isTeam
    ? [{ key: 'all', label: null }]
    : [{ key: 'M', label: 'Men' }, { key: 'F', label: 'Women' }]

  const rowsOf = (key: 'M' | 'F' | 'all') => (key === 'all' ? rows : rows.filter(r => r.gender === key))

  function patch(idx: number, next: Partial<Row>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...next } : r)))
  }

  // Reorder within a group by swapping the two underlying global indices.
  function move(key: 'M' | 'F' | 'all', groupIdx: number, dir: -1 | 1) {
    const groupRows = rowsOf(key)
    const target = groupIdx + dir
    if (target < 0 || target >= groupRows.length) return
    const aId = groupRows[groupIdx]
    const bId = groupRows[target]
    setRows(prev => {
      const next = [...prev]
      const ai = next.indexOf(aId)
      const bi = next.indexOf(bId)
      ;[next[ai], next[bi]] = [next[bi], next[ai]]
      return next
    })
  }

  // Fill values + order from the current live scoring.
  function prefillFromLive() {
    if (isTeam) {
      // Rank team entries by the event's scoring mode (reps, fastest time, etc.).
      const entryForTeam = (tid: string) => initialEntries.find(e => e.team_id === tid) ?? null
      const teamEntries = rows.map(r => entryForTeam(r.team_id!)).filter(Boolean) as RiseEntry[]
      const ranked = rankEntries(teamEntries, event.scoring_mode)
      const order = new Map(ranked.map((e, i) => [e.team_id, i]))
      const sorted = [...rows].sort((a, b) => (order.get(a.team_id!) ?? 999) - (order.get(b.team_id!) ?? 999))
      setRows(sorted.map(r => {
        const e = entryForTeam(r.team_id!)
        return { ...r, value: e ? entryValue(e, event.scoring_mode, event.unit) : r.value }
      }))
      return
    }
    // Individual: rank each gender separately using the event's scoring mode.
    const entryFor = (cid: string) => initialEntries.find(e => e.competitor_id === cid) ?? null
    const next: Row[] = []
    for (const g of ['M', 'F'] as const) {
      const groupRows = rows.filter(r => r.gender === g)
      const ranked = rankEntries(
        groupRows.map(r => entryFor(r.competitor_id!)).filter(Boolean) as RiseEntry[],
        event.scoring_mode,
      )
      const order = new Map(ranked.map((e, i) => [e.competitor_id, i]))
      const sorted = [...groupRows].sort(
        (a, b) => (order.get(a.competitor_id!) ?? 999) - (order.get(b.competitor_id!) ?? 999),
      )
      for (const r of sorted) {
        const e = entryFor(r.competitor_id!)
        next.push({ ...r, value: e ? entryValue(e, event.scoring_mode, event.unit) : r.value })
      }
    }
    setRows(next)
  }

  async function save(publish: boolean) {
    setBusy(true)
    setMsg('')
    // Rebuild ranks per group from the current row order.
    const payload: { event_id: string; competitor_id: string | null; team_id: string | null; value_text: string; manual_rank: number; included: boolean }[] = []
    for (const g of groups) {
      rowsOf(g.key).forEach((r, i) => {
        payload.push({
          event_id: event.id,
          competitor_id: r.competitor_id,
          team_id: r.team_id,
          value_text: r.value.trim(),
          manual_rank: i,
          included: r.included,
        })
      })
    }
    await supabase.from('rise_manual_results').delete().eq('event_id', event.id)
    if (payload.length) await supabase.from('rise_manual_results').insert(payload)
    await supabase.from('rise_events').update({ manual_leaderboard: publish }).eq('id', event.id)
    setPublished(publish)
    setBusy(false)
    setMsg(publish ? 'Saved & published — the public board now shows these standings.' : 'Saved.')
    router.refresh()
  }

  async function revertToLive() {
    if (!window.confirm('Clear the manual leaderboard and go back to live scoring on the public board?')) return
    setBusy(true)
    setMsg('')
    await supabase.from('rise_manual_results').delete().eq('event_id', event.id)
    await supabase.from('rise_events').update({ manual_leaderboard: false }).eq('id', event.id)
    setRows(buildRows(competitors, teams, isTeam, []))
    setPublished(false)
    setBusy(false)
    setMsg('Reverted to live scoring.')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${published ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
            {published ? 'Manual board live' : 'Live scoring'}
          </span>
          {msg && <span className="text-xs text-zinc-400">{msg}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={prefillFromLive} disabled={busy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors">
            <Wand2 size={14} /> Prefill from live
          </button>
          <button onClick={() => save(false)} disabled={busy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors">
            <Save size={14} /> Save draft
          </button>
          <button onClick={() => save(true)} disabled={busy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white rounded-lg font-semibold transition-colors">
            <Trophy size={14} /> Save &amp; publish
          </button>
          {published && (
            <button onClick={revertToLive} disabled={busy}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-400 border border-red-900/60 rounded-lg font-semibold transition-colors">
              <RotateCcw size={14} /> Revert to live
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isTeam ? '' : 'lg:grid-cols-2'} gap-5`}>
        {groups.map(g => {
          const list = rowsOf(g.key)
          return (
            <div key={g.key} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {g.label && (
                <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-800">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-300">{g.label}</span>
                </div>
              )}
              <ul className="divide-y divide-zinc-800/70">
                {list.map((r, i) => {
                  const globalIdx = rows.indexOf(r)
                  return (
                    <li key={r.competitor_id ?? r.team_id} className={`flex items-center gap-2 px-3 py-2 ${r.included ? '' : 'opacity-40'}`}>
                      <span className="w-6 text-center text-sm font-bold tabular-nums text-zinc-500">{i + 1}</span>
                      <div className="flex flex-col">
                        <button onClick={() => move(g.key, i, -1)} disabled={i === 0} className="text-zinc-500 hover:text-white disabled:opacity-20"><ChevronUp size={14} /></button>
                        <button onClick={() => move(g.key, i, 1)} disabled={i === list.length - 1} className="text-zinc-500 hover:text-white disabled:opacity-20"><ChevronDown size={14} /></button>
                      </div>
                      {r.gender && <span className={`text-[10px] font-bold w-3 ${r.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{r.gender}</span>}
                      <span className="flex-1 min-w-0 text-sm text-white truncate">{r.name}</span>
                      <input
                        value={r.value}
                        onChange={e => patch(globalIdx, { value: e.target.value })}
                        placeholder={event.unit}
                        className="w-24 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-sm text-white text-right outline-none focus:border-[#2f5fe0]"
                      />
                      <button
                        onClick={() => patch(globalIdx, { included: !r.included })}
                        title={r.included ? 'Shown — click to hide' : 'Hidden — click to show'}
                        className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${r.included ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                      >
                        {r.included ? 'Shown' : 'Hidden'}
                      </button>
                    </li>
                  )
                })}
                {list.length === 0 && <li className="px-4 py-6 text-center text-zinc-600 text-sm">No athletes.</li>}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
