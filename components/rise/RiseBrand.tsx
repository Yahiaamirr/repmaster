/* eslint-disable @next/next/no-img-element */
// Brand lockups for the RISE Opening Event section.
// Assets live in /public/rise (white-on-transparent, theme-ready).

export function RiseWordmark({ className = 'h-12 w-auto' }: { className?: string }) {
  return <img src="/rise/rise-wordmark.png" alt="RISE — Superhuman" className={className} draggable={false} />
}

export function RlntlssMark({ className = 'h-10 w-auto' }: { className?: string }) {
  return <img src="/rise/rlntlss-mark.png" alt="Relentless" className={className} draggable={false} />
}

export function RlntlssSlogan({ className = 'h-24 w-auto' }: { className?: string }) {
  return <img src="/rise/rlntlss-slogan.png" alt="Made for More" className={className} draggable={false} />
}

// Slug of the Relentless-branded event, used to add its mark where relevant.
export const RLNTLSS_SLUG = 'rlntlss-box-jumps'

// Co-brand strip (RISE presents · Relentless) for footers.
export function RiseCoBrandFooter() {
  return (
    <footer className="mt-12 border-t border-[#1a2547] py-8 flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 opacity-80">
        <RiseWordmark className="h-7 w-auto" />
        <span className="text-zinc-700 text-xs">×</span>
        <RlntlssMark className="h-9 w-auto" />
      </div>
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.35em]">Made for More</p>
    </footer>
  )
}
