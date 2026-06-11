import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RiseRegisterForm } from '@/components/rise/RiseRegisterForm'
import { RiseWordmark, RlntlssMark, RLNTLSS_SLUG } from '@/components/rise/RiseBrand'
import type { RiseEvent } from '@/types/rise'

export const dynamic = 'force-dynamic'

export default async function RiseRegisterPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params
  const supabase = await createClient()

  const { data: event } = await supabase.from('rise_events').select('*').eq('slug', eventSlug).single()
  if (!event) notFound()
  const ev = event as RiseEvent

  return (
    <div className="relative min-h-[100dvh] bg-[#070e24] text-white flex flex-col items-center px-6 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(47,95,224,0.4),transparent_55%)]" />
      <div className="flex items-center gap-3 mb-2">
        <RiseWordmark className="h-5 w-auto" />
        {ev.slug === RLNTLSS_SLUG && (
          <>
            <span className="text-zinc-700 text-sm">×</span>
            <RlntlssMark className="h-6 w-auto" />
          </>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {ev.is_team ? (
          <div className="text-center max-w-xs">
            <h1 className="text-2xl font-black mb-2">{ev.name}</h1>
            <p className="text-zinc-400 text-sm">This event runs with fixed teams — registration isn’t open.</p>
          </div>
        ) : (
          <>
            <p className="text-[#4d7bff] text-xs font-bold tracking-[4px] uppercase mb-2">Register</p>
            <h1 className="text-3xl font-black text-center mb-8">{ev.name}</h1>
            <RiseRegisterForm eventId={ev.id} eventName={ev.name} />
          </>
        )}
      </div>

      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.35em] mt-10">
        {ev.slug === RLNTLSS_SLUG ? 'Made for More' : 'Rise · Superhuman'}
      </p>
    </div>
  )
}
