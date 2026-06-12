import Link from 'next/link'
import { LayoutDashboard, Plus, Flame } from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'

export const dynamic = 'force-dynamic'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2.5 font-black text-lg">
          Nezam <span className="text-[#7c3aed]">IT</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink href="/admin/tournaments" icon={<LayoutDashboard size={15} />}>
            Tournaments
          </NavLink>
          <NavLink href="/admin/rise" icon={<Flame size={15} />}>
            RISE Event
          </NavLink>
          <Link
            href="/admin/tournaments/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-semibold rounded-md transition-colors ml-2"
          >
            <Plus size={14} />
            New
          </Link>
          <LogoutButton />
        </nav>
      </header>
      <div className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
        {children}
      </div>
    </div>
  )
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white text-sm rounded-md hover:bg-zinc-800 transition-colors"
    >
      {icon}
      {children}
    </Link>
  )
}
