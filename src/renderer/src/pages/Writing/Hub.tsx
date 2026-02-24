import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Feather, FileText, Loader2 } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { fetchWritingSessions, type SessionListItem } from '../../services/writing'

/**
 * 写作中心 - New Task 1 / New Task 2 大入口卡 + Recent Essays 真实数据
 */
export function WritingHub(): JSX.Element {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWritingSessions('all', 1, 10)
      .then(r => setSessions(r.data.sessions))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    if (diff < 7) return `${diff} days ago`
    return d.toLocaleDateString()
  }

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
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="text-[#B2BEC3] animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <FileText size={28} className="text-[#B2BEC3]" />
              <p className="text-xs text-[#B2BEC3]">还没有写作记录</p>
              <p className="text-[10px] text-[#B2BEC3]/70">选择上方的 Task 开始写作吧</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#636E72]/10">
              {sessions.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/writing/report/${item.id}`}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#2D3436] truncate">
                        {item.task_type === 'part_a' ? 'Task 1' : 'Task 2'}: {item.topic.slice(0, 60)}
                        {item.topic.length > 60 ? '...' : ''}
                      </p>
                      <p className="text-xs text-[#636E72]">{formatDate(item.created_at)}</p>
                    </div>
                    {item.overall_score != null && (
                      <span className="ml-3 shrink-0 rounded-full bg-[#E17055]/10 px-2.5 py-0.5 text-xs font-semibold text-[#E17055]">
                        {item.overall_score}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </section>
    </PageContainer>
  )
}
