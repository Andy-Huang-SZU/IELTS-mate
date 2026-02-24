import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, AlertTriangle, Lightbulb, FileText,
  RotateCcw, Home, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  fetchSessionDetail,
  type SessionDetailData,
  type AgentReport,
} from '../../services/writing'

/* ──── Score ring with gradient ──── */
function ScoreRing({ score }: { score: number }) {
  const pct = (score / 9) * 100
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = score >= 7 ? '#00B894' : score >= 5.5 ? '#FDCB6E' : '#E17055'

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(200,210,215,0.2)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-bold text-[#2D3436]">{score}</span>
        <span className="text-[10px] text-[#B2BEC3] -mt-0.5">/ 9.0</span>
      </div>
    </div>
  )
}

/* ──── Dimension score bar ──── */
const DIMENSION_META: Record<string, { label: string; full: string; color: string }> = {
  tr: { label: 'TR', full: 'Task Response', color: '#E17055' },
  cc: { label: 'CC', full: 'Coherence & Cohesion', color: '#5EEAD4' },
  lr: { label: 'LR', full: 'Lexical Resource', color: '#A78BFA' },
  gra: { label: 'GRA', full: 'Grammatical Range', color: '#74B9FF' },
}

function DimensionBar({ dim, score }: { dim: string; score: number }) {
  const meta = DIMENSION_META[dim] ?? { label: dim.toUpperCase(), full: dim, color: '#636E72' }
  const pct = Math.min((score / 9) * 100, 100)
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 shrink-0 text-right">
        <span className="text-[10px] font-bold tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-[#636E72]">{meta.full}</span>
          <span className="text-xs font-semibold text-[#2D3436] tabular-nums">{score}</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#F0F0EC] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: meta.color }}
          />
        </div>
      </div>
    </div>
  )
}

