/* eslint-disable @next/next/no-img-element */
// Brand lockups for the RISE Opening Event section.
// Assets live in /public/rise (white-on-transparent, theme-ready).
// NOTE: the Relentless mark must ONLY appear on Relentless events (RLNTLSS_SLUG).

export function RiseWordmark({ className = 'h-4 w-auto' }: { className?: string }) {
  return <img src="/rise/rise-wordmark.png" alt="RISE — Superhuman" className={`select-none ${className}`} draggable={false} />
}

export function RlntlssMark({ className = 'h-6 w-auto' }: { className?: string }) {
  return <img src="/rise/rlntlss-mark.png" alt="Relentless" className={`select-none ${className}`} draggable={false} />
}

export function RlntlssSlogan({ className = 'h-16 w-auto' }: { className?: string }) {
  return <img src="/rise/rlntlss-slogan.png" alt="Made for More" className={`select-none ${className}`} draggable={false} />
}

// Slug of the Relentless-branded event — gate every Relentless asset behind this.
export const RLNTLSS_SLUG = 'rlntlss-box-jumps'

// RISE-only footer (no Relentless co-branding).
export function RiseFooter() {
  return (
    <footer className="mt-12 border-t border-[#243668] py-8 flex flex-col items-center gap-3">
      <RiseWordmark className="h-4 w-auto opacity-60" />
      <p className="text-[10px] text-[#4d7bff]/70 uppercase tracking-[0.35em]">Rise · Superhuman</p>
    </footer>
  )
}
