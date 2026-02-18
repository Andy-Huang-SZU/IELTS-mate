import { BookOpen, Flame, Target, TrendingUp } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Dashboard 首页 - Bento Grid，对齐参考图 Flux Academy
 * - 顶部 Logo
 * - Zone A (Hero): 球体上半部分主导 + "Good morning, Alex." + "Focus: Writing Task 2"
 * - Zone B: Consistency 带月/日标签、圆形发光点
 * - Zone C: Today's Goals 单选式；Vocab Mastery 环形+文档色
 */
export function DashboardPage(): JSX.Element {
  /* 4 行(星期) x 12 列(月/周) 热力数据 */
  const heatmapData = Array.from({ length: 4 * 12 }, (_, i) => {
    const seed = [0, 0.2, 0.5, 0.8, 1, 0.9, 0.7, 0, 0.3, 0.6, 0.4, 0, 0, 0.8, 1, 0.5, 0.3, 0, 0.6, 0.9, 0.7, 0.4, 0, 0.2, 0.5, 0.8, 0.4, 0.7, 0.9, 0.6, 0.2, 0]
    return seed[i % seed.length]
  })

  return (
    <PageContainer>
      <h1 className="sr-only">IELTS-mate Dashboard</h1>

      {/* 顶部 Logo - 对齐参考图左上角 */}
      <header className="mb-8 flex items-center gap-3 animate-fade-in">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#CAE9E0] to-[#5EEAD4] shadow-sm">
          <BookOpen className="text-[#E17055]" size={20} strokeWidth={2} />
        </div>
        <span className="font-serif text-xl font-semibold text-[#2D3436]">IELTS-mate</span>
      </header>

      {/* Bento: 左列 Hero 占满两行；右列上 Consistency、下 Goals+Mastery 左右并排 */}
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          minHeight: '56vh',
        }}
      >
        {/* 左列：Hero 跨两行，与右侧三块总高度一致 */}
        <div className="row-span-2 animate-fade-in">
          <GlassCard className="relative flex h-full min-h-[320px] flex-col overflow-hidden p-8 transition-all duration-300 hover:scale-[1.01]" hover>
            {/* 上半部分：有机球体 (文档渐变 #FFD6A5 → #FF9F43) */}
            <div className="absolute right-0 top-0 h-[55%] w-[75%] min-w-[240px]">
              <div
                className="h-full w-full animate-morph rounded-full shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, var(--orb-warm) 0%, var(--orb-warm-end) 100%)',
                  filter: 'saturate(1.1)',
                }}
              />
            </div>
            {/* 下半部分：文案 */}
            <div className="relative z-10 mt-auto pt-4">
              <p className="text-sm text-[#636E72]">Good morning,</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold text-[#2D3436]">Alex.</h2>
              <p className="mt-4 text-sm font-medium text-[#2D3436]">Focus: Writing Task 2</p>
            </div>
          </GlassCard>
        </div>

        {/* 右列上方：Consistency，占右侧一半高度 */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <GlassCard className="h-full min-h-[200px] p-6 transition-all duration-300 hover:scale-[1.01]" hover>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="text-[#E17055]" size={20} />
                <h3 className="font-medium text-[#2D3436]">Consistency</h3>
              </div>
              <span className="text-xs text-[#636E72]">12 Days</span>
            </div>
            {/* 月份行 */}
            <div className="mb-1 flex gap-0.5 pl-12">
              {MONTHS.slice(0, 12).map((m, i) => (
                <span key={i} className="flex-1 text-center text-[10px] text-[#636E72]">{m}</span>
              ))}
            </div>
            {/* 热力网格：4 行(星期) x 12 列(周) */}
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-1">
                  <span className="w-10 shrink-0 text-[10px] text-[#636E72]">{DAYS[row]}</span>
                  <div className="grid flex-1 grid-cols-12 gap-0.5">
                    {Array.from({ length: 12 }).map((_, col) => {
                      const idx = row * 12 + col
                      const level = heatmapData[idx] ?? 0
                      return (
                        <div
                          key={col}
                          className="aspect-square rounded-full transition-transform hover:scale-110"
                          style={{
                            backgroundColor: level > 0
                              ? `rgba(225, 112, 85, ${0.3 + level * 0.7})`
                              : 'rgba(203, 213, 225, 0.35)',
                            boxShadow: level > 0.5 ? '0 0 6px rgba(225, 112, 85, 0.5)' : 'none',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-[#636E72]">Last 12 weeks · 12 active days</p>
          </GlassCard>
        </div>

        {/* 右列下方：Goals 与 Mastery 左右并排，占右侧另一半高度 */}
        <div className="grid grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {/* Today's Goals - 单选式 (实心橙/空心) */}
          <GlassCard className="min-h-[200px] p-6 transition-all duration-300 hover:scale-[1.01]" hover>
            <div className="mb-4 flex items-center gap-2">
              <Target className="text-[#E17055]" size={20} />
              <h3 className="font-medium text-[#2D3436]">Today&apos;s Goals</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full bg-[#E17055]" aria-hidden />
                <span className="text-sm text-[#636E72] line-through opacity-75">Review 20 words</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full border-2 border-[#636E72] border-opacity-40 bg-transparent" aria-hidden />
                <span className="text-sm text-[#2D3436]">Run Writing task</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full border-2 border-[#636E72] border-opacity-40 bg-transparent" aria-hidden />
                <span className="text-sm text-[#636E72]">Speaking practice</span>
              </li>
            </ul>
          </GlassCard>
          {/* Vocab Mastery - 环形 + 文档强调色 */}
          <GlassCard className="min-h-[200px] p-6 transition-all duration-300 hover:scale-[1.01]" hover>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="text-[#E17055]" size={20} />
              <h3 className="font-medium text-[#2D3436]">Vocab Mastery</h3>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative h-24 w-24">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(203,213,225,0.4)" strokeWidth="10" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#E17055"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={251.2}
                    className="animate-progress"
                    style={{ strokeDashoffset: 251.2 * 0.35 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-[#2D3436]">65%</span>
                  <span className="text-xs text-[#636E72]">Mastered</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-sm text-[#636E72]">1,024 / 1,577 words</p>
          </GlassCard>
        </div>
      </div>
    </PageContainer>
  )
}
