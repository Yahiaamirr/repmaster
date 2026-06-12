'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react'
import type { RiseGender } from '@/types/rise'

type Added = { name: string; gender: RiseGender }

export function RiseSupervisorForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [name, setName] = useState('')
  const [gender, setGender] = useState<RiseGender | null>(null)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [error, setError] = useState('')
  const [added, setAdded] = useState<Added[]>([])
  const nameRef = useRef<HTMLInputElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !gender || status === 'submitting') return
    setStatus('submitting')
    setError('')
    try {
      const res = await fetch('/api/rise/supervisor-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name: name.trim(), gender, phone: phone.trim(), email: email.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.')
        setStatus('error')
        return
      }
      // Success: record, clear the form, keep gender for fast repeat entry.
      setAdded(prev => [{ name: name.trim(), gender }, ...prev])
      setName('')
      setPhone('')
      setEmail('')
      setStatus('idle')
      nameRef.current?.focus()
    } catch {
      setError('Network error. Try again.')
      setStatus('error')
    }
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={submit}>
        <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">Full name</label>
        <input
          ref={nameRef}
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Participant name"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-lg outline-none focus:border-[var(--brand,#2f5fe0)]"
        />

        <label className="block text-xs text-zinc-500 uppercase tracking-widest mt-5 mb-2">Category</label>
        <div className="grid grid-cols-2 gap-3">
          {(['M', 'F'] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              className={`py-4 rounded-2xl font-black text-lg uppercase tracking-wider transition-colors border ${
                gender === g
                  ? 'bg-[var(--brand,#2f5fe0)] border-[var(--brand,#2f5fe0)] text-[var(--brand-contrast,#fff)]'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              {g === 'M' ? 'Men' : 'Women'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 mt-5">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">Phone <span className="text-zinc-600 normal-case tracking-normal">(optional)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-[var(--brand,#2f5fe0)]"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">Email <span className="text-zinc-600 normal-case tracking-normal">(optional)</span></label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3.5 text-white outline-none focus:border-[var(--brand,#2f5fe0)]"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

        <button
          type="submit"
          disabled={!name.trim() || !gender || status === 'submitting'}
          className="mt-7 w-full py-4 bg-[var(--brand,#2f5fe0)] active:bg-[var(--brand-press,#2348b8)] disabled:opacity-40 text-[var(--brand-contrast,#fff)] font-black text-lg rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {status === 'submitting' ? <Loader2 size={20} className="animate-spin" /> : <UserPlus size={20} />}
          Add participant
        </button>
      </form>

      {added.length > 0 && (
        <div className="mt-8">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
            Added this session · <span className="text-[var(--brand-text,#4d7bff)] font-bold">{added.length}</span>
          </p>
          <ul className="space-y-1.5 max-h-64 overflow-y-auto">
            {added.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={15} className="text-green-400 shrink-0" />
                <span className="text-white font-medium truncate">{a.name}</span>
                <span className={`text-[10px] font-bold ${a.gender === 'F' ? 'text-pink-400' : 'text-sky-400'}`}>{a.gender === 'F' ? 'W' : 'M'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
