'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Radio, Lock, MonitorSmartphone, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RiseCompetitor, RiseEntry, RiseEvent } from '@/types/rise'
import { RiseJudgeClient } from './RiseJudgeClient'
import { RiseJudgeRoster } from './RiseJudgeRoster'
import { RiseWordmark, RlntlssMark, RLNTLSS_SLUG } from './RiseBrand'

interface PresenceMeta {
  clientId: string
  name: string
  joinedAt: number
  takeoverAt?: number
}

function persistentId(key: string): string {
  if (typeof window === 'undefined') return 'server'
  let id = window.localStorage.getItem(key)
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    window.localStorage.setItem(key, id)
  }
  return id
}

export function RiseJudge({
  token,
  event,
  mode,
  scope,
  initialEntries,
  competitors,
}: {
  token: string
  event: RiseEvent
  mode: 'scoped' | 'roster'
  scope: { team_id?: string; competitor_id?: string }
  initialEntries: RiseEntry[]
  competitors: RiseCompetitor[]
}) {
  const supabase = createClient()
  const nameKey = `rise-judge-name-${token}`
  const [name, setName] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [owner, setOwner] = useState<PresenceMeta | null>(null)
  const [resolving, setResolving] = useState(true)

  const clientId = useRef<string>('')
  const joinedAt = useRef<number>(Date.now())
  const takeoverAt = useRef<number | undefined>(undefined)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Load any saved name on mount.
  useEffect(() => {
    clientId.current = persistentId('rise-judge-client-id')
    const saved = window.localStorage.getItem(nameKey)
    if (saved) setName(saved)
  }, [nameKey])

  // Establish the device-lock presence channel once we have a name.
  useEffect(() => {
    if (!name) return
    const channel = supabase.channel(`rise-lock-${token}`, {
      config: { presence: { key: clientId.current } },
    })
    channelRef.current = channel

    const recompute = () => {
      const state = channel.presenceState() as Record<string, PresenceMeta[]>
      const metas = Object.values(state).flat()
      if (metas.length === 0) { setOwner(null); return }
      const withTakeover = metas.filter(m => m.takeoverAt)
      const ownerMeta = withTakeover.length
        ? withTakeover.sort((a, b) => (b.takeoverAt! - a.takeoverAt!))[0]
        : metas.sort((a, b) => a.joinedAt - b.joinedAt)[0]
      setOwner(ownerMeta)
      setResolving(false)
    }

    channel
      .on('presence', { event: 'sync' }, recompute)
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ clientId: clientId.current, name, joinedAt: joinedAt.current })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [name, token])

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    window.localStorage.setItem(nameKey, trimmed)
    joinedAt.current = Date.now()
    setName(trimmed)
  }

  async function takeOver() {
    takeoverAt.current = Date.now()
    await channelRef.current?.track({
      clientId: clientId.current,
      name,
      joinedAt: joinedAt.current,
      takeoverAt: takeoverAt.current,
    })
  }

  // ── Name entry ──
  if (!name) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-8 text-center">
        <div className="flex items-center gap-3 mb-2">
          <RiseWordmark className="h-9 w-auto" />
          {event.slug === RLNTLSS_SLUG && (
            <>
              <span className="text-zinc-700 text-sm">×</span>
              <RlntlssMark className="h-10 w-auto" />
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#4d7bff] mb-8 font-mono">
          <Radio size={10} className="animate-pulse" /> {event.name}
        </div>
        <UserRound size={44} className="text-zinc-700 mb-5" />
        <h1 className="text-2xl font-black text-white mb-1">Judge sign-in</h1>
        <p className="text-zinc-500 text-sm mb-8 max-w-xs">Enter your name so we know who’s scoring on this device.</p>
        <form onSubmit={saveName} className="w-full max-w-xs">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Your name"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white text-lg text-center outline-none focus:border-[#2f5fe0]"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="mt-3 w-full py-4 bg-[#2f5fe0] active:bg-[#2348b8] disabled:opacity-40 text-white font-black text-lg rounded-2xl transition-colors"
          >
            Start judging
          </button>
        </form>
      </div>
    )
  }

  const isOwner = owner?.clientId === clientId.current

  // ── Resolving lock ──
  if (resolving || !owner) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-8 text-center">
        <MonitorSmartphone size={40} className="text-zinc-700 mb-4 animate-pulse" />
        <p className="text-zinc-400 text-sm">Connecting…</p>
      </div>
    )
  }

  // ── Locked by another device ──
  if (!isOwner) {
    return (
      <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-8 text-center select-none">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-8 font-mono">{event.name}</div>
        <Lock size={48} className="text-[#2f5fe0] mb-6" />
        <h1 className="text-2xl font-black text-white mb-2">Open on another device</h1>
        <p className="text-zinc-400 text-sm max-w-xs mb-1">
          This judge link is currently active as <span className="text-white font-bold">{owner.name || 'another judge'}</span>.
        </p>
        <p className="text-zinc-600 text-xs max-w-xs mb-8">
          Only one device can score on a link at a time. Take over only if you’re sure the other device is no longer used.
        </p>
        <button
          onClick={takeOver}
          className="w-full max-w-xs py-4 bg-zinc-100 active:bg-white text-zinc-950 font-black text-lg rounded-2xl transition-colors"
        >
          Take over on this device
        </button>
      </div>
    )
  }

  // ── This device holds the lock → render the judge UI ──
  if (mode === 'scoped') {
    return <RiseJudgeClient event={event} label={name} scope={scope} initialEntries={initialEntries} />
  }
  return <RiseJudgeRoster event={event} label={name} competitors={competitors} initialEntries={initialEntries} />
}
