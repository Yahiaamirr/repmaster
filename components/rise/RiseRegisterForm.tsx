'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { RiseGender } from '@/types/rise'

export function RiseRegisterForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [name, setName] = useState('')
  const [gender, setGender] = useState<RiseGender | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !gender || status === 'submitting') return
    setStatus('submitting')
    setError('')
    try {
      const res = await fetch('/api/rise/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, name: name.trim(), gender }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.')
        setStatus('error')
        return
      }
      setStatus('done')
    } catch {
      setError('Network error. Try again.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 size={64} className="text-[#4d7bff] mb-5" />
        <h2 className="text-2xl font-black text-white">You’re in!</h2>
        <p className="text-zinc-400 text-sm mt-2 max-w-xs">
          <span className="text-white font-semibold">{name.trim()}</span> is registered for {eventName}.
        </p>
        <button
          onClick={() => { setName(''); setGender(null); setStatus('idle') }}
          className="mt-8 text-sm text-[#4d7bff] font-semibold"
        >
          Register another athlete
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">Full name</label>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-lg outline-none focus:border-[#2f5fe0]"
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
                ? 'bg-[#2f5fe0] border-[#2f5fe0] text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            {g === 'M' ? 'Men' : 'Women'}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

      <button
        type="submit"
        disabled={!name.trim() || !gender || status === 'submitting'}
        className="mt-7 w-full py-4 bg-[#2f5fe0] active:bg-[#2348b8] disabled:opacity-40 text-white font-black text-lg rounded-2xl transition-colors flex items-center justify-center gap-2"
      >
        {status === 'submitting' ? <Loader2 size={20} className="animate-spin" /> : null}
        Register
      </button>
    </form>
  )
}
