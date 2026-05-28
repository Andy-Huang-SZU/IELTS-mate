import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Feather,
  FileText,
  History,
  Layers,
  List,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import { ByTopicView } from './components/ByTopicView'
import {
  fetchWritingSessions,
  type SessionListItem,
  type TopicData,
  type WritingScores,
} from '../../services/writing'

const PAGE_SIZE = 8

const SUBTYPE_LABELS: Record<string, string> = {
  bar: 'Bar Chart',
  line: 'Line Graph',
  pie: 'Pie Chart',
  table: 'Table',
  mixed: 'Mixed',
  map: 'Map',
  process: 'Process',
  opinion: 'Opinion',
  discussion: 'Discussion',
  problem_solution: 'Problem & Solution',
  two_part: 'Two-Part',
  advantage_disadvantage: 'Adv vs Disadv',
}

const DIMENSIONS = [
  { key: 'tr', label: 'TR', color: '#E17055', angle: -90 },
  { key: 'cc', label: 'CC', color: '#5EEAD4', angle: 0 },
  { key: 'lr', label: 'LR', color: '#A78BFA', angle: 90 },
  { key: 'gra', label: 'GRA', color: '#74B9FF', angle: 180 },
] as const

type SortBy = 'latest' | 'score_desc' | 'score_asc'
type TaskFilter = 'all' | 'part_a' | 'part_b'
type ViewMode = 'sessions' | 'by_topic'
type ScoreDimensionKey = 'tr' | 'cc' | 'lr' | 'gra'

function getTaskLabel(taskType: string): string {
  return taskType === 'part_a' ? 'Task 1' : 'Task 2'
}

function getSubtypeLabel(topic: TopicData | null): string | null {
  if (!topic) return null
  const rawSubtype = topic.chart_type || topic.question_type
  if (!rawSubtype) return null
  return SUBTYPE_LABELS[rawSubtype] ?? rawSubtype.replaceAll('_', ' ')
}

function getScoreTone(score: number | null): string {
  if (score == null) return 'bg-[#B2BEC3]/15 text-[#636E72]'
  if (score >= 7) return 'bg-[#00B894]/12 text-[#00B894]'
  if (score >= 5.5) return 'bg-[#FDCB6E]/18 text-[#C98A00]'
  return 'bg-[#E17055]/12 text-[#E17055]'
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  }
}

function polygonPath(values: number[], radius: number): string {
  const cx = 60
  const cy = 60
  return values
    .map((value, index) => {
      const point = polarPoint(cx, cy, radius * value, DIMENSIONS[index].angle)
      return `${point.x},${point.y}`
    })
    .join(' ')
}

