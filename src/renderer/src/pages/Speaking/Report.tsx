import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronUp, Clock, Loader2 } from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  fetchSpeakingSessionDetail,
  type SessionDetailData,
  type SpeakingScores,
  type SpeakingAgentReport,
} from '../../services/speaking'

/* ── Score dimension config ── */
const DIMENSION_CONFIG: { key: keyof SpeakingScores; label: string; color: string }[] = [
  { key: 'fc', label: 'Fluency & Coherence', color: '#00B894' },
  { key: 'lr', label: 'Lexical Resource', color: '#74B9FF' },
  { key: 'gra', label: 'Grammar Range & Accuracy', color: '#FDCB6E' },
  { key: 'pronunciation', label: 'Pronunciation', color: '#A78BFA' },
]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const min = Math.floor(seconds / 60)
  const sec = seconds % 60
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`
}

/* ── Score Ring Mini ── */
function ScoreRing({ score, size = 56, color }: { score: number; size?: number; color: string }) {
  const strokeWidth = 4
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const progress = Math.min(score / 9, 1)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(203,213,225,0.3)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

/* ── Agent Report Accordion ── */
function AgentReportCard({
  dimension,
  report,
  color,
}: {
  dimension: string
  report: SpeakingAgentReport
  color: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <GlassCard className="overflow-hidden" hover>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-white/20"
      >
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-medium text-[#2D3436]">{dimension}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color }}>
            {report.score.toFixed(1)}
          </span>
          {expanded ? <ChevronUp size={14} className="text-[#636E72]" /> : <ChevronDown size={14} className="text-[#636E72]" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[#636E72]/8 px-5 py-4">
          {report.strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#00B894] mb-1">Strengths</p>
              <ul className="space-y-1">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#636E72]">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#00B894]" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.weaknesses.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#E17055] mb-1">Areas for Improvement</p>
              <ul className="space-y-1">
                {report.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#636E72]">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#E17055]" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.suggestions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#74B9FF] mb-1">Suggestions</p>
              <ul className="space-y-1">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#636E72]">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#74B9FF]" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

/* ── Main Report Page ── */
export function SpeakingReport(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<SessionDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transcriptExpanded, setTranscriptExpanded] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchSpeakingSessionDetail(Number(id))
      .then((res) => setData(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#B2BEC3]" />
        </div>
      </PageContainer>
    )
  }

  if (error || !data) {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <p className="text-sm text-[#E17055]">{error || 'Session not found'}</p>
          <button
            onClick={() => navigate('/speaking/history')}
            className="text-xs text-[#636E72] underline"
          >
            Back to History
          </button>
        </div>
      </PageContainer>
    )
  }

  const hasScores = data.scores && data.scores.overall > 0
  const isMock = data.mode === 'mock_test'

  return (
    <PageContainer>
      <h1 className="sr-only">Speaking Report</h1>

      {/* Header */}
      <header className="mb-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/speaking/history')}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 transition-all hover:bg-white/70 hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={18} className="text-[#2D3436]" />
          </button>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#2D3436]">Speaking Report</h2>
            <p className="text-xs text-[#636E72]">
              {isMock ? 'Mock Test' : 'Free Chat'} · {formatDate(data.created_at)}
            </p>
          </div>
        </div>
      </header>

      {/* Overview card */}
      <div className="animate-fade-in" style={{ animationDelay: '0.03s' }}>
        <GlassCard className="p-6 mb-5" hover>
          <div className="flex items-center gap-6">
            {/* Overall score */}
            {hasScores && data.scores && (
              <div className="flex flex-col items-center">
                <ScoreRing score={data.scores.overall} size={80} color="#A78BFA" />
                <span className="mt-1 text-[10px] font-medium text-[#636E72]">Overall Band</span>
              </div>
            )}

            {/* Meta info */}
            <div className="flex-1 space-y-2">
              {data.topic_summary && (
                <p className="text-sm text-[#2D3436]">{data.topic_summary}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#636E72]">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatDuration(data.duration_seconds)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  data.status === 'completed'
                    ? 'bg-[#00B894]/10 text-[#00B894]'
                    : 'bg-[#FDCB6E]/10 text-[#FDCB6E]'
                }`}>
                  {data.status}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Four-dimension scores */}
      {hasScores && data.scores && (
        <div className="grid grid-cols-2 gap-3 mb-5 animate-fade-in sm:grid-cols-4" style={{ animationDelay: '0.06s' }}>
          {DIMENSION_CONFIG.map((dim) => (
            <GlassCard key={dim.key} className="flex flex-col items-center gap-2 p-4" hover>
              <ScoreRing score={data.scores![dim.key]} size={52} color={dim.color} />
              <p className="text-[10px] font-medium text-[#636E72] text-center leading-tight">
                {dim.label}
              </p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Agent reports */}
      {Object.keys(data.agent_reports).length > 0 && (
        <section className="mb-5 space-y-3 animate-fade-in" style={{ animationDelay: '0.09s' }}>
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-[#B2BEC3]">
            Detailed Evaluation
          </h3>
          {DIMENSION_CONFIG.map((dim) => {
            const report = data.agent_reports[dim.key]
            if (!report) return null
            return (
              <AgentReportCard
                key={dim.key}
                dimension={dim.label}
                report={report}
                color={dim.color}
              />
            )
          })}
        </section>
      )}

      {/* Transcript */}
      {data.transcript.length > 0 && (
        <section className="mb-5 animate-fade-in" style={{ animationDelay: '0.12s' }}>
          <GlassCard className="overflow-hidden" hover>
            <button
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-white/20"
            >
              <span className="text-sm font-medium text-[#2D3436]">
                Full Transcript ({data.transcript.length} messages)
              </span>
              {transcriptExpanded ? (
                <ChevronUp size={16} className="text-[#636E72]" />
              ) : (
                <ChevronDown size={16} className="text-[#636E72]" />
              )}
            </button>
            {transcriptExpanded && (
              <div className="border-t border-[#636E72]/8 px-5 py-4 space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide">
                {data.transcript.map((entry, i) => {
                  const isExaminer = entry.role === 'examiner'
                  return (
                    <div
                      key={i}
                      className={`flex ${isExaminer ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isExaminer
                            ? 'rounded-tl-md bg-white/40 border border-white/30'
                            : 'rounded-tr-md bg-[#A78BFA]/10 border border-[#A78BFA]/10'
                        }`}
                      >
                        <p className={`text-[10px] font-medium mb-0.5 ${
                          isExaminer ? 'text-[#636E72]' : 'text-[#A78BFA]'
                        }`}>
                          {isExaminer ? 'Examiner' : 'You'}
                          {entry.phase && (
                            <span className="ml-1.5 text-[#B2BEC3]">· {entry.phase}</span>
                          )}
                        </p>
                        <p className="text-[13px] leading-relaxed text-[#2D3436]">{entry.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </GlassCard>
        </section>
      )}

      {/* Markdown report */}
      {data.report_markdown && (
        <section className="mb-5 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-[#B2BEC3]">
            Examiner&apos;s Report
          </h3>
          <GlassCard className="p-6" hover>
            <div
              className="prose prose-sm max-w-none text-[#2D3436]
                prose-headings:text-[#2D3436] prose-headings:font-serif
                prose-strong:text-[#2D3436]
                prose-li:text-[#636E72]
                prose-p:text-[#636E72]"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(data.report_markdown) }}
            />
          </GlassCard>
        </section>
      )}

      <div className="h-20" />
    </PageContainer>
  )
}

/* ── Simple markdown → HTML converter ── */
function markdownToHtml(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')

  // Wrap list items in <ul>
  html = html.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>')

  return `<p>${html}</p>`
}
