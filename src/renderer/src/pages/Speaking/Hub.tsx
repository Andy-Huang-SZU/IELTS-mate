import { Link } from 'react-router-dom'
import { Coffee, UserCircle, Clock } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'

/**
 * Speaking Hub — entry to Free Chat, Mock Test, and History
 */
export function SpeakingHub(): JSX.Element {
  return (
    <PageContainer>
      <h1 className="sr-only">Speaking Hub</h1>
      <header className="mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Speaking</h2>
        <p className="mt-1 text-sm text-[#636E72]">
          Practice your spoken English with AI-powered conversation
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        {/* Free Chat */}
        <Link to="/speaking/chat">
          <GlassCard className="flex min-h-[180px] flex-col items-center justify-center gap-4 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6E6FA]/80">
              <Coffee className="text-[#2D3436]" size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3436]">Free Chat</p>
              <p className="text-sm text-[#636E72]">Casual conversation practice</p>
            </div>
          </GlassCard>
        </Link>

        {/* Mock Test */}
        <Link to="/speaking/mock">
          <GlassCard className="flex min-h-[180px] flex-col items-center justify-center gap-4 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#CAE9E0]/70">
              <UserCircle className="text-[#2D3436]" size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3436]">Mock Test</p>
              <p className="text-sm text-[#636E72]">Full IELTS speaking exam simulation</p>
            </div>
          </GlassCard>
        </Link>

        {/* History */}
        <Link to="/speaking/history">
          <GlassCard className="flex min-h-[180px] flex-col items-center justify-center gap-4 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFD6A5]/50">
              <Clock className="text-[#2D3436]" size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3436]">History</p>
              <p className="text-sm text-[#636E72]">Review past sessions and reports</p>
            </div>
          </GlassCard>
        </Link>
      </div>

      <div className="h-20" />
    </PageContainer>
  )
}
