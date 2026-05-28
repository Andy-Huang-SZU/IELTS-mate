import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Feather,
  FileText,
  Hash,
  Loader2,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import { GlassCard } from '../../../components/flux'
import {
  fetchTopicAggregates,
  fetchTopicTrend,
  type TopicAggregateItem,
  type TopicData,
  type TopicTrendPoint,
} from '../../../services/writing'
import { TopicTrendChart } from './TopicTrendChart'

const PAGE_SIZE = 10

const SUBTYPE_LABELS: Record<string, string> = {
  bar: 'Bar Chart', line: 'Line Graph', pie: 'Pie Chart', table: 'Table',
  mixed: 'Mixed', map: 'Map', process: 'Process',
  opinion: 'Opinion', discussion: 'Discussion',
  problem_solution: 'Problem & Solution', two_part: 'Two-Part',
  advantage_disadvantage: 'Adv vs Disadv',
}

function getScoreTone(score: number | null): string {
  if (score == null) return 'bg-[#B2BEC3]/15 text-[#636E72]'
  if (score >= 7) return 'bg-[#00B894]/12 text-[#00B894]'
  if (score >= 5.5) return 'bg-[#FDCB6E]/18 text-[#C98A00]'
  return 'bg-[#E17055]/12 text-[#E17055]'
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

type TopicSortBy = 'latest' | 'attempts_desc' | 'best_score_desc'

interface Props {
  taskFilter: 'all' | 'part_a' | 'part_b'
}

export function ByTopicView({ taskFilter }: Props): JSX.Element {
  const navigate = useNavigate()
  const [topics, setTopics] = useState<TopicAggregateItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<TopicSortBy>('latest')
  const [page, setPage] = useState(1)

  // Expanded topic trend
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null)
  const [trendData, setTrendData] = useState<TopicTrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(false)

  useEffect(() => { setPage(1) }, [taskFilter, sortBy])

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchTopicAggregates(taskFilter, page, PAGE_SIZE, sortBy)
      .then(r => { setTopics(r.data.topics); setTotal(r.data.total) })
      .catch(e => setError(e.message || 'Failed to load topics'))
      .finally(() => setLoading(false))
  }, [taskFilter, sortBy, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  const handleToggleTrend = useCallback(async (topicId: string) => {
    if (expandedTopic === topicId) {
      setExpandedTopic(null)
      return
    }
    setExpandedTopic(topicId)
    setTrendLoading(true)
    fetchTopicTrend(topicId)
      .then(r => setTrendData(r.data.attempts))
      .catch(() => setTrendData([]))
      .finally(() => setTrendLoading(false))
  }, [expandedTopic])

  const handleRedoTopic = useCallback((item: TopicAggregateItem) => {
    const params = new URLSearchParams({
      type: item.task_type === 'part_a' ? 'task1' : 'task2',
    })
    params.set('topicId', item.topic_id)
    const td = item.topic_data as TopicData | null
    if (td?.chart_type) params.set('chartType', td.chart_type)
    if (td?.question_type) params.set('questionType', td.question_type)
    if (td) {
      navigate(`/writing/editor?${params.toString()}`, { state: { topic: td } })
    } else {
      navigate(`/writing/editor?${params.toString()}`)
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 size={28} className="animate-spin text-[#B2BEC3]" />
        <p className="text-sm text-[#B2BEC3]">Loading topics...</p>
      </div>
    )
  }

  if (error) {
    return <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600">{error}</div>
  }

  if (topics.length === 0) {
    return (
      <GlassCard className="p-8 text-center animate-fade-in" hover>
        <FileText size={24} className="mx-auto text-[#B2BEC3] mb-3" />
        <h3 className="text-lg font-medium text-[#2D3436]">还没有按题记录</h3>
        <p className="mt-2 text-sm text-[#636E72]">完成练习后，同一道题的数据会自动聚合到这里。</p>
      </GlassCard>
    )
  }

  return (
    <>
      {/* Sort controls */}
      <div className="mb-4 flex flex-wrap gap-2">
        {([
          { value: 'latest', label: '最近练习' },
          { value: 'attempts_desc', label: '练习次数 ↓' },
          { value: 'best_score_desc', label: '最佳分数 ↓' },
        ] as const).map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
              sortBy === opt.value
                ? 'bg-[#A78BFA] text-white shadow-sm'
                : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <section className="space-y-3 animate-fade-in">
        {topics.map(item => {
          const td = item.topic_data as TopicData | null
          const subtypeRaw = td?.chart_type || td?.question_type
          const subtypeLabel = subtypeRaw ? (SUBTYPE_LABELS[subtypeRaw] ?? subtypeRaw.replaceAll('_', ' ')) : null
          const isExpanded = expandedTopic === item.topic_id

          return (
            <GlassCard key={item.topic_id} className="overflow-hidden" hover>
              {/* Main row */}
              <div className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  {/* Score summary */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${getScoreTone(item.best_score)}`}>
                        Best {item.best_score ?? '--'}
                      </span>
                      <span className="text-[9px] text-[#B2BEC3]">
                        Avg {item.avg_score ?? '--'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center min-w-[50px]">
                      <span className="font-serif text-xl font-bold text-[#2D3436] tabular-nums">{item.attempts}</span>
                      <span className="text-[9px] text-[#B2BEC3]">次练习</span>
                    </div>
                  </div>

                  {/* Topic info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#2D3436]/5 px-2 py-0.5 font-semibold text-[#2D3436]">
                        <Hash size={9} /> {item.topic_id}
                      </span>
                      <span className="rounded-full bg-[#F7F6F2] px-2 py-0.5 text-[#636E72]">
                        {item.task_type === 'part_a' ? 'Task 1' : 'Task 2'}
                      </span>
                      {subtypeLabel && (
                        <span className="rounded-full bg-[#F7F6F2] px-2 py-0.5 text-[#636E72]">{subtypeLabel}</span>
                      )}
                    </div>
                    <p className="text-sm text-[#2D3436] leading-snug">
                      {item.topic.slice(0, 120)}{item.topic.length > 120 ? '...' : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[#B2BEC3]">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={10} /> 最近: {formatShortDate(item.latest_at)}
                      </span>
                      {item.latest_score != null && (
                        <span className="inline-flex items-center gap-1">
                          Latest: <strong className="text-[#2D3436]">{item.latest_score}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleToggleTrend(item.topic_id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-all ${
                        isExpanded
                          ? 'border-[#A78BFA]/30 bg-[#A78BFA]/8 text-[#A78BFA]'
                          : 'border-[#636E72]/12 text-[#636E72] hover:bg-white/50'
                      }`}
                    >
                      <TrendingUp size={12} />
                      趋势
                      {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    <button
                      onClick={() => handleRedoTopic(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E17055] to-[#FDCB6E] px-3 py-2 text-xs font-medium text-white shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <RotateCcw size={12} />
                      再做一次
                    </button>
                  </div>
                </div>
              </div>

              {/* Expandable trend section */}
              {isExpanded && (
                <div className="border-t border-[#636E72]/8 bg-white/20 px-5 py-4 animate-fade-in">
                  {trendLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={18} className="animate-spin text-[#B2BEC3]" />
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <TrendingUp size={12} className="text-[#A78BFA]" />
                        <span className="text-[11px] font-medium text-[#636E72] uppercase tracking-wider">
                          Score Trend ({trendData.length} attempts)
                        </span>
                      </div>
                      <TopicTrendChart points={trendData} />

                      {/* Attempt list */}
                      {trendData.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                          {trendData.map((pt, i) => (
                            <div
                              key={pt.session_id}
                              className="flex items-center gap-3 rounded-lg bg-white/30 px-3 py-2 hover:bg-white/50 transition-colors cursor-pointer"
                              onClick={() => navigate(`/writing/report/${pt.session_id}`)}
                            >
                              <span className="text-[10px] text-[#B2BEC3] w-4 text-right">#{i + 1}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getScoreTone(pt.overall_score)}`}>
                                {pt.overall_score ?? '--'}
                              </span>
                              <span className="text-[10px] text-[#636E72] flex items-center gap-1">
                                {pt.word_count > 0 && (
                                  <>
                                    {item.task_type === 'part_a' ? <BarChart3 size={9} /> : <Feather size={9} />}
                                    {pt.word_count}w
                                  </>
                                )}
                              </span>
                              <span className="flex-1" />
                              <span className="text-[10px] text-[#B2BEC3]">
                                {formatShortDate(pt.created_at)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </GlassCard>
          )
        })}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => setPage(c => Math.max(1, c - 1))}
            disabled={currentPage <= 1}
            className="inline-flex items-center gap-1 rounded-xl border border-[#636E72]/10 px-3.5 py-2 text-sm text-[#636E72] transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <p className="text-xs text-[#636E72]">Page {currentPage} / {totalPages}</p>
          <button
            onClick={() => setPage(c => Math.min(totalPages, c + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-[#636E72]/10 px-3.5 py-2 text-sm text-[#636E72] transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  )
}