/* ──── Agent report card ──── */
function AgentReportCard({ dim, report }: { dim: string; report: AgentReport }) {
  const [expanded, setExpanded] = useState(false)
  const meta = DIMENSION_META[dim] ?? { label: dim.toUpperCase(), full: dim, color: '#636E72' }

  return (
    <GlassCard className="p-4" hover>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 rounded-full" style={{ backgroundColor: meta.color }} />
          <span className="text-sm font-medium text-[#2D3436]">{meta.full}</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: meta.color }}>
            {report.score}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#B2BEC3]" /> : <ChevronDown size={14} className="text-[#B2BEC3]" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          {report.strengths.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-[#00B894] uppercase mb-2">
                <CheckCircle size={12} /> Strengths
              </h4>
              <ul className="space-y-1">
                {report.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-[#636E72] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#00B894]">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.weaknesses.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-[#E17055] uppercase mb-2">
                <AlertTriangle size={12} /> Weaknesses
              </h4>
              <ul className="space-y-1">
                {report.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-[#636E72] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#E17055]">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.suggestions.length > 0 && (
            <div>
              <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-[#74B9FF] uppercase mb-2">
                <Lightbulb size={12} /> Suggestions
              </h4>
              <ul className="space-y-1">
                {report.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-[#636E72] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#74B9FF]">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.detailed_annotations.length > 0 && (
            <div>
              <h4 className="text-[11px] font-medium text-[#636E72] uppercase mb-2">Annotations</h4>
              <div className="space-y-2">
                {report.detailed_annotations.map((a, i) => (
                  <div key={i} className="rounded-lg bg-[#E17055]/5 px-3 py-2">
                    <p className="text-xs font-medium text-[#E17055] italic">&quot;{a.text}&quot;</p>
                    <p className="text-[11px] text-[#636E72] mt-1">{a.issue}</p>
                    <p className="text-[11px] text-[#00B894] mt-0.5">→ {a.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

/* ──── Annotated Essay ──── */
function AnnotatedEssay({ essay, reports }: { essay: string; reports: Record<string, AgentReport> }) {
  const annotations = useMemo(() => {
    const all: { text: string; issue: string; suggestion: string }[] = []
    for (const r of Object.values(reports)) {
      all.push(...(r.detailed_annotations ?? []))
    }
    return all
  }, [reports])

  if (!annotations.length) {
    return <p className="text-[13px] text-[#2D3436]/85 leading-relaxed whitespace-pre-wrap">{essay}</p>
  }

  let result = essay
  const parts: { text: string; highlighted: boolean; issue?: string; suggestion?: string }[] = []

  const sortedAnnotations = [...annotations].sort((a, b) => {
    const idxA = result.toLowerCase().indexOf(a.text.toLowerCase())
    const idxB = result.toLowerCase().indexOf(b.text.toLowerCase())
    return idxA - idxB
  })

  let cursor = 0
  for (const ann of sortedAnnotations) {
    const idx = result.toLowerCase().indexOf(ann.text.toLowerCase(), cursor)
    if (idx === -1) continue
    if (idx > cursor) {
      parts.push({ text: result.slice(cursor, idx), highlighted: false })
    }
    parts.push({ text: result.slice(idx, idx + ann.text.length), highlighted: true, issue: ann.issue, suggestion: ann.suggestion })
    cursor = idx + ann.text.length
  }
  if (cursor < result.length) {
    parts.push({ text: result.slice(cursor), highlighted: false })
  }

  return (
    <p className="text-[13px] text-[#2D3436]/85 leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.highlighted ? (
          <span
            key={i}
            className="bg-[#E17055]/10 border-b border-dashed border-[#E17055]/40 cursor-help relative group"
            title={`${p.issue}\n→ ${p.suggestion}`}
          >
            {p.text}
            <span className="absolute bottom-full left-0 z-10 hidden group-hover:block w-64 p-2 rounded-lg bg-white shadow-lg border text-[11px] text-[#636E72] mb-1">
              <strong className="text-[#E17055]">{p.issue}</strong>
              <br />
              <span className="text-[#00B894]">→ {p.suggestion}</span>
            </span>
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}

/* ──── Main Report Page ──── */
export function WritingReport(): JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SessionDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchSessionDetail(Number(id))
      .then(r => setData(r.data))
      .catch(e => setError(e.message || 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 size={32} className="text-[#B2BEC3] animate-spin" />
          <p className="text-sm text-[#B2BEC3]">Loading report...</p>
        </div>
      </PageContainer>
    )
  }

  if (error || !data) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center py-24 gap-4">
          <p className="text-sm text-red-500">{error || 'Report not found'}</p>
          <button onClick={() => navigate('/writing')} className="text-sm text-[#636E72] hover:text-[#2D3436] underline">
            Back to Writing Hub
          </button>
        </div>
      </PageContainer>
    )
  }

  const scores = data.scores

  return (
    <PageContainer>
      {/* Back */}
      <button
        onClick={() => navigate('/writing')}
        className="mb-5 flex items-center gap-1.5 text-sm text-[#636E72] hover:text-[#2D3436] transition-colors animate-fade-in"
      >
        <ArrowLeft size={16} />
        <span>Back to Writing Hub</span>
      </button>

      {/* Header */}
      <header className="text-center mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Writing Assessment</h2>
        <p className="mt-1 text-xs text-[#B2BEC3]">
          {data.task_type === 'part_a' ? 'Task 1' : 'Task 2'} · {data.word_count} words · {new Date(data.created_at).toLocaleDateString()}
        </p>
      </header>

      {scores && (
        <>
          {/* Overall Score + Dimension Bars */}
          <div className="grid gap-5 sm:grid-cols-2 mb-6 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <GlassCard className="p-6 flex flex-col items-center justify-center" hover>
              <p className="text-[10px] uppercase tracking-widest text-[#B2BEC3] mb-3">Overall Band Score</p>
              <ScoreRing score={scores.overall} />
            </GlassCard>

            <GlassCard className="p-6 flex flex-col justify-center gap-4" hover>
              <DimensionBar dim="tr" score={scores.tr} />
              <DimensionBar dim="cc" score={scores.cc} />
              <DimensionBar dim="lr" score={scores.lr} />
              <DimensionBar dim="gra" score={scores.gra} />
            </GlassCard>
          </div>

          {/* Detailed Agent Reports */}
          <section className="mb-6 space-y-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest mb-2">
              Detailed Analysis
            </h3>
            {['tr', 'cc', 'lr', 'gra'].map(dim => {
              const report = data.agent_reports[dim]
              return report ? <AgentReportCard key={dim} dim={dim} report={report} /> : null
            })}
          </section>
        </>
      )}

      {/* Annotated Essay */}
      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest mb-3">
          <FileText size={12} /> Your Essay (Annotated)
        </h3>
        <GlassCard className="p-6" hover>
          <AnnotatedEssay essay={data.user_essay} reports={data.agent_reports} />
        </GlassCard>
      </section>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-4 pb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={() => navigate('/writing')}
          className="flex items-center gap-2 rounded-xl border border-[#636E72]/15 px-5 py-2.5 text-sm text-[#636E72] transition-all hover:bg-white/50"
        >
          <Home size={14} />
          Writing Hub
        </button>
        <button
          onClick={() => navigate(`/writing/editor?type=${data.task_type === 'part_a' ? 'task1' : 'task2'}`)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#E17055] to-[#FDCB6E] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95"
        >
          <RotateCcw size={14} />
          Write Again
        </button>
      </div>
    </PageContainer>
  )
}
