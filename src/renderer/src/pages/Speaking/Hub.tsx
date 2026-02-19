import { Link } from 'react-router-dom'
import { Coffee, UserCircle } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'

/**
 * 口语中心 - 文档：Free Chat vs Mock Test 左右分栏大入口
 */
export function SpeakingHub(): JSX.Element {
  return (
    <PageContainer>
      <h1 className="sr-only">Speaking Hub</h1>
      <header className="mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Speaking</h2>
        <p className="mt-1 text-sm text-[#636E72]">自由对话 · 模考练习</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        <Link to="/speaking/chat">
          <GlassCard className="flex min-h-[180px] flex-col items-center justify-center gap-4 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6E6FA]/80">
              <Coffee className="text-[#2D3436]" size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3436]">Free Chat</p>
              <p className="text-sm text-[#636E72]">与 AI 自由对话练习</p>
            </div>
          </GlassCard>
        </Link>
        <Link to="/speaking/mock">
          <GlassCard className="flex min-h-[180px] flex-col items-center justify-center gap-4 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#CAE9E0]/70">
              <UserCircle className="text-[#2D3436]" size={32} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-medium text-[#2D3436]">Mock Test</p>
              <p className="text-sm text-[#636E72]">模拟考官流程</p>
            </div>
          </GlassCard>
        </Link>
      </div>
    </PageContainer>
  )
}
