import { BookOpen, Flame, Target, TrendingUp, Sparkles, MessageCircle, Clock, ArrowRight, Calendar, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GlassCard, PageContainer } from '../../components/flux'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getGreeting(): { greeting: string; subtitle: string } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { greeting: 'Good morning,', subtitle: 'A fresh start for your IELTS journey.' }
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon,', subtitle: 'Keep the momentum going!' }
  if (hour >= 17 && hour < 21) return { greeting: 'Good evening,', subtitle: 'Wind down with some practice.' }
  return { greeting: 'Night owl mode,', subtitle: 'Quiet hours, deep focus.' }
}

const HEATMAP_SEED = [0, 0.2, 0.5, 0.8, 1, 0.9, 0.7, 0, 0.3, 0.6, 0.4, 0, 0, 0.8, 1, 0.5, 0.3, 0, 0.6, 0.9, 0.7, 0.4, 0, 0.2, 0.5, 0.8, 0.4, 0.7, 0.9, 0.6, 0.2, 0]
const HEATMAP_DATA = Array.from({ length: 4 * 12 }, (_, i) => HEATMAP_SEED[i % HEATMAP_SEED.length])

/* 快捷入口 */
const QUICK_ACTIONS = [
  { label: 'Review Words', desc: '32 words due', path: '/vocabulary', color: '#5EEAD4' },
  { label: 'Writing Task', desc: 'Task 2 practice', path: '/writing', color: '#E17055' },
  { label: 'Speaking', desc: 'Free chat', path: '/speaking', color: '#A78BFA' },
]

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const { greeting, subtitle } = useMemo(getGreeting, [])

  /* ===== Hero Orb 鼠标视差 ===== */
  const orbRef = useRef<HTMLDivElement>(null)
  const [orbOffset, setOrbOffset] = useState({ x: 0, y: 0 })
  const [orbHover, setOrbHover] = useState(false)
  const rafRef = useRef<number>()
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!orbRef.current) return
    const rect = orbRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const distX = e.clientX - centerX
    const distY = e.clientY - centerY
    const dist = Math.sqrt(distX * distX + distY * distY)
    const factor = dist < 200 ? 0.06 : 0.025
    targetRef.current = { x: distX * factor, y: distY * factor }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const animate = () => {
      const nx = lerp(currentRef.current.x, targetRef.current.x, 0.06)
      const ny = lerp(currentRef.current.y, targetRef.current.y, 0.06)
      if (Math.abs(nx - currentRef.current.x) > 0.1 || Math.abs(ny - currentRef.current.y) > 0.1) {
        currentRef.current.x = nx
        currentRef.current.y = ny
        setOrbOffset({ x: nx, y: ny })
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleMouseMove])

  return (
    <PageContainer>
      <h1 className="sr-only">IELTS-mate Dashboard</h1>

      {/* 顶部 Logo */}
      <header className="mb-6 flex items-center gap-3 animate-fade-in lg:mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#CAE9E0] to-[#5EEAD4] shadow-sm">
          <BookOpen className="text-[#E17055]" size={20} strokeWidth={2} />
        </div>
        <span className="font-serif text-xl font-semibold text-[#2D3436]">IELTS-mate</span>
      </header>

      {/* ===== 主布局：flex 等高 ===== */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6 flex-1 min-h-0">

        {/* ======= 左列：Hero 卡片 ======= */}
        <div className="lg:flex-[4] min-w-0 animate-fade-in">
          <GlassCard className="h-full p-5 sm:p-6 flex flex-col" hover>

            {/* 上部：问候语 + Orb 水平排列 */}
            <div className="flex items-center gap-5 sm:gap-6">
              {/* Orb 区域 */}
              <div className="shrink-0 relative">
                <div
                  ref={orbRef}
                  className="orb-container relative"
                  style={{
                    width: 'clamp(120px, 15vw, 170px)',
                    height: 'clamp(120px, 15vw, 170px)',
                    transform: `translate3d(${orbOffset.x}px, ${orbOffset.y}px, 0)`,
                    willChange: 'transform',
                  }}
                  onMouseEnter={() => setOrbHover(true)}
                  onMouseLeave={() => setOrbHover(false)}
                  aria-label="AI 学习助手"
                >
                  {/* Layer 0: 外层光晕 */}
                  <div
                    className="absolute inset-[-20%] animate-morph orb-breathe"
                    style={{
                      background: `conic-gradient(from 180deg at 45% 40%,
                        rgba(255,214,165,0.55) 0deg,
                        rgba(255,170,140,0.2) 60deg,
                        rgba(255,200,160,0.2) 120deg,
                        rgba(240,180,130,0.2) 200deg,
                        rgba(255,200,120,0.3) 300deg,
                        rgba(255,214,165,0.55) 360deg
                      )`,
                      filter: 'blur(40px)',
                      borderRadius: '50%',
                      willChange: 'transform, opacity',
                    }}
                  />

                  {/* Layer 1: 环境光晕 */}
                  <div
                    className="absolute inset-[-10%] animate-morph"
                    style={{
                      background: 'radial-gradient(circle at 40% 40%, rgba(255,214,165,0.55) 0%, rgba(255,159,67,0.15) 60%, transparent 80%)',
                      filter: 'blur(30px)',
                      willChange: 'transform',
                    }}
                  />

                  {/* 底部接触面投影 — 增强落地感 */}
                  <div
                    className="absolute orb-ground-shadow"
                    style={{
                      bottom: '-12%',
                      left: '10%',
                      width: '80%',
                      height: '20%',
                      background: 'radial-gradient(ellipse at 50% 50%, rgba(180,90,40,0.2) 0%, transparent 70%)',
                      filter: 'blur(12px)',
                      borderRadius: '50%',
                    }}
                  />

                  {/* Layer 2: 主体球体 */}
                  <div
                    className="absolute inset-0 aspect-square animate-morph orb-main"
                    style={{
                      background: `
                        radial-gradient(ellipse 65% 55% at 35% 30%, rgba(255,245,230,0.95) 0%, transparent 55%),
                        radial-gradient(ellipse 50% 45% at 65% 70%, rgba(190,100,50,0.5) 0%, transparent 60%),
                        radial-gradient(ellipse 35% 30% at 25% 60%, rgba(255,160,200,0.12) 0%, transparent 50%),
                        radial-gradient(ellipse 30% 35% at 70% 35%, rgba(160,180,255,0.1) 0%, transparent 50%),
                        radial-gradient(ellipse 80% 80% at 50% 50%, #FFDAB5 0%, #F4A261 35%, #E07845 65%, #C85A30 100%)
                      `,
                      boxShadow: `
                        inset 8px 8px 32px rgba(255,255,255,0.55),
                        inset -8px -12px 28px rgba(160,65,20,0.35),
                        inset 0 0 60px rgba(255,200,160,0.15),
                        inset 0 -20px 40px rgba(140,55,15,0.15),
                        0 10px 40px -8px rgba(200,100,48,0.4),
                        0 25px 70px -16px rgba(180,80,30,0.25),
                        0 0 100px -20px rgba(255,160,100,0.3)
                      `,
                      transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease',
                      transform: orbHover ? 'scale(1.06)' : 'scale(1)',
                      willChange: 'transform, box-shadow',
                      borderRadius: '50%',
                    }}
                  >
                    {/* 顶部主高光 — 更锐利的焦散 */}
                    <div
                      className="absolute animate-morph-reverse rounded-full"
                      style={{
                        top: '6%', left: '14%', width: '45%', height: '35%',
                        background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.8) 0%, rgba(255,252,245,0.3) 40%, transparent 70%)',
                        filter: 'blur(2px)',
                      }}
                    />
                    {/* 次高光 — 小而亮 */}
                    <div
                      className="absolute rounded-full"
                      style={{
                        top: '12%', left: '22%', width: '18%', height: '14%',
                        background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.9) 0%, transparent 70%)',
                        filter: 'blur(1px)',
                      }}
                    />
                    {/* 虹彩流光 */}
                    <div
                      className="absolute inset-[10%] rounded-full orb-iridescent"
                      style={{
                        background: `conic-gradient(from 0deg at 50% 50%,
                          transparent 0deg, rgba(255,180,200,0.18) 30deg,
                          transparent 60deg, rgba(180,200,255,0.15) 120deg,
                          transparent 150deg, rgba(200,255,220,0.12) 210deg,
                          transparent 240deg, rgba(255,220,150,0.18) 300deg,
                          transparent 360deg
                        )`,
                        mixBlendMode: 'overlay',
                        filter: 'blur(8px)',
                        willChange: 'transform',
                      }}
                    />
                    {/* 内部光线流动 */}
                    <div
                      className="absolute inset-[15%] rounded-full orb-inner-flow"
                      style={{
                        background: `
                          radial-gradient(ellipse 60% 40% at 30% 35%, rgba(255,255,255,0.35) 0%, transparent 60%),
                          radial-gradient(ellipse 40% 50% at 70% 65%, rgba(255,180,120,0.25) 0%, transparent 60%)
                        `,
                        mixBlendMode: 'soft-light',
                        filter: 'blur(5px)',
                      }}
                    />
                    {/* 底部暗角 — 环境光遮蔽 */}
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'radial-gradient(ellipse 90% 60% at 50% 85%, rgba(120,50,15,0.2) 0%, transparent 60%)',
                      }}
                    />
                    {/* 底部反光 */}
                    <div
                      className="absolute animate-morph rounded-full"
                      style={{
                        bottom: '14%', right: '10%', width: '35%', height: '22%',
                        background: 'radial-gradient(ellipse at 50% 50%, rgba(255,210,170,0.35) 0%, transparent 70%)',
                        filter: 'blur(5px)',
                      }}
                    />
                    {/* rim light — 边缘色散 */}
                    <div
                      className="absolute inset-0 rounded-full orb-rim"
                      style={{
                        background: 'transparent',
                        boxShadow: `
                          inset 3px 0 14px rgba(255,180,200,0.22),
                          inset -3px 0 14px rgba(180,200,255,0.18),
                          inset 0 3px 14px rgba(200,255,220,0.14),
                          inset 0 -4px 16px rgba(140,60,20,0.2)
                        `,
                      }}
                    />

                    {/* Hover 态：语音波纹 + 提示 */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center transition-all duration-500"
                      style={{
                        opacity: orbHover ? 1 : 0,
                        transform: orbHover ? 'scale(1)' : 'scale(0.85)',
                      }}
                    >
                      <div className="relative mb-2">
                        <div className="orb-voice-ring orb-voice-ring-1" />
                        <div className="orb-voice-ring orb-voice-ring-2" />
                        <div className="orb-voice-ring orb-voice-ring-3" />
                        <MessageCircle className="relative z-10 text-white drop-shadow-lg" size={20} strokeWidth={1.5} />
                      </div>
                      <span className="text-[10px] font-medium text-white drop-shadow-lg tracking-wide">Ask me anything</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 问候语 + 状态 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#636E72]">{greeting}</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#2D3436] sm:text-3xl">Alex.</h2>
                <p className="mt-1.5 text-sm text-[#636E72] italic">{subtitle}</p>
                <p className="mt-3 text-sm font-medium text-[#E17055]">
                  <Sparkles className="inline -mt-0.5 mr-1" size={14} />
                  Focus: Writing Task 2
                </p>
              </div>
            </div>

            {/* 分隔线 */}
            <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#636E72]/15 to-transparent" />

            {/* 快捷入口 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#636E72] uppercase tracking-wider">Quick Start</p>
              <div className="flex flex-col gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.path}
                    onClick={() => navigate(action.path)}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-white/40"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: action.color }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[#2D3436]">{action.label}</span>
                      <span className="block text-xs text-[#636E72]">{action.desc}</span>
                    </span>
                    <ArrowRight className="text-[#636E72]/40 transition-all duration-200 group-hover:text-[#E17055] group-hover:translate-x-0.5" size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* 底部学习时间 + 每日提示 */}
            <div className="mt-auto pt-3">
              {/* 每日学习提示 */}
              <div className="mb-3 rounded-xl bg-gradient-to-r from-[#FFF5EE]/60 to-[#FEF3E2]/40 p-3">
                <div className="flex items-start gap-2">
                  <Zap className="mt-0.5 shrink-0 text-[#E17055]" size={13} />
                  <div>
                    <p className="text-xs font-medium text-[#2D3436]">Daily Tip</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-[#636E72]">
                      Try to review words at the same time each day — spaced repetition works best with consistent timing.
                    </p>
                  </div>
                </div>
              </div>

              {/* 学习统计 */}
              <div className="flex items-center justify-between rounded-xl bg-white/30 px-3 py-2.5">
                <div className="flex items-center gap-2 text-xs text-[#636E72]">
                  <Clock size={12} className="shrink-0" />
                  <span>Today: <strong className="text-[#2D3436]">1h 24m</strong></span>
                </div>
                <div className="h-3 w-px bg-[#636E72]/15" />
                <div className="flex items-center gap-2 text-xs text-[#636E72]">
                  <Calendar size={12} className="shrink-0" />
                  <span>Week: <strong className="text-[#2D3436]">8h 15m</strong></span>
                </div>
              </div>
            </div>

          </GlassCard>
        </div>

        {/* ======= 右列：三张信息卡片 ======= */}
        <div className="flex lg:flex-[5] flex-col gap-4 sm:gap-5 lg:gap-5 min-w-0">

          {/* Consistency — flex-1 自动填充 */}
          <div className="flex-1 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <GlassCard className="h-full p-5 transition-all duration-300 hover:scale-[1.003] sm:p-6" hover>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="text-[#E17055]" size={20} />
                  <h3 className="font-medium text-[#2D3436]">Consistency</h3>
                </div>
                <span className="text-xs text-[#636E72]">12 Days</span>
              </div>
              <div className="mb-1 flex gap-0.5 pl-10 sm:pl-12">
                {MONTHS.map((m, i) => (
                  <span key={i} className="flex-1 text-center text-[10px] text-[#636E72]">{m}</span>
                ))}
              </div>
              <div className="flex flex-col gap-1">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-1">
                    <span className="w-8 shrink-0 text-[10px] text-[#636E72] sm:w-10">{DAYS[row]}</span>
                    <div className="grid flex-1 grid-cols-12 gap-0.5">
                      {Array.from({ length: 12 }).map((_, col) => {
                        const idx = row * 12 + col
                        const level = HEATMAP_DATA[idx] ?? 0
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

          {/* Goals & Mastery — 并排，flex-1 填充剩余空间 */}
          <div className="flex-1 grid grid-cols-2 gap-4 sm:gap-5 animate-fade-in min-h-0" style={{ animationDelay: '0.2s' }}>
            {/* Goals */}
            <GlassCard className="h-full p-5 transition-all duration-300 hover:scale-[1.003] sm:p-6 flex flex-col" hover>
              <div className="mb-3 flex items-center gap-2">
                <Target className="text-[#E17055] shrink-0" size={18} />
                <h3 className="text-sm font-medium text-[#2D3436] sm:text-base">Goals</h3>
              </div>
              <ul className="space-y-2.5 flex-1">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E17055]" aria-hidden />
                  <span className="text-xs text-[#636E72] line-through opacity-75 sm:text-sm">Review 20 words</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#636E72]/40 bg-transparent" aria-hidden />
                  <span className="text-xs text-[#2D3436] sm:text-sm">Writing task</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#636E72]/40 bg-transparent" aria-hidden />
                  <span className="text-xs text-[#636E72] sm:text-sm">Speaking</span>
                </li>
              </ul>
            </GlassCard>

            {/* Mastery */}
            <GlassCard className="h-full p-5 transition-all duration-300 hover:scale-[1.003] sm:p-6 flex flex-col" hover>
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="text-[#E17055] shrink-0" size={18} />
                <h3 className="text-sm font-medium text-[#2D3436] sm:text-base">Mastery</h3>
              </div>
              <div className="flex items-center justify-center flex-1">
                <div className="relative h-20 w-20 sm:h-24 sm:w-24">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(203,213,225,0.4)" strokeWidth="10" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke="#E17055" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={251.2}
                      className="animate-progress"
                      style={{ strokeDashoffset: 251.2 * 0.35 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[#2D3436] sm:text-2xl">65%</span>
                    <span className="text-[10px] text-[#636E72] sm:text-xs">Mastered</span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-[#636E72] sm:text-sm">1,024 / 1,577</p>
            </GlassCard>
          </div>
        </div>
      </div>

      {/* 底部留白给 Dock */}
      <div className="h-16" />
    </PageContainer>
  )
}
