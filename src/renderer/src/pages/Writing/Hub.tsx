import { Link } from 'react-router-dom'
import { BarChart3, Feather } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'

const MOCK_RECENT = [
  { id: '1', title: 'Task 2: Technology & Society', date: '2025-02-17', score: null },
  { id: '2', title: 'Task 1: Line chart - Population', date: '2025-02-15', score: 6.5 },
]

/**
 * 写作中心 - 文档：New Task 1 / New Task 2 大入口卡 + Recent Essays 半透明列表
 */
export function WritingHub(): JSX.Element {
  return (
    <PageContainer>
      <h1 className="sr-only">Writing Hub</h1>
      <header className="mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Writing</h2>
        <p className="mt-1 text-sm text-[#636E72]">Task 1 图表 · Task 2 议论文</p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        <Link to="/writing/editor?type=task1">
          <GlassCard className="flex min-h-[140px] items-center gap-6 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#CAE9E0]/70">
              <BarChart3 className="text-[#2D3436]" size={28} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-medium text-[#2D3436]">New Task 1</p>
              <p className="text-sm text-[#636E72]">图表描述</p>
            </div>
          </GlassCard>
        </Link>
        <Link to="/writing/editor?type=task2">
          <GlassCard className="flex min-h-[140px] items-center gap-6 p-8 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFD6A5]/60">
              <Feather className="text-[#E17055]" size={28} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-medium text-[#2D3436]">New Task 2</p>
              <p className="text-sm text-[#636E72]">议论文</p>
            </div>
          </GlassCard>
        </Link>
      </div>

      <section className="mt-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <h3 className="mb-4 text-sm font-medium text-[#636E72]">Recent Essays</h3>
        <GlassCard className="overflow-hidden" hover>
          <ul className="divide-y divide-[#636E72]/10">
            {MOCK_RECENT.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/writing/editor?id=${item.id}`}
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/30"
                >
                  <div>
                    <p className="font-medium text-[#2D3436]">{item.title}</p>
                    <p className="text-xs text-[#636E72]">{item.date}</p>
                  </div>
                  {item.score != null && (
                    <span className="text-sm font-medium text-[#E17055]">{item.score}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      </section>
    </PageContainer>
  )
}
