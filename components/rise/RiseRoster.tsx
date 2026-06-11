'use client'

import { useMemo, useState } from 'react'
import { UserPlus, Loader2, Pencil, Trash2, Check, X, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RiseCompetitor, RiseGender } from '@/types/rise'

export function RiseRoster({
  eventId,
  initialCompetitors,
}: {
  eventId: string
  initialCompetitors: RiseCompetitor[]
}) {
  const supabase = createClient()
  const [list, setList] = useState<RiseCompetitor[]>(initialCompetitors)
  const [q, setQ] = useState('')

  // add form
  const [name, setName] = useState('')
  const [gender, setGender] = useState<RiseGender>('M')
  const [adding, setAdding] = useState(false)

  // inline edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGender, setEditGender] = useState<RiseGender>('M')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || adding) return
    setAdding(true)
    const { data } = await supabase
      .from('rise_competitors')
      .insert({ event_id: eventId, name: trimmed, gender })
      .select('*')
      .single()
    if (data) setList(prev => [...prev, data as RiseCompetitor])
    setName('')
    setAdding(false)
  }

  function startEdit(c: RiseCompetitor) {
    setEditId(c.id)
    setEditName(c.name)
    setEditGender(c.gender)
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) return
    setList(prev => prev.map(c => (c.id === id ? { ...c, name: trimmed, gender: editGender } : c)))
    setEditId(null)
    await supabase.from('rise_competitors').update({ name: trimmed, gender: editGender }).eq('id', id)
  }

  async function remove(c: RiseCompetitor) {
    if (!window.confirm(`Remove ${c.name} from this event? Any score they have here is deleted too.`)) return
    setList(prev => prev.filter(x => x.id !== c.id))
    await supabase.from('rise_competitors').delete().eq('id', c.id)
  }

  const filtered = useMemo(
    () => list.filter(c => c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [list, q]
  )
  const men = list.filter(c => c.gender === 'M').length
  const women = list.filter(c => c.gender === 'F').length

  return (
    <div>
      {/* Add */}
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Athlete name"
          className="flex-1 min-w-[150px] bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#2f5fe0]"
        />
        <GenderToggle value={gender} onChange={setGender} />
        <button
          type="submit"
          disabled={!name.trim() || adding}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#2f5fe0] hover:bg-[#2348b8] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Add
        </button>
      </form>

      {/* Count + search */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs text-zinc-500">
          <span className="text-[#4d7bff] font-bold">{list.length}</span> total ·{' '}
          <span className="text-[#4d7bff] font-bold">{men}</span> men ·{' '}
          <span className="text-[#4d7bff] font-bold">{women}</span> women
        </span>
        {list.length > 6 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-2">
            <Search size={13} className="text-zinc-500" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search"
              className="bg-transparent py-1.5 text-xs text-white outline-none w-24"
            />
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-500 text-sm py-4">No athletes{q ? ' match.' : ' yet. Add one above or share the registration QR.'}</p>
      ) : (
        <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {filtered.map(c => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800/60 group">
              {editId === c.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(c.id); if (e.key === 'Escape') setEditId(null) }}
                    className="flex-1 min-w-0 bg-zinc-800 border border-[#2f5fe0]/50 rounded px-2 py-1 text-sm text-white outline-none"
                  />
                  <GenderToggle value={editGender} onChange={setEditGender} small />
                  <button onClick={() => saveEdit(c.id)} className="p-1.5 text-green-400 hover:bg-zinc-700 rounded" title="Save"><Check size={15} /></button>
                  <button onClick={() => setEditId(null)} className="p-1.5 text-zinc-400 hover:bg-zinc-700 rounded" title="Cancel"><X size={15} /></button>
                </>
              ) : (
                <>
                  <span className={`text-[10px] font-bold w-4 ${c.gender === 'F' ? 'text-pink-400' : 'text-[#4d7bff]'}`}>{c.gender}</span>
                  <span className="flex-1 min-w-0 text-sm text-zinc-200 truncate">{c.name}</span>
                  <button onClick={() => startEdit(c)} className="p-1.5 text-zinc-500 hover:text-[#4d7bff] opacity-0 group-hover:opacity-100 transition-opacity" title="Edit"><Pencil size={14} /></button>
                  <button onClick={() => remove(c)} className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove"><Trash2 size={14} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GenderToggle({ value, onChange, small }: { value: RiseGender; onChange: (g: RiseGender) => void; small?: boolean }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-zinc-700 shrink-0">
      {(['M', 'F'] as const).map(g => (
        <button
          key={g}
          type="button"
          onClick={() => onChange(g)}
          className={`${small ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs'} font-bold uppercase transition-colors ${
            value === g ? 'bg-[#2f5fe0] text-white' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {g === 'M' ? 'M' : 'F'}
        </button>
      ))}
    </div>
  )
}