function ScoreRadarMini({ scores }: { scores: WritingScores | null }): JSX.Element {
  if (!scores) {
    return (
      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-2xl bg-white/45 text-[#B2BEC3]">
        <FileText size={20} />
      </div>
    )
  }

  const dataValues = DIMENSIONS.map(dim => Math.max(0, Math.min(1, scores[dim.key as ScoreDimensionKey] / 9)))

  return (
    <div className="flex h-[120px] w-[120px] items-center justify-center rounded-2xl bg-white/45">
      <svg viewBox="0 0 120 120" className="h-[110px] w-[110px] overflow-visible">
        {[1, 2, 3].map(level => (
          <polygon
            key={level}
            points={polygonPath([level / 3, level / 3, level / 3, level / 3], 30)}
            fill="none"
            stroke="rgba(99, 110, 114, 0.12)"
            strokeWidth="1"
          />
        ))}
        {DIMENSIONS.map(dim => {
          const outer = polarPoint(60, 60, 34, dim.angle)
          const label = polarPoint(60, 60, 42, dim.angle)
          return (
            <g key={dim.key}>
              <line x1="60" y1="60" x2={outer.x} y2={outer.y} stroke="rgba(99, 110, 114, 0.14)" strokeWidth="1" />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={dim.color}
                fontSize="8"
                fontWeight="700"
              >
                {dim.label}
              </text>
            </g>
          )
        })}
        <polygon
          points={polygonPath(dataValues, 30)}
          fill="rgba(116, 185, 255, 0.18)"
          stroke="#74B9FF"
          strokeWidth="1.5"
        />
        {dataValues.map((value, index) => {
          const point = polarPoint(60, 60, 30 * value, DIMENSIONS[index].angle)
          return <circle key={`${DIMENSIONS[index].key}-point`} cx={point.x} cy={point.y} r="2.5" fill={DIMENSIONS[index].color} />
        })}
      </svg>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WritingHistory(): JSX.Element {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('sessions')
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('latest')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [taskFilter, sortBy])

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchWritingSessions(taskFilter, page, PAGE_SIZE, undefined, sortBy)
      .then(response => {
        setSessions(response.data.sessions)
        setTotal(response.data.total)
      })
      .catch(fetchError => setError(fetchError.message || 'Failed to load writing history'))
      .finally(() => setLoading(false))
  }, [taskFilter, sortBy, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage)
    }
  }, [page, currentPage])

  const currentSortLabel = useMemo(() => {
    switch (sortBy) {
      case 'score_desc':
        return 'Highest score first'
      case 'score_asc':
        return 'Lowest score first'
      default:
        return 'Latest first'
    }
  }, [sortBy])

  const handleRetry = (item: SessionListItem) => {
    const topicSnapshot = item.topic_data
    const resolvedTopicId = item.topic_id || topicSnapshot?.id || null
    const params = new URLSearchParams({
      type: item.task_type === 'part_a' ? 'task1' : 'task2',
    })
    if (resolvedTopicId) params.set('topicId', resolvedTopicId)
    if (topicSnapshot?.chart_type) params.set('chartType', topicSnapshot.chart_type)
    if (topicSnapshot?.question_type) params.set('questionType', topicSnapshot.question_type)

    if (topicSnapshot) {
      navigate(`/writing/editor?${params.toString()}`, { state: { topic: topicSnapshot } })
      return
    }
    navigate(`/writing/editor?${params.toString()}`)
  }

  return (
    <PageContainer>
      <button
        onClick={() => navigate('/writing')}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#636E72] transition-colors hover:text-[#2D3436] animate-fade-in"
      >
        <ArrowLeft size={16} />
        <span>Back to Writing Hub</span>
      </button>

      <header className="mb-6 animate-fade-in">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#74B9FF]/12">
            <History size={24} className="text-[#74B9FF]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Writing History</h2>
            <p className="mt-1 text-sm text-[#636E72]">
              Review past essays, compare dimension scores, and redo the exact same prompt whenever you want.
            </p>
            {viewMode === 'sessions' && (
              <p className="mt-2 text-xs text-[#B2BEC3]">
                {total} sessions · {currentSortLabel}
              </p>
            )}
          </div>
        </div>
      </header>

      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.04s' }}>
        <GlassCard className="p-5" hover>
          <div className="flex flex-col gap-4">
            {/* View mode tabs */}
            <div>
              <p className="mb-2 text-[11px] font-medium text-[#636E72]">View</p>
              <div className="flex gap-1.5 rounded-xl bg-[#F0F0EC] p-1">
                <button
                  onClick={() => setViewMode('sessions')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                    viewMode === 'sessions'
                      ? 'bg-white text-[#2D3436] shadow-sm'
                      : 'text-[#636E72] hover:text-[#2D3436]'
                  }`}
                >
                  <List size={13} />
                  Sessions
                </button>
                <button
                  onClick={() => setViewMode('by_topic')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all ${
                    viewMode === 'by_topic'
                      ? 'bg-white text-[#2D3436] shadow-sm'
                      : 'text-[#636E72] hover:text-[#2D3436]'
                  }`}
                >
                  <Layers size={13} />
                  By Topic
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-[11px] font-medium text-[#636E72]">Task</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'all', label: 'All' },
                    { value: 'part_a', label: 'Task 1' },
                    { value: 'part_b', label: 'Task 2' },
                  ] as const).map(option => (
                    <button
                      key={option.value}
                      onClick={() => setTaskFilter(option.value)}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                        taskFilter === option.value
                          ? 'bg-[#2D3436] text-white shadow-sm'
                          : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {viewMode === 'sessions' && (
                <div>
                  <p className="mb-2 text-[11px] font-medium text-[#636E72]">Sort</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: 'latest', label: 'Latest' },
                      { value: 'score_desc', label: 'Score ↓' },
                      { value: 'score_asc', label: 'Score ↑' },
                    ] as const).map(option => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value)}
                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                          sortBy === option.value
                            ? 'bg-[#74B9FF] text-white shadow-sm'
                            : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </section>

      {viewMode === 'by_topic' ? (
        <ByTopicView taskFilter={taskFilter} />
      ) : loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 size={28} className="animate-spin text-[#B2BEC3]" />
          <p className="text-sm text-[#B2BEC3]">Loading history...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <GlassCard className="animate-fade-in p-8 text-center" hover>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7F6F2] text-[#B2BEC3]">
            <FileText size={24} />
          </div>
          <h3 className="text-lg font-medium text-[#2D3436]">No writing sessions yet</h3>
          <p className="mt-2 text-sm text-[#636E72]">Start a practice session from the Writing Hub, and your reports will show up here.</p>
          <button
            onClick={() => navigate('/writing')}
            className="mt-5 rounded-xl bg-gradient-to-r from-[#00B894] to-[#5EEAD4] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:scale-[1.02]"
          >
            Go to Writing Hub
          </button>
        </GlassCard>
      ) : (
        <>
          <section className="space-y-4 animate-fade-in" style={{ animationDelay: '0.08s' }}>
            {sessions.map(item => {
              const topicSnapshot = item.topic_data
              const subtypeLabel = getSubtypeLabel(topicSnapshot)
              const resolvedTopicId = item.topic_id || topicSnapshot?.id || 'Unknown topic ID'
              const canRetry = Boolean(item.topic_id || topicSnapshot?.id)

              return (
                <GlassCard key={item.id} className="p-5" hover>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="shrink-0">
                      <ScoreRadarMini scores={item.scores} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className={`rounded-full px-2.5 py-1 font-semibold ${getScoreTone(item.overall_score)}`}>
                          Overall {item.overall_score ?? '--'}
                        </span>
                        <span className="rounded-full bg-[#F7F6F2] px-2.5 py-1 text-[#636E72]">
                          {getTaskLabel(item.task_type)}
                        </span>
                        {subtypeLabel && (
                          <span className="rounded-full bg-[#F7F6F2] px-2.5 py-1 text-[#636E72]">
                            {subtypeLabel}
                          </span>
                        )}
                        <span className="rounded-full bg-[#2D3436]/5 px-2.5 py-1 text-[#2D3436]">
                          {resolvedTopicId}
                        </span>
                        {topicSnapshot?.difficulty && (
                          <span className="rounded-full bg-[#74B9FF]/10 px-2.5 py-1 capitalize text-[#74B9FF]">
                            {topicSnapshot.difficulty}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-medium text-[#2D3436]">
                        {item.topic.slice(0, 140)}
                        {item.topic.length > 140 ? '...' : ''}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#636E72]">
                        <span className="inline-flex items-center gap-1.5">
                          {item.task_type === 'part_a' ? <BarChart3 size={13} /> : <Feather size={13} />}
                          {item.word_count} words
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={13} />
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                      <Link
                        to={`/writing/report/${item.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-[#636E72]/12 px-4 py-2.5 text-sm text-[#636E72] transition-all hover:bg-white/50"
                      >
                        View Report
                      </Link>
                      <button
                        onClick={() => handleRetry(item)}
                        disabled={!canRetry}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E17055] to-[#FDCB6E] px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                      >
                        <RotateCcw size={14} />
                        Redo Topic
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )
            })}
          </section>

          <div className="mt-6 flex items-center justify-between gap-3 animate-fade-in" style={{ animationDelay: '0.12s' }}>
            <button
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 rounded-xl border border-[#636E72]/10 px-3.5 py-2 text-sm text-[#636E72] transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              Previous
            </button>

            <p className="text-xs text-[#636E72]">
              Page {currentPage} / {totalPages}
            </p>

            <button
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-xl border border-[#636E72]/10 px-3.5 py-2 text-sm text-[#636E72] transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
    </PageContainer>
  )
}
