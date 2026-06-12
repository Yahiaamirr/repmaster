import Link from 'next/link'
import { Trophy, Zap, Users, BarChart3 } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 bg-[#e8440a]/10 border border-[#e8440a]/30 text-[#e8440a] text-xs font-bold tracking-[4px] uppercase px-4 py-2 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-[#e8440a] rounded-full animate-pulse" />
          Competition Platform
        </div>
        <h1 className="text-6xl font-black tracking-tight mb-4">
          Rep<span className="text-[#e8440a]">Master</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-md mx-auto">
          Real-time tournament management for calisthenics &amp; strength competitions.
          Replace your spreadsheets with a proper platform.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mb-12">
        <FeatureCard
          icon={<Trophy size={20} />}
          title="Tournaments"
          description="Create and manage competitions in minutes"
        />
        <FeatureCard
          icon={<Zap size={20} />}
          title="Live Scoring"
          description="Good Rep / No Rep judging in real-time"
        />
        <FeatureCard
          icon={<Users size={20} />}
          title="Flight Generation"
          description="Auto-sort athletes by opener weight per lift"
        />
        <FeatureCard
          icon={<BarChart3 size={20} />}
          title="Live Leaderboard"
          description="Public scoreboard — instant WebSocket updates"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/admin/tournaments"
          className="px-8 py-3.5 bg-[#e8440a] hover:bg-[#c73a08] text-white font-bold rounded-lg transition-colors text-center"
        >
          Admin Dashboard
        </Link>
        <Link
          href="/admin/tournaments/new"
          className="px-8 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition-colors text-center"
        >
          New Tournament
        </Link>
      </div>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex gap-4 items-start">
      <div className="text-[#e8440a] mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="font-semibold text-white mb-1">{title}</div>
        <div className="text-zinc-400 text-sm">{description}</div>
      </div>
    </div>
  )
}
