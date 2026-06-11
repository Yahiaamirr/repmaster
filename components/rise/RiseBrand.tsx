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

// Evolve sponsor mark (black wordmark — inverted to white for the dark theme).
export function EvolveMark({ className = 'h-8 w-auto' }: { className?: string }) {
  return <img src="/rise/evolve-mark.webp" alt="Evolve" className={`${className} invert`} draggable={false} />
}

// Slug of the Relentless-branded event, used to add its mark where relevant.
export const RLNTLSS_SLUG = 'rlntlss-box-jumps'

// Slug of the Evolve-branded event.
export const EVOLVE_SLUG = 'evolve-deadlift-ladder'

// Turbo Store sponsor mark (red-on-black). The asset has a solid black
// background; mix-blend-screen drops the black out on dark surfaces so only the
// red logo shows.
export function TurboMark({ className = 'h-12 w-auto' }: { className?: string }) {
  return <img src="/rise/turbo-mark.jpg" alt="Turbo Store" className={`${className} mix-blend-screen`} draggable={false} />
}

// Slug of the Turbo-branded event.
export const TURBO_SLUG = 'turbo-deadhang'

// LFTD sponsor mark (navy on lime). The lime ground matches the LFTD board, so
// it blends there; on dark surfaces it reads as a tidy lime chip (needed — the
// navy logo would be invisible without its lime background).
export function LftdMark({ className = 'h-12 w-auto' }: { className?: string }) {
  return <img src="/rise/lftd-mark.jpg" alt="LFTD — Fitness that fits you" className={`${className} rounded-md`} draggable={false} />
}

// Slug of the LFTD-branded event.
export const LFTD_SLUG = 'lftd-hyrox'

// Co-brand strip (RISE presents · Relentless) for footers.
export function RiseCoBrandFooter() {
  return (
    <footer className="mt-12 border-t border-[#1a2547] py-8 flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 opacity-80">
        <RiseWordmark className="h-7 w-auto" />
        <span className="text-zinc-700 text-xs">×</span>
        <RlntlssMark className="h-11 w-auto" />
      </div>
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.35em]">Made for More</p>
    </footer>
  )
}
