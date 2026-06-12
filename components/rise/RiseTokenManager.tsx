'use client'

import { useState } from 'react'
import { Plus, Copy, Check, QrCode, Trash2, ShieldX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QRCodeDisplay } from '@/components/admin/QRCodeDisplay'
import { MOVEMENT_LABEL, RISE_MOVEMENTS } from '@/types/rise'
import type { RiseEvent, RiseJudgeToken, RiseMovement, RiseTeam } from '@/types/rise'

export function RiseTokenManager({
  event,
  teams,
  initialTokens,
}: {
  event: RiseEvent
  teams: RiseTeam[]
  initialTokens: RiseJudgeToken[]
}) {
  const supabase = createClient()
  const [tokens, setTokens] = useState<RiseJudgeToken[]>(initialTokens)
  const [busy, setBusy] = useState(false)
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [movement, setMovement] = useState<RiseMovement>('mu')
  const movementScored = !!event.config.movement_scored

  function linkFor(token: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/judge/rise/${token}`
  }

  // Default judge links per team: one each for movement-scored events (mu/pu/dips),
  // otherwise a single link per team.
  async function generateTeamTokens() {
    setBusy(true)
    let inserts: { event_id: string; label: string; scope: RiseJudgeToken['scope'] }[]
    if (movementScored) {
      const existing = new Set(
        tokens.filter(t => t.scope?.team_id && t.scope?.movement).map(t => `${t.scope!.team_id}:${t.scope!.movement}`)
      )
      inserts = teams.flatMap(t =>
        RISE_MOVEMENTS.filter(m => !existing.has(`${t.id}:${m}`)).map(m => ({
          event_id: event.id,
          label: `${t.name} — ${MOVEMENT_LABEL[m]}`,
          scope: { team_id: t.id, movement: m },
        }))
      )
    } else {
      const existingTeamIds = new Set(tokens.map(t => t.scope?.team_id).filter(Boolean))
      inserts = teams
        .filter(t => !existingTeamIds.has(t.id))
        .map(t => ({ event_id: event.id, label: `${t.name} — Judge`, scope: { team_id: t.id } }))
    }
    if (inserts.length) {
      const { data } = await supabase.from('rise_judge_tokens').insert(inserts).select('*')
      if (data) setTokens(prev => [...prev, ...(data as RiseJudgeToken[])])
    }
    setBusy(false)
  }

  async function addTeamJudge() {
    if (!teamId) return
    setBusy(true)
    const team = teams.find(t => t.id === teamId)
    const scope: RiseJudgeToken['scope'] = movementScored
      ? { team_id: teamId, movement }
      : { team_id: teamId }
    const label = movementScored
      ? `${team?.name ?? 'Team'} — ${MOVEMENT_LABEL[movement]}`
      : `${team?.name ?? 'Team'} — Judge ${tokens.filter(t => t.scope?.team_id === teamId).length + 1}`
    const { data } = await supabase
      .from('rise_judge_tokens')
      .insert({ event_id: event.id, label, scope })
      .select('*')
      .single()
    if (data) setTokens(prev => [...prev, data as RiseJudgeToken])
    setBusy(false)
  }

  async function addStationToken() {
    setBusy(true)
    const n = tokens.length + 1
    const { data } = await supabase
      .from('rise_judge_tokens')
      .insert({ event_id: event.id, label: `Judge Station ${n}`, scope: {} })
      .select('*')
      .single()
    if (data) setTokens(prev => [...prev, data as RiseJudgeToken])
    setBusy(false)
  }

  async function revoke(id: string) {
    if (!window.confirm('Revoke this judge link? The current device will lose access immediately and the URL stops working.')) return
    setTokens(prev => prev.filter(t => t.id !== id))
    await supabase.from('rise_judge_tokens').delete().eq('id', id)
  }

  async function revokeAll() {
    if (tokens.length === 0) return
    if (!window.confirm(
      `Revoke ALL ${tokens.length} judge link(s) for this event?\n\nEvery existing link stops working immediately. You can re-create fresh links afterwards.`
    )) return
    setBusy(true)
    setTokens([])
    await supabase.from('rise_judge_tokens').delete().eq('event_id', event.id)
    setBusy(false)
  }

  async function revokeAllAndRecreate() {
    if (!window.confirm(
      'Revoke all current judge links and generate a fresh set?\n\nAll old URLs/QRs stop working and are replaced with new ones.'
    )) return
    setBusy(true)
    await supabase.from('rise_judge_tokens').delete().eq('event_id', event.id)
    let created: RiseJudgeToken[] = []
    if (event.is_team) {
      const inserts = movementScored
        ? teams.flatMap(t => RISE_MOVEMENTS.map(m => ({
            event_id: event.id, label: `${t.name} — ${MOVEMENT_LABEL[m]}`, scope: { team_id: t.id, movement: m },
          })))
        : teams.map(t => ({ event_id: event.id, label: `${t.name} — Judge`, scope: { team_id: t.id } }))
      const { data } = await supabase.from('rise_judge_tokens').insert(inserts).select('*')
      created = (data as RiseJudgeToken[] | null) ?? []
    } else {
      const { data } = await supabase
        .from('rise_judge_tokens')
        .insert({ event_id: event.id, label: 'Judge Station 1', scope: {} })
        .select('*')
        .single()
      if (data) created = [data as RiseJudgeToken]
    }
    setTokens(created)
    setBusy(false)
  }

  const teamName = (id?: string) => teams.find(t => t.id === id)?.name

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Judge Links</h2>
        {tokens.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={revokeAllAndRecreate}
              disabled={busy}
              className="text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 rounded-md font-semibold transition-colors"
              title="Revoke every link and generate a fresh default set"
            >
              Revoke all & re-create
            </button>
            <button
              onClick={revokeAll}
              disabled={busy}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-400 border border-red-900/60 rounded-md font-semibold transition-colors"
              title="Revoke every link for this event"
            >
              <ShieldX size={13} /> Revoke all
            </button>
          </div>
        )}
      </div>

      {/* Add controls */}
      {event.is_team ? (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={generateTeamTokens}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[var(--brand,#2f5fe0)] hover:bg-[var(--brand-press,#2348b8)] disabled:opacity-50 text-[var(--brand-contrast,#fff)] rounded-md font-semibold transition-colors"
          >
            <Plus size={14} /> {movementScored ? 'Three links per team (MU/PU/Dips)' : 'One link per team'}
          </button>
          <span className="text-zinc-600 text-xs">or add extra:</span>
          <select
            value={teamId}
            onChange={e => setTeamId(e.target.value)}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-2 text-white outline-none focus:border-[var(--brand,#2f5fe0)]"
          >
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {movementScored && (
            <select
              value={movement}
              onChange={e => setMovement(e.target.value as RiseMovement)}
              className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-2 text-white outline-none focus:border-[var(--brand,#2f5fe0)]"
            >
              {RISE_MOVEMENTS.map(m => (
                <option key={m} value={m}>{MOVEMENT_LABEL[m]}</option>
              ))}
            </select>
          )}
          <button
            onClick={addTeamJudge}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white rounded-md font-semibold transition-colors"
          >
            <Plus size={14} /> Add judge
          </button>
        </div>
      ) : (
        <button
          onClick={addStationToken}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[var(--brand,#2f5fe0)] hover:bg-[var(--brand-press,#2348b8)] disabled:opacity-50 text-[var(--brand-contrast,#fff)] rounded-md font-semibold transition-colors mb-4"
        >
          <Plus size={14} /> Add judge station
        </button>
      )}

      {tokens.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          {event.is_team
            ? movementScored
              ? 'Generate three judge links per team — muscle-ups, pull-ups and dips. Each opens that movement’s counter; the team total is their sum.'
              : 'Generate one judge link per team — each opens that team’s rep counter. Add extra links for backup judges.'
            : 'Add a judge station — one device scores every athlete (tap an athlete, then time/measure). Add more for parallel judging.'}
        </p>
      ) : (
        <div className="space-y-3">
          {tokens.map(t => (
            <TokenRow
              key={t.id}
              token={t}
              link={linkFor(t.token)}
              subtitle={[teamName(t.scope?.team_id), t.scope?.movement && MOVEMENT_LABEL[t.scope.movement]].filter(Boolean).join(' · ') || undefined}
              onRevoke={() => revoke(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TokenRow({
  token, link, subtitle, onRevoke,
}: {
  token: RiseJudgeToken
  link: string
  subtitle?: string
  onRevoke: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-zinc-800/60 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{token.label}</p>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
          <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">{link}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={copy} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={() => setShowQR(v => !v)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors">
            <QrCode size={13} />
            QR
          </button>
          <button onClick={onRevoke} title="Revoke link" className="flex items-center justify-center p-1.5 bg-red-950/60 hover:bg-red-900/60 text-red-400 rounded-md transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {showQR && (
        <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-center">
          <QRCodeDisplay url={link} label={token.label ?? 'judge'} />
        </div>
      )}
    </div>
  )
}
