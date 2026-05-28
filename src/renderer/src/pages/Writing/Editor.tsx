import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Feather,
  FileText,
  Hash,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  evaluateEssay,
  fetchTopicBank,
  generateTopic,
  randomTopic,
  topicEstimate,
  type TopicData,
} from '../../services/writing'
import { ChartRenderer } from './components/ChartRenderer'

export function WritingEditor(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const taskType = searchParams.get('type') === 'task1' ? 'part_a' : 'part_b'
  const chartTypeParam = searchParams.get('chartType')
  const questionTypeParam = searchParams.get('questionType')
  const sourceParam = searchParams.get('source')
  const topicIdParam = searchParams.get('topicId')

  const [topic, setTopic] = useState<TopicData | null>(null)
  const [loadingTopic, setLoadingTopic] = useState(true)
  const [swapping, setSwapping] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [essay, setEssay] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tokenInfo, setTokenInfo] = useState<{ total_tokens: number; estimated_cost?: number } | null>(null)
  const [chartCollapsed, setChartCollapsed] = useState(false)

  const topicFromState = useMemo(() => {
    const state = location.state as { topic?: TopicData } | null
    const candidate = state?.topic
    if (!candidate || candidate.task_type !== taskType) return null
    return candidate
  }, [location.state, taskType])

  const wordCount = useMemo(() => {
    const trimmed = essay.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [essay])

  const recommended = taskType === 'part_a' ? '150+' : '250+'
  const topicSubtype = topic?.chart_type || topic?.question_type || 'unknown'
  const topicDifficulty = topic?.difficulty || 'medium'

  useEffect(() => {
    let cancelled = false

    const loadTopic = async () => {
      setLoadingTopic(true)
      setError('')
      setEssay('')

      try {
        if (topicFromState) {
          if (!cancelled) setTopic(topicFromState)
          return
        }

        if (topicIdParam) {
          const bankResponse = await fetchTopicBank({
            task_type: taskType,
            chart_type: chartTypeParam || undefined,
            question_type: questionTypeParam || undefined,
          })
          const matchedTopic = bankResponse.data.topics.find(item => item.id === topicIdParam)
          if (matchedTopic) {
            if (!cancelled) setTopic(matchedTopic)
            return
          }
        }

        if (sourceParam === 'ai') {
          const generated = await generateTopic({
            task_type: taskType,
            chart_type: chartTypeParam || undefined,
            question_type: questionTypeParam || undefined,
          })
          if (!cancelled) setTopic(generated.data)
          return
        }

        try {
          const random = await randomTopic({
            task_type: taskType,
            chart_type: chartTypeParam || undefined,
            question_type: questionTypeParam || undefined,
          })
          if (!cancelled) setTopic(random.data)
        } catch {
          const generated = await generateTopic({
            task_type: taskType,
            chart_type: chartTypeParam || undefined,
            question_type: questionTypeParam || undefined,
          })
          if (!cancelled) setTopic(generated.data)
        }
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load topic'
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setLoadingTopic(false)
      }
    }

    loadTopic()

    return () => {
      cancelled = true
    }
  }, [taskType, sourceParam, chartTypeParam, questionTypeParam, topicIdParam, topicFromState])

  useEffect(() => {
    topicEstimate({
      task_type: taskType,
      chart_type: chartTypeParam || undefined,
      question_type: questionTypeParam || undefined,
    })
      .then(r => setTokenInfo(r.data))
      .catch(() => {})
  }, [taskType, chartTypeParam, questionTypeParam])

  const handleSwapTopic = useCallback(async () => {
    setSwapping(true)
    setError('')
    setChartCollapsed(false)
    randomTopic({
      task_type: taskType,
      chart_type: chartTypeParam || undefined,
      question_type: questionTypeParam || undefined,
    })
      .then(r => {
        setTopic(r.data)
        setEssay('')
      })
      .catch(e => setError(e.message || 'No more topics available'))
      .finally(() => setSwapping(false))
  }, [taskType, chartTypeParam, questionTypeParam])

  const handleAiGenerate = useCallback(async () => {
    setAiGenerating(true)
    setError('')
    setChartCollapsed(false)
    generateTopic({
      task_type: taskType,
      chart_type: chartTypeParam || undefined,
      question_type: questionTypeParam || undefined,
    })
      .then(r => {
        setTopic(r.data)
        setEssay('')
      })
      .catch(e => setError(e.message || 'AI generation failed'))
      .finally(() => setAiGenerating(false))
  }, [taskType, chartTypeParam, questionTypeParam])

  const handleSubmit = useCallback(async () => {
    if (!topic || !essay.trim()) return
    setSubmitting(true)
    setError('')
    evaluateEssay({
      task_type: taskType,
      topic_id: topic.id ?? null,
      topic: topic.prompt,
      topic_data: topic as unknown as Record<string, unknown>,
      user_essay: essay,
    })
      .then(r => navigate(`/writing/report/${r.data.session_id}`))
      .catch(e => {
        setError(e.message || 'Evaluation failed')
        setSubmitting(false)
      })
  }, [topic, essay, taskType, navigate])

  const isTask1 = taskType === 'part_a'
  const hasChart = isTask1 && topic?.chart_data
  const tagColor = isTask1 ? 'bg-[#5EEAD4]/20 text-[#00B894]' : 'bg-[#E17055]/15 text-[#E17055]'
  const tagIcon = isTask1 ? <BarChart3 size={13} /> : <Feather size={13} />
  const tagLabel = isTask1 ? 'Task 1' : 'Task 2'

  const topicContent = (
    <>
      {loadingTopic ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 size={24} className="animate-spin text-[#B2BEC3]" />
          <p className="text-xs text-[#B2BEC3]">Loading topic...</p>
        </div>
      ) : topic ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#2D3436]/5 px-2.5 py-1 font-semibold text-[#2D3436]">
              <Hash size={11} />
              {topic.id || 'Pending ID'}
            </span>
            <span className="rounded-full bg-white/60 px-2.5 py-1 uppercase tracking-wide text-[#636E72]">
              {topicSubtype.replaceAll('_', ' ')}
            </span>
            <span className="rounded-full bg-white/60 px-2.5 py-1 uppercase tracking-wide text-[#636E72]">
              {topicDifficulty}
            </span>
            {topic.legacy_id && (
              <span className="rounded-full bg-[#A78BFA]/10 px-2.5 py-1 text-[#A78BFA]">
                legacy {topic.legacy_id}
              </span>
            )}
          </div>

          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#2D3436]">
            <FileText size={15} className="text-[#636E72]" />
            Topic
          </h3>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#2D3436]/90">
            {topic.prompt}
          </p>

          {topic.topic_tags && topic.topic_tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {topic.topic_tags.map(tag => (
                <span key={tag} className="rounded-full bg-[#F7F6F2] px-2.5 py-1 text-[10px] text-[#636E72]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleSwapTopic}
              disabled={swapping || aiGenerating}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#DFE6E9] px-3 py-1.5 text-[11px] font-medium text-[#636E72] transition-all hover:bg-[#F7F6F2] hover:text-[#2D3436] disabled:opacity-40"
            >
              <RefreshCw size={12} className={swapping ? 'animate-spin' : ''} />
              Swap Topic
            </button>
            <button
              onClick={handleAiGenerate}
              disabled={swapping || aiGenerating}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#A78BFA]/10 px-3 py-1.5 text-[11px] font-medium text-[#A78BFA] transition-all hover:bg-[#A78BFA]/20 disabled:opacity-40"
              title={tokenInfo ? `~${tokenInfo.total_tokens.toLocaleString()} tokens${tokenInfo.estimated_cost ? ` ($${tokenInfo.estimated_cost.toFixed(4)})` : ''}` : 'Generate with AI'}
            >
              <Sparkles size={12} className={aiGenerating ? 'animate-pulse' : ''} />
              AI Generate
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#F7F6F2] px-3 py-2">
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
    </>
  )

  const writingArea = (
    <GlassCard className="flex flex-1 flex-col overflow-hidden p-0" hover>
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

      <div className="shrink-0 border-t border-[#636E72]/8 bg-white/30 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#636E72]">
              <span className="tabular-nums font-semibold text-[#2D3436]">{wordCount}</span> words
            </span>
            {wordCount > 0 && (
              <span className={`text-[10px] ${wordCount >= parseInt(recommended) ? 'text-[#00B894]' : 'text-[#FDCB6E]'}`}>
                {wordCount >= parseInt(recommended) ? '✓ Good length' : `Target: ${recommended}`}
              </span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !essay.trim() || !topic}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#00B894] to-[#5EEAD4] px-5 py-2 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:shadow-lg active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
          >
            <Send size={14} />
            Submit for Review
          </button>
        </div>
      </div>
    </GlassCard>
  )

  return (
    <PageContainer>
      <button
        onClick={() => navigate('/writing')}
        className="mb-4 flex cursor-pointer items-center gap-1.5 text-sm text-[#636E72] transition-colors hover:text-[#2D3436] animate-fade-in"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <GlassCard className="flex flex-col items-center gap-4 p-8">
            <Loader2 size={36} className="animate-spin text-[#E17055]" />
            <p className="text-sm font-medium text-[#2D3436]">AI is grading...</p>
            <p className="text-xs text-[#B2BEC3]">Usually takes 30-60 seconds</p>
          </GlassCard>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 animate-fade-in">
          {error}
        </div>
      )}

      {hasChart ? (
        <div className="flex flex-col gap-5 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <GlassCard className="p-6" hover>
            <div className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tagColor}`}>
              {tagIcon}
              {tagLabel}
            </div>

            {topicContent}

            {topic?.chart_data && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="h-px flex-1 bg-[#DFE6E9]/60" />
                  <button
                    onClick={() => setChartCollapsed(!chartCollapsed)}
                    className="flex cursor-pointer items-center gap-1.5 px-3 py-1 text-[10px] font-medium text-[#636E72] transition-colors hover:text-[#2D3436]"
                  >
                    {chartCollapsed ? (
                      <>
                        <ChevronDown size={12} />
                        Show Chart
                      </>
                    ) : (
                      <>
                        <ChevronUp size={12} />
                        Hide Chart
                      </>
                    )}
                  </button>
                  <div className="h-px flex-1 bg-[#DFE6E9]/60" />
                </div>

                {!chartCollapsed && (
                  <div className="transition-all duration-300">
                    <ChartRenderer chartType={topic.chart_type} chartData={topic.chart_data as any} />
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          <div className="flex min-h-[500px] flex-col">
            {writingArea}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 animate-fade-in lg:flex-row" style={{ animationDelay: '0.05s' }}>
          <div className="w-full shrink-0 lg:w-[38%]">
            <GlassCard className="sticky top-6 p-6" hover>
              <div className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${tagColor}`}>
                {tagIcon}
                {tagLabel}
              </div>

              {topicContent}
            </GlassCard>
          </div>

          <div className="flex min-h-[500px] flex-1 flex-col">
            {writingArea}
          </div>
        </div>
      )}
    </PageContainer>
  )
}
