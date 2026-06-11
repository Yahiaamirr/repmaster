'use client'

import { ChevronLeft, Radio } from 'lucide-react'

export function JudgeHeader({
  eventName,
  label,
  right,
  onBack,
}: {
  eventName: string
  label: string
  right?: React.ReactNode
  onBack?: () => void
}) {
  return (
    <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to roster"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:bg-zinc-800"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5 truncate">
            <Radio size={9} className="text-[var(--brand-text,#2f5fe0)] animate-pulse shrink-0" />
            {eventName}
          </p>
          <p className="text-sm font-bold text-white truncate">{label}</p>
        </div>
      </div>
      {right && <span className="text-[10px] font-bold tracking-widest text-[var(--brand-text,#2f5fe0)] uppercase shrink-0">{right}</span>}
    </div>
  )
}
