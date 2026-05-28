import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  FileText,
  RotateCcw,
  Home,
  ChevronDown,
  ChevronUp,
  Loader2,
  Hash,
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  fetchSessionDetail,
  type SessionDetailData,
  type AgentReport,
  type TopicData,
} from '../../services/writing'
import { ChartRenderer } from './components/ChartRenderer'

interface MarkdownSection {
  level: number
  title: string
  content: string
}

interface ParsedSuggestion {
  text: string
  source: 'chief' | 'agent'
  dimension?: string
}

interface ParsedChiefReport {
  summaryTitle: string
  summaryParagraphs: string[]
  modelAnswerTitle: string
  modelAnswerParagraphs: string[]
  rewriteTitle: string
  rewriteSuggestions: ParsedSuggestion[]
  rawMarkdown: string
  hasDedicatedModelAnswer: boolean
  hasDedicatedRewriteSuggestions: boolean
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/
const BULLET_RE = /^(?:[-*•]|\d+[.)])\s+(.*)$/

function normaliseMarkdown(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim()
}

function normaliseKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[>#*_]/g, ' ')
    .replace(/[()[\]{}:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanInlineMarkdown(value: string): string {
  return value
    .trim()
    .replace(/^>+\s?/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitMarkdownSections(markdown: string): { preamble: string; sections: MarkdownSection[] } {
  const lines = normaliseMarkdown(markdown).split('\n')
  const sections: MarkdownSection[] = []
  const preamble: string[] = []
  let currentSection: MarkdownSection | null = null

  for (const line of lines) {
    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      if (currentSection) {
        currentSection.content = currentSection.content.trim()
        sections.push(currentSection)
      }

      currentSection = {
        level: headingMatch[1].length,
        title: cleanInlineMarkdown(headingMatch[2]),
        content: '',
      }
      continue
    }

    if (currentSection) {
      currentSection.content += `${currentSection.content ? '\n' : ''}${line}`
    } else {
      preamble.push(line)
    }
  }

  if (currentSection) {
    currentSection.content = currentSection.content.trim()
    sections.push(currentSection)
  }

  return {
    preamble: preamble.join('\n').trim(),
    sections,
  }
}

function contentToParagraphs(content: string): string[] {
  return normaliseMarkdown(content)
    .split(/\n\s*\n+/)
    .map(block =>
      block
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !BULLET_RE.test(line) && !HEADING_RE.test(line))
        .join(' '),
    )
    .map(cleanInlineMarkdown)
    .filter(Boolean)
}

function contentToListItems(content: string): string[] {
  const items: string[] = []
  const lines = normaliseMarkdown(content).split('\n')
  let current = ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    const bulletMatch = line.match(BULLET_RE)

    if (bulletMatch) {
      if (current) {
        items.push(cleanInlineMarkdown(current))
      }
      current = bulletMatch[1]
      continue
    }

    if (!line) {
      if (current) {
        items.push(cleanInlineMarkdown(current))
        current = ''
      }
      continue
    }

    if (current) {
      current += ` ${line}`
    }
  }

  if (current) {
    items.push(cleanInlineMarkdown(current))
  }

  if (items.length > 0) {
    return items.filter(Boolean)
  }

  return contentToParagraphs(content)
}

function isDimensionHeading(title: string): boolean {
  const key = normaliseKey(title)
  return /(task response|task achievement|coherence|cohesion|lexical|grammar|grammatical|\btr\b|\bcc\b|\blr\b|\bgra\b)/.test(key)
}

function isModelAnswerHeading(title: string): boolean {
  const key = normaliseKey(title)
  return /(model answer|sample answer|high band answer|band 8 answer|band 9 answer|improved answer|范文|示范答案|参考答案)/.test(key)
}

function isRewriteHeading(title: string): boolean {
  const key = normaliseKey(title)
  return /(rewrite suggestion|rewrite suggestions|revision suggestion|revision suggestions|improvement suggestion|improvement suggestions|how to improve|rewrite advice|重写建议|改写建议|提升建议)/.test(key)
}

function isOverallHeading(title: string): boolean {
  const key = normaliseKey(title)
  return /(overall|summary|assessment|band score|general feedback|chief examiner|总评|总体评价|综合评价)/.test(key)
}

function buildFallbackRewriteSuggestions(reports: Record<string, AgentReport>): ParsedSuggestion[] {
  const seen = new Set<string>()
  const suggestions: ParsedSuggestion[] = []

  for (const dim of ['tr', 'cc', 'lr', 'gra']) {
    const report = reports[dim]
    if (!report) continue

    const dimension = DIMENSION_META[dim]?.label ?? dim.toUpperCase()
    for (const suggestion of report.suggestions ?? []) {
      const cleaned = cleanInlineMarkdown(suggestion)
      const key = normaliseKey(cleaned)
      if (!cleaned || !key || seen.has(key)) continue
      seen.add(key)
      suggestions.push({ text: cleaned, source: 'agent', dimension })
      if (suggestions.length >= 6) return suggestions
    }
  }

  return suggestions
}

function parseChiefReport(markdown: string, reports: Record<string, AgentReport>): ParsedChiefReport {
  const rawMarkdown = normaliseMarkdown(markdown)
  const fallbackSuggestions = buildFallbackRewriteSuggestions(reports)

  if (!rawMarkdown) {
    return {
      summaryTitle: 'Chief Examiner Summary',
      summaryParagraphs: [],
      modelAnswerTitle: 'Model Answer',
      modelAnswerParagraphs: [],
      rewriteTitle: 'Rewrite Suggestions',
      rewriteSuggestions: fallbackSuggestions,
      rawMarkdown,
      hasDedicatedModelAnswer: false,
      hasDedicatedRewriteSuggestions: false,
    }
  }

  const { preamble, sections } = splitMarkdownSections(rawMarkdown)
  const modelAnswerIndex = sections.findIndex(section => isModelAnswerHeading(section.title))
  const rewriteIndex = sections.findIndex(section => isRewriteHeading(section.title))
  const sectionCutoffCandidates = [modelAnswerIndex, rewriteIndex].filter(index => index >= 0)
  const sectionCutoff = sectionCutoffCandidates.length > 0 ? Math.min(...sectionCutoffCandidates) : sections.length

  const summarySections = sections.filter(
    (section, index) =>
      index < sectionCutoff
      && !isDimensionHeading(section.title)
      && !isModelAnswerHeading(section.title)
      && !isRewriteHeading(section.title),
  )

  const summaryParagraphs = [
    ...contentToParagraphs(preamble),
    ...summarySections.flatMap(section => contentToParagraphs(section.content)),
  ].filter(Boolean)

  const overviewSection = summarySections.find(
    section => isOverallHeading(section.title) && section.content.trim().length > 0,
  )

  const modelAnswerSection = modelAnswerIndex >= 0 ? sections[modelAnswerIndex] : null
  const rewriteSection = rewriteIndex >= 0 ? sections[rewriteIndex] : null
  const rewriteSuggestions = rewriteSection
    ? contentToListItems(rewriteSection.content).map(text => ({ text, source: 'chief' as const }))
    : fallbackSuggestions

  return {
    summaryTitle: overviewSection?.title || 'Chief Examiner Summary',
    summaryParagraphs,
    modelAnswerTitle: modelAnswerSection?.title || 'Model Answer',
    modelAnswerParagraphs: modelAnswerSection ? contentToParagraphs(modelAnswerSection.content) : [],
    rewriteTitle: rewriteSection?.title || 'Rewrite Suggestions',
    rewriteSuggestions,
    rawMarkdown,
    hasDedicatedModelAnswer: Boolean(modelAnswerSection),
    hasDedicatedRewriteSuggestions: Boolean(rewriteSection),
  }
}

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
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
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
                {report.strengths.map((strength, index) => (
                  <li key={index} className="text-xs text-[#636E72] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#00B894]">
                    {strength}
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
                {report.weaknesses.map((weakness, index) => (
                  <li key={index} className="text-xs text-[#636E72] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#E17055]">
                    {weakness}
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
                {report.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-xs text-[#636E72] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[#74B9FF]">
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.detailed_annotations.length > 0 && (
            <div>
              <h4 className="text-[11px] font-medium text-[#636E72] uppercase mb-2">Annotations</h4>
              <div className="space-y-2">
                {report.detailed_annotations.map((annotation, index) => (
                  <div key={index} className="rounded-lg bg-[#E17055]/5 px-3 py-2">
                    <p className="text-xs font-medium text-[#E17055] italic">&quot;{annotation.text}&quot;</p>
                    <p className="text-[11px] text-[#636E72] mt-1">{annotation.issue}</p>
                    <p className="text-[11px] text-[#00B894] mt-0.5">→ {annotation.suggestion}</p>
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

function AnnotatedEssay({ essay, reports }: { essay: string; reports: Record<string, AgentReport> }) {
  const annotations = useMemo(() => {
    const all: { text: string; issue: string; suggestion: string }[] = []
    for (const report of Object.values(reports)) {
      all.push(...(report.detailed_annotations ?? []))
    }
    return all
  }, [reports])

  if (!annotations.length) {
    return <p className="text-[13px] text-[#2D3436]/85 leading-relaxed whitespace-pre-wrap">{essay}</p>
  }

  const essayText = essay
  const parts: { text: string; highlighted: boolean; issue?: string; suggestion?: string }[] = []

  const sortedAnnotations = [...annotations].sort((a, b) => {
    const idxA = essayText.toLowerCase().indexOf(a.text.toLowerCase())
    const idxB = essayText.toLowerCase().indexOf(b.text.toLowerCase())
    return idxA - idxB
  })

  let cursor = 0
  for (const annotation of sortedAnnotations) {
    const index = essayText.toLowerCase().indexOf(annotation.text.toLowerCase(), cursor)
    if (index === -1) continue
    if (index > cursor) {
      parts.push({ text: essayText.slice(cursor, index), highlighted: false })
    }
    parts.push({
      text: essayText.slice(index, index + annotation.text.length),
      highlighted: true,
      issue: annotation.issue,
      suggestion: annotation.suggestion,
    })
    cursor = index + annotation.text.length
  }

  if (cursor < essayText.length) {
    parts.push({ text: essayText.slice(cursor), highlighted: false })
  }

  return (
    <p className="text-[13px] text-[#2D3436]/85 leading-relaxed whitespace-pre-wrap">
      {parts.map((part, index) =>
        part.highlighted ? (
          <span
            key={index}
            className="bg-[#E17055]/10 border-b border-dashed border-[#E17055]/40 cursor-help relative group"
            title={`${part.issue}\n→ ${part.suggestion}`}
          >
            {part.text}
            <span className="absolute bottom-full left-0 z-10 hidden group-hover:block w-64 p-2 rounded-lg bg-white shadow-lg border text-[11px] text-[#636E72] mb-1">
              <strong className="text-[#E17055]">{part.issue}</strong>
              <br />
              <span className="text-[#00B894]">→ {part.suggestion}</span>
            </span>
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  )
}

export function WritingReport(): JSX.Element {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SessionDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showRawMarkdown, setShowRawMarkdown] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchSessionDetail(Number(id))
      .then(response => setData(response.data))
      .catch(fetchError => setError(fetchError.message || 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    setShowRawMarkdown(false)
  }, [data?.session_id])

  const chiefReport = useMemo(() => {
    // Prefer backend-parsed structured report when available
    const sr = data?.structured_report
    if (sr && (sr.summary_paragraphs.length > 0 || sr.model_answer_paragraphs.length > 0 || sr.rewrite_suggestions.length > 0)) {
      return {
        summaryTitle: sr.summary_title,
        summaryParagraphs: sr.summary_paragraphs,
        modelAnswerTitle: sr.model_answer_title,
        modelAnswerParagraphs: sr.model_answer_paragraphs,
        rewriteTitle: sr.rewrite_title,
        rewriteSuggestions: sr.rewrite_suggestions.map(s => ({
          text: s.text,
          source: s.source as 'chief' | 'agent',
          dimension: s.dimension,
        })),
        rawMarkdown: data?.report_markdown ?? '',
        hasDedicatedModelAnswer: sr.has_model_answer,
        hasDedicatedRewriteSuggestions: sr.has_rewrite_suggestions,
      } satisfies ParsedChiefReport
    }
    // Fallback to frontend parsing for old sessions or parse failure
    return parseChiefReport(data?.report_markdown ?? '', data?.agent_reports ?? {})
  }, [data?.structured_report, data?.report_markdown, data?.agent_reports])

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
  const topicSnapshot = (data.topic_data ?? null) as TopicData | null
  const topicId = data.topic_id || topicSnapshot?.id || 'Unknown topic ID'
  const topicSubtype = topicSnapshot?.chart_type || topicSnapshot?.question_type || 'unknown'
  const topicDifficulty = topicSnapshot?.difficulty || 'medium'
  const hasChart = data.task_type === 'part_a' && topicSnapshot?.chart_data
  const hasChiefSection = chiefReport.summaryParagraphs.length > 0
    || chiefReport.modelAnswerParagraphs.length > 0
    || chiefReport.rewriteSuggestions.length > 0
    || chiefReport.rawMarkdown.length > 0

  const retryQuery = new URLSearchParams({
    type: data.task_type === 'part_a' ? 'task1' : 'task2',
  })
  const retryTopicId = topicSnapshot?.id || data.topic_id
  if (retryTopicId) retryQuery.set('topicId', retryTopicId)
  if (topicSnapshot?.chart_type) retryQuery.set('chartType', topicSnapshot.chart_type)
  if (topicSnapshot?.question_type) retryQuery.set('questionType', topicSnapshot.question_type)

  const handleWriteAgain = () => {
    if (topicSnapshot) {
      navigate(`/writing/editor?${retryQuery.toString()}`, { state: { topic: topicSnapshot } })
      return
    }
    navigate(`/writing/editor?${retryQuery.toString()}`)
  }

  return (
    <PageContainer>
      <button
        onClick={() => navigate('/writing')}
        className="mb-5 flex items-center gap-1.5 text-sm text-[#636E72] hover:text-[#2D3436] transition-colors animate-fade-in"
      >
        <ArrowLeft size={16} />
        <span>Back to Writing Hub</span>
      </button>

      <header className="text-center mb-8 animate-fade-in">
        <h2 className="font-serif text-2xl font-semibold text-[#2D3436]">Writing Assessment</h2>
        <p className="mt-1 text-xs text-[#B2BEC3]">
          {data.task_type === 'part_a' ? 'Task 1' : 'Task 2'} · {data.word_count} words · {new Date(data.created_at).toLocaleDateString()}
        </p>
      </header>

      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.03s' }}>
        <GlassCard className="p-6" hover>
          <div className="flex flex-wrap items-center gap-2 text-[11px] mb-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2D3436]/5 px-2.5 py-1 font-semibold text-[#2D3436]">
              <Hash size={11} /> {topicId}
            </span>
            <span className="rounded-full bg-white/60 px-2.5 py-1 text-[#636E72] uppercase tracking-wide">
              {topicSubtype.replaceAll('_', ' ')}
            </span>
            <span className="rounded-full bg-white/60 px-2.5 py-1 text-[#636E72] uppercase tracking-wide">
              {topicDifficulty}
            </span>
          </div>
          <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest mb-3">
            <FileText size={12} /> Original Topic
          </h3>
          <p className="text-[13px] text-[#2D3436]/85 leading-relaxed whitespace-pre-wrap">
            {data.topic}
          </p>
          {topicSnapshot?.topic_tags && topicSnapshot.topic_tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {topicSnapshot.topic_tags.map(tag => (
                <span key={tag} className="rounded-full bg-[#F7F6F2] px-2.5 py-1 text-[10px] text-[#636E72]">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {hasChart && topicSnapshot?.chart_data && (
            <div className="mt-5 border-t border-[#636E72]/8 pt-5">
              <ChartRenderer chartType={topicSnapshot.chart_type} chartData={topicSnapshot.chart_data as any} />
            </div>
          )}
        </GlassCard>
      </section>

      {scores && (
        <>
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

          {hasChiefSection && (
            <section className="mb-6 space-y-5 animate-fade-in" style={{ animationDelay: '0.08s' }}>
              <h3 className="text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest">
                Chief Examiner Highlights
              </h3>

              {chiefReport.summaryParagraphs.length > 0 && (
                <GlassCard className="p-6" hover>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={14} className="text-[#E17055]" />
                    <h4 className="text-sm font-medium text-[#2D3436]">{chiefReport.summaryTitle}</h4>
                  </div>
                  <div className="space-y-3">
                    {chiefReport.summaryParagraphs.map((paragraph, index) => (
                      <p key={index} className="text-[13px] text-[#2D3436]/85 leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </GlassCard>
              )}

              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <GlassCard className="p-6 h-full" hover>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={14} className="text-[#5EEAD4]" />
                    <div>
                      <h4 className="text-sm font-medium text-[#2D3436]">{chiefReport.modelAnswerTitle}</h4>
                      {!chiefReport.hasDedicatedModelAnswer && (
                        <p className="text-[11px] text-[#B2BEC3] mt-0.5">No dedicated model answer section found in this report.</p>
                      )}
                    </div>
                  </div>

                  {chiefReport.modelAnswerParagraphs.length > 0 ? (
                    <div className="space-y-3">
                      {chiefReport.modelAnswerParagraphs.map((paragraph, index) => (
                        <p key={index} className="text-[13px] text-[#2D3436]/85 leading-relaxed">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#B2BEC3] leading-relaxed">
                      The chief markdown did not include a standalone model answer section for this session.
                    </p>
                  )}
                </GlassCard>

                <GlassCard className="p-6 h-full" hover>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb size={14} className="text-[#74B9FF]" />
                    <div>
                      <h4 className="text-sm font-medium text-[#2D3436]">{chiefReport.rewriteTitle}</h4>
                      {!chiefReport.hasDedicatedRewriteSuggestions && chiefReport.rewriteSuggestions.length > 0 && (
                        <p className="text-[11px] text-[#B2BEC3] mt-0.5">Fallback to dimension-level suggestions when chief markdown has no dedicated section.</p>
                      )}
                    </div>
                  </div>

                  {chiefReport.rewriteSuggestions.length > 0 ? (
                    <div className="space-y-2.5">
                      {chiefReport.rewriteSuggestions.map((item, index) => (
                        <div key={`${item.text}-${index}`} className="rounded-xl bg-[#74B9FF]/6 px-3.5 py-3">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#74B9FF]/12 text-[10px] font-semibold text-[#74B9FF]">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] text-[#2D3436]/85 leading-relaxed">{item.text}</p>
                              {item.source === 'agent' && item.dimension && (
                                <p className="mt-1 text-[10px] uppercase tracking-wide text-[#B2BEC3]">
                                  From {item.dimension}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[#B2BEC3] leading-relaxed">
                      No rewrite suggestions were available for this session.
                    </p>
                  )}
                </GlassCard>
              </div>

              {chiefReport.rawMarkdown && (
                <GlassCard className="p-4 sm:p-5" hover>
                  <button
                    onClick={() => setShowRawMarkdown(!showRawMarkdown)}
                    className="w-full flex items-center justify-between gap-3"
                  >
                    <div className="text-left">
                      <h4 className="text-sm font-medium text-[#2D3436]">Original Chief Markdown</h4>
                      <p className="mt-0.5 text-[11px] text-[#B2BEC3]">Useful for debugging section parsing or reviewing the full narrative report.</p>
                    </div>
                    {showRawMarkdown ? <ChevronUp size={16} className="text-[#B2BEC3]" /> : <ChevronDown size={16} className="text-[#B2BEC3]" />}
                  </button>

                  {showRawMarkdown && (
                    <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#F7F6F2] px-4 py-4 text-[12px] leading-6 text-[#636E72] whitespace-pre-wrap">
                      {chiefReport.rawMarkdown}
                    </pre>
                  )}
                </GlassCard>
              )}
            </section>
          )}

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

      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <h3 className="flex items-center gap-2 text-[11px] font-medium text-[#B2BEC3] uppercase tracking-widest mb-3">
          <FileText size={12} /> Your Essay (Annotated)
        </h3>
        <GlassCard className="p-6" hover>
          <AnnotatedEssay essay={data.user_essay} reports={data.agent_reports} />
        </GlassCard>
      </section>

      <div className="flex items-center justify-center gap-4 pb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <button
          onClick={() => navigate('/writing')}
          className="flex items-center gap-2 rounded-xl border border-[#636E72]/15 px-5 py-2.5 text-sm text-[#636E72] transition-all hover:bg-white/50"
        >
          <Home size={14} />
          Writing Hub
        </button>
        <button
          onClick={handleWriteAgain}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#E17055] to-[#FDCB6E] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95"
        >
          <RotateCcw size={14} />
          Write Again
        </button>
      </div>
    </PageContainer>
  )
}
