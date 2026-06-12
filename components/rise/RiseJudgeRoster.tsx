'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ENTRY_SELECT, logJudge } from '@/lib/rise'
import { entryValue } from '@/types/rise'
import type { RiseCompetitor, RiseEntry, RiseEvent, RiseGender } from '@/types/rise'
import { JudgeCounter } from './JudgeCounter'
import { JudgeTimer } from './JudgeTimer'
import { JudgeMeasure } from './JudgeMeasure'
import { brandVars } from '@/lib/rise-theme'

export function RiseJudgeRoster({
  event,
  token,
  label,
  competitors,
  initialEntries,
}: {
  event: RiseEvent
  token: string
  label: string
  competitors: RiseCompetitor[]
  initialEntries: RiseEntry[]
}) {
  const supabase = createClient()
  const [entries, setEntries] = useState<RiseEntry[]>(initialEntries)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [gender, setGender] = useState<'all' | RiseGender>('all')
  const [creating, setCreating] = useState(false)

  // Keep recorded results fresh across devices.
  useEffect(() => {
    const channel = supabase
      .channel(`rise-roster-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_entries', filter: `event_id=eq.${event.id}` }, async () => {
        const { data } = await supabase.from('rise_entries').select(ENTRY_SELECT).eq('event_id', event.id)
        if (data) setEntries(data as RiseEntry[])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [event.id])

  const entryFor = (competitorId: string) => entries.find(e => e.competitor_id === competitorId) ?? null

  async function selectAthlete(c: RiseCompetitor) {
    let entry = entryFor(c.id)
    if (!entry) {
      setCreating(true)
      const { data } = await supabase
        .from('rise_entries')
        .insert({ event_id: event.id, competitor_id: c.id, status: 'pending' })
        .select(ENTRY_SELECT)
        .single()
      setCreating(false)
      if (data) {
        entry = data as RiseEntry
        setEntries(prev => [...prev, entry as RiseEntry])
      }
    }
    // Record who is judging this athlete (fire-and-forget).
    if (entry) logJudge(supabase, token, entry.id)
    setSelectedId(c.id)
  }

  function onLocalChange(next: Partial<RiseEntry>) {
    setEntries(prev => prev.map(e => (e.competitor_id === selectedId ? { ...e, ...next } : e)))
  }

  const filtered = useMemo(() => {
    return competitors
      .filter(c => (gender === 'all' ? true : c.gender === gender))
      .filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase()))
  }, [competitors, gender, q])

  // ── Selected: render the right control ──
  const selected = competitors.find(c => c.id === selectedId)
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

  // ── Roster list ──
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
            placeholder="Search athlete…"
            className="flex-1 bg-transparent py-2.5 text-white text-sm outline-none placeholder:text-zinc-600"
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          {(['all', 'M', 'F'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                gender === g ? 'bg-[var(--brand,#2f5fe0)] text-[var(--brand-contrast,#fff)]' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              {g === 'all' ? 'All' : g === 'M' ? 'Men' : 'Women'}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-zinc-900">
        {filtered.map(c => {
          const e = entryFor(c.id)
          const done =
            e &&
            (event.scoring_mode === 'reps'
              ? e.counter > 0
              : event.scoring_mode === 'measure_max'
              ? e.measure_value != null
              : e.time_ms != null)
          return (
            <li key={c.id}>
              <button
                onClick={() => selectAthlete(c)}
                disabled={creating}
                className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-zinc-900 disabled:opacity-50"
              >
                <span className={`text-[10px] font-bold w-5 ${c.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>
                  {c.gender}
                </span>
                <span className="flex-1 min-w-0 font-semibold text-white truncate">{c.name}</span>
                {done ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-green-400">
                    <CheckCircle2 size={14} />
                    {entryValue(e!, event.scoring_mode, event.unit)}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">Tap to score</span>
                )}
                <ChevronRight size={16} className="text-zinc-700" />
              </button>
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-zinc-600 text-sm">No athletes match.</li>
        )}
      </ul>
    </div>
  )
}
