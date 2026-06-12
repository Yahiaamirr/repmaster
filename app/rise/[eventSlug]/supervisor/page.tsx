import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RiseSupervisorForm } from '@/components/rise/RiseSupervisorForm'
import { RiseWordmark, RlntlssMark, RLNTLSS_SLUG, EvolveMark, EVOLVE_SLUG, TurboMark, TURBO_SLUG, LftdMark, LFTD_SLUG } from '@/components/rise/RiseBrand'
import { brandVars } from '@/lib/rise-theme'
import type { RiseEvent } from '@/types/rise'

export const dynamic = 'force-dynamic'

export default async function RiseSupervisorPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  return (
    <div className="min-h-[100dvh] bg-[var(--brand-bg,#05070f)] text-white flex flex-col items-center px-6 py-12" style={brandVars(ev.slug)}>
      <div className="flex items-center gap-3 mb-2">
        <RiseWordmark className="h-9 w-auto" />
        {ev.slug === RLNTLSS_SLUG && (<><span className="text-zinc-700 text-sm">×</span><RlntlssMark className="h-13 w-auto" /></>)}
        {ev.slug === EVOLVE_SLUG && (<><span className="text-zinc-700 text-sm">×</span><EvolveMark className="h-10 w-auto" /></>)}
        {ev.slug === TURBO_SLUG && (<><span className="text-zinc-700 text-sm">×</span><TurboMark className="h-17 w-auto" /></>)}
        {ev.slug === LFTD_SLUG && (<><span className="text-zinc-700 text-sm">×</span><LftdMark className="h-11 w-auto" /></>)}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <p className="text-[var(--brand-text,#4d7bff)] text-xs font-bold tracking-[4px] uppercase mb-2">Supervisor · Register Participants</p>
        <h1 className="text-3xl font-black text-center mb-1">{ev.name}</h1>
        <p className="text-zinc-500 text-sm text-center mb-8">Add each participant below. Keep this open to register more.</p>
        <RiseSupervisorForm eventId={ev.id} eventName={ev.name} />
      </div>

      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.35em] mt-10">Made for More</p>
    </div>
  )
}
