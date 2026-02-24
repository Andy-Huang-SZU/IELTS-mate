import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart3, Feather, FileText, Send, Loader2, ArrowLeft,
  TrendingUp, PieChart,
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  generateTopic,
  evaluateEssay,
  type TopicData,
  type ChartData,
} from '../../services/writing'

/* ──── Simple SVG chart for Task 1 ──── */
function MiniBarChart({ chart }: { chart: ChartData }) {
  const allVals = chart.series.flatMap(s => s.data)
  const max = Math.max(...allVals, 1)
  const colors = ['#5EEAD4', '#74B9FF', '#FDCB6E', '#E17055', '#A78BFA', '#00B894']
  const barW = Math.max(12, Math.min(32, 200 / (chart.categories.length * chart.series.length)))
  const groupW = barW * chart.series.length + 8
  const svgW = Math.max(280, groupW * chart.categories.length + 60)

  return (
    <div className="mt-4 overflow-x-auto">
      {chart.title && (
        <p className="text-[10px] text-[#636E72] mb-2 text-center">{chart.title}</p>
      )}
      <svg viewBox={`0 0 ${svgW} 160`} className="w-full max-h-[140px]">
        {chart.categories.map((cat, ci) => (
          <g key={ci}>
            {chart.series.map((s, si) => {
              const h = (s.data[ci] / max) * 110
              const x = 40 + ci * groupW + si * barW
              return (
                <rect
                  key={si}
                  x={x}
                  y={130 - h}
                  width={barW - 2}
                  height={h}
                  rx={3}
                  fill={colors[si % colors.length]}
                  opacity={0.85}
                />
              )
            })}
            <text
              x={40 + ci * groupW + (groupW - 8) / 2}
              y={148}
              textAnchor="middle"
              className="fill-[#B2BEC3]"
              fontSize={8}
            >
              {cat}
            </text>
          </g>
        ))}
      </svg>
      {chart.series.length > 1 && (
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {chart.series.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-[9px] text-[#636E72]">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniLineChart({ chart }: { chart: ChartData }) {
  const allVals = chart.series.flatMap(s => s.data)
  const max = Math.max(...allVals, 1)
  const colors = ['#00B894', '#74B9FF', '#E17055', '#A78BFA', '#FDCB6E']
  const w = 280
  const h = 120
  const padX = 40
  const padY = 15
  const plotW = w - padX - 10
  const plotH = h - padY * 2
  const n = chart.categories.length

  return (
    <div className="mt-4">
      {chart.title && (
        <p className="text-[10px] text-[#636E72] mb-2 text-center">{chart.title}</p>
      )}
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full max-h-[130px]">
        {chart.series.map((s, si) => {
          const pts = s.data
            .map((v, i) => {
              const x = padX + (i / Math.max(n - 1, 1)) * plotW
              const y = padY + plotH - (v / max) * plotH
              return `${x},${y}`
            })
            .join(' ')
          return (
            <polyline
              key={si}
              points={pts}
              fill="none"
              stroke={colors[si % colors.length]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )
        })}
        {chart.categories.map((cat, i) => (
          <text
            key={i}
            x={padX + (i / Math.max(n - 1, 1)) * plotW}
            y={h + 10}
            textAnchor="middle"
            className="fill-[#B2BEC3]"
            fontSize={8}
          >
            {cat}
          </text>
        ))}
      </svg>
    </div>
  )
}

function MiniPieChart({ chart }: { chart: ChartData }) {
  const data = chart.series[0]?.data ?? []
  const labels = chart.categories
  const total = data.reduce((a, b) => a + b, 0) || 1
  const colors = ['#5EEAD4', '#74B9FF', '#FDCB6E', '#E17055', '#A78BFA', '#00B894']
  let cumAngle = -Math.PI / 2

  return (
    <div className="mt-4 flex flex-col items-center">
      {chart.title && (
        <p className="text-[10px] text-[#636E72] mb-2 text-center">{chart.title}</p>
      )}
      <svg viewBox="0 0 120 120" className="w-24 h-24">
        {data.map((v, i) => {
          const angle = (v / total) * Math.PI * 2
          const startX = 60 + 50 * Math.cos(cumAngle)
          const startY = 60 + 50 * Math.sin(cumAngle)
          cumAngle += angle
          const endX = 60 + 50 * Math.cos(cumAngle)
          const endY = 60 + 50 * Math.sin(cumAngle)
          const large = angle > Math.PI ? 1 : 0
          return (
            <path
              key={i}
              d={`M60,60 L${startX},${startY} A50,50 0 ${large},1 ${endX},${endY} Z`}
              fill={colors[i % colors.length]}
              opacity={0.85}
            />
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {labels.map((l, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="text-[9px] text-[#636E72]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartRenderer({ chartType, chartData }: { chartType?: string; chartData?: ChartData }) {
  if (!chartData) return null
  if (chartType === 'line') return <MiniLineChart chart={chartData} />
  if (chartType === 'pie') return <MiniPieChart chart={chartData} />
  return <MiniBarChart chart={chartData} />
}

/* ──── Main Editor Component ──── */
export function WritingEditor(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const taskType = searchParams.get('type') === 'task1' ? 'part_a' : 'part_b'

  const [topic, setTopic] = useState<TopicData | null>(null)
  const [loadingTopic, setLoadingTopic] = useState(true)
  const [essay, setEssay] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const wordCount = useMemo(() => {
    const trimmed = essay.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [essay])

  const recommended = taskType === 'part_a' ? '150+' : '250+'

  useEffect(() => {
    setLoadingTopic(true)
    setError('')
    generateTopic(taskType)
      .then(r => setTopic(r.data))
      .catch(e => setError(e.message || 'Failed to generate topic'))
      .finally(() => setLoadingTopic(false))
  }, [taskType])

  const handleSubmit = useCallback(async () => {
    if (!topic || !essay.trim()) return
    setSubmitting(true)
    setError('')
    evaluateEssay({
      task_type: taskType,
      topic: topic.prompt,
      topic_data: topic.chart_data ? { chart_type: topic.chart_type, chart_data: topic.chart_data } : null,
      user_essay: essay,
    })
      .then(r => {
        navigate(`/writing/report/${r.data.session_id}`)
      })
      .catch(e => {
        setError(e.message || 'Evaluation failed')
        setSubmitting(false)
      })
  }, [topic, essay, taskType, navigate])

  const isTask1 = taskType === 'part_a'
  const tagColor = isTask1 ? 'bg-[#5EEAD4]/20 text-[#00B894]' : 'bg-[#E17055]/15 text-[#E17055]'
  const tagIcon = isTask1 ? <BarChart3 size={13} /> : <Feather size={13} />
  const tagLabel = isTask1 ? 'Task 1' : 'Task 2'

  return (
    <PageContainer>
      {/* Back button */}
      <button
        onClick={() => navigate('/writing')}
        className="mb-4 flex items-center gap-1.5 text-sm text-[#636E72] hover:text-[#2D3436] transition-colors animate-fade-in"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {/* Loading overlay for evaluation */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <GlassCard className="flex flex-col items-center gap-4 p-8">
            <Loader2 size={36} className="text-[#E17055] animate-spin" />
            <p className="text-sm font-medium text-[#2D3436]">AI 正在批改...</p>
            <p className="text-xs text-[#B2BEC3]">通常需要 30-60 秒，请耐心等待</p>
          </GlassCard>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in">
          {error}
        </div>
      )}

      {/* Main layout: left topic + right editor */}
      <div className="flex flex-col lg:flex-row gap-5 animate-fade-in" style={{ animationDelay: '0.05s' }}>

        {/* Left: Topic Panel */}
        <div className="w-full lg:w-[38%] shrink-0">
          <GlassCard className="p-6 sticky top-6" hover>
            {/* Tag */}
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tagColor} mb-4`}>
              {tagIcon}
              {tagLabel}
            </div>

            {loadingTopic ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Loader2 size={24} className="text-[#B2BEC3] animate-spin" />
                <p className="text-xs text-[#B2BEC3]">Generating topic...</p>
              </div>
            ) : topic ? (
              <>
                <h3 className="text-sm font-medium text-[#2D3436] mb-3 flex items-center gap-2">
                  <FileText size={15} className="text-[#636E72]" />
                  Topic
                </h3>
                <p className="text-[13px] leading-relaxed text-[#2D3436]/90 whitespace-pre-wrap">
                  {topic.prompt}
                </p>

                {isTask1 && topic.chart_data && (
                  <ChartRenderer chartType={topic.chart_type} chartData={topic.chart_data} />
                )}

                {/* Word count guide */}
                <div className="mt-5 flex items-center gap-2 rounded-lg bg-[#F7F6F2] px-3 py-2">
                  <TrendingUp size={13} className="text-[#636E72]" />
                  <span className="text-[10px] text-[#636E72]">
                    Recommended: {recommended} words
                  </span>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-[#B2BEC3]">
                Failed to load topic. Please go back and try again.
              </p>
            )}
          </GlassCard>
        </div>

        {/* Right: Writing Area */}
        <div className="flex-1 flex flex-col min-h-[500px]">
          <GlassCard className="flex-1 flex flex-col p-0 overflow-hidden" hover>
            {/* Paper-texture textarea */}
            <textarea
              value={essay}
              onChange={e => setEssay(e.target.value)}
              placeholder="Start writing your essay here..."
              disabled={submitting || loadingTopic}
              className="flex-1 w-full resize-none border-0 bg-transparent px-7 py-6 text-[14px] leading-[32px] text-[#2D3436] placeholder:text-[#B2BEC3]/60 focus:outline-none disabled:opacity-50"
              style={{
                fontFamily: "'Inter', sans-serif",
                backgroundImage:
                  'repeating-linear-gradient(transparent, transparent 31px, rgba(180,190,195,0.12) 31px, rgba(180,190,195,0.12) 32px)',
                backgroundSize: '100% 32px',
                backgroundPosition: '0 5px',
              }}
            />

            {/* Bottom toolbar */}
            <div className="flex items-center justify-between border-t border-[#636E72]/8 px-5 py-3 bg-white/30 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#636E72]">
                  <span className="font-semibold text-[#2D3436] tabular-nums">{wordCount}</span> words
                </span>
                {wordCount > 0 && (
                  <span className={`text-[10px] ${
                    wordCount >= parseInt(recommended) ? 'text-[#00B894]' : 'text-[#FDCB6E]'
                  }`}>
                    {wordCount >= parseInt(recommended) ? '✓ Good length' : `Target: ${recommended}`}
                  </span>
                )}
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !essay.trim() || !topic}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00B894] to-[#5EEAD4] px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send size={14} />
                Submit for Review
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </PageContainer>
  )
}
