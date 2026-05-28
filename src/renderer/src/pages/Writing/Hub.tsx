import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Dices,
  Feather,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Map,
  PieChart,
  Search,
  Sparkles,
  Table2,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { GlassCard, PageContainer } from '../../components/flux'
import {
  fetchTopicBank,
  fetchWritingSessions,
  topicEstimate,
  type SessionListItem,
  type TopicData,
} from '../../services/writing'

const TASK1_CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { value: 'line', label: 'Line Graph', icon: TrendingUp },
  { value: 'pie', label: 'Pie Chart', icon: PieChart },
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'mixed', label: 'Mixed', icon: Layers },
  { value: 'map', label: 'Map', icon: Map },
  { value: 'process', label: 'Process', icon: GitBranch },
] as const

const TASK2_QUESTION_TYPES = [
  { value: 'opinion', label: 'Opinion' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'problem_solution', label: 'Problem & Solution' },
  { value: 'two_part', label: 'Two-Part' },
  { value: 'advantage_disadvantage', label: 'Adv vs Disadv' },
] as const

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
] as const

const TOPIC_PAGE_SIZE = 12

const subtypeLabelMap = Object.fromEntries([
  ...TASK1_CHART_TYPES.map(item => [item.value, item.label]),
  ...TASK2_QUESTION_TYPES.map(item => [item.value, item.label]),
]) as Record<string, string>

function getTaskLabel(taskType: string): string {
  return taskType === 'part_a' ? 'Task 1' : 'Task 2'
}

function getSubtypeLabel(topic: TopicData): string {
  const rawSubtype = topic.chart_type || topic.question_type || 'unknown'
  return subtypeLabelMap[rawSubtype] ?? rawSubtype.replaceAll('_', ' ')
}

function topicMatchesSearch(topic: TopicData, keyword: string): boolean {
  if (!keyword) return true
  const haystack = [
    topic.id,
    topic.legacy_id,
    topic.prompt,
    topic.chart_type,
    topic.question_type,
    topic.difficulty,
    ...(topic.topic_tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(keyword)
}

export function WritingHub(): JSX.Element {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [selectedTask, setSelectedTask] = useState<'part_a' | 'part_b'>('part_a')
  const [selectedChartType, setSelectedChartType] = useState<string | null>(null)
  const [selectedQuestionType, setSelectedQuestionType] = useState<string | null>(null)
  const [sourceMode, setSourceMode] = useState<'bank' | 'ai'>('bank')
  const [tokenEst, setTokenEst] = useState<{ total_tokens: number; estimated_cost?: number } | null>(null)
  const [starting, setStarting] = useState(false)

  const [topicBankTopics, setTopicBankTopics] = useState<TopicData[]>([])
  const [topicBankLoading, setTopicBankLoading] = useState(true)
  const [topicBankError, setTopicBankError] = useState('')
  const [topicBankExpanded, setTopicBankExpanded] = useState(false)
  const [topicSearch, setTopicSearch] = useState('')
  const [topicBrowserTask, setTopicBrowserTask] = useState<'all' | 'part_a' | 'part_b'>('all')
  const [topicBrowserChartType, setTopicBrowserChartType] = useState<string | null>(null)
  const [topicBrowserQuestionType, setTopicBrowserQuestionType] = useState<string | null>(null)
  const [topicBrowserDifficulty, setTopicBrowserDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all')
  const [topicBrowserPage, setTopicBrowserPage] = useState(1)

  useEffect(() => {
    fetchWritingSessions('all', 1, 10)
      .then(r => setSessions(r.data.sessions))
      .catch(() => {})
      .finally(() => setLoading(false))

    fetchTopicBank()
      .then(r => {
        setTopicBankTopics(r.data.topics)
        setTopicBankError('')
      })
      .catch(error => setTopicBankError(error.message || 'Failed to load topic bank'))
      .finally(() => setTopicBankLoading(false))
  }, [])

  useEffect(() => {
    if (sourceMode !== 'ai') {
      setTokenEst(null)
      return
    }
    const ct = selectedTask === 'part_a' ? selectedChartType : undefined
    const qt = selectedTask === 'part_b' ? selectedQuestionType : undefined
    topicEstimate({ task_type: selectedTask, chart_type: ct || undefined, question_type: qt || undefined })
      .then(r => setTokenEst(r.data))
      .catch(() => setTokenEst(null))
  }, [sourceMode, selectedTask, selectedChartType, selectedQuestionType])

  useEffect(() => {
    setTopicBrowserPage(1)
  }, [topicBrowserTask, topicBrowserChartType, topicBrowserQuestionType, topicBrowserDifficulty, topicSearch])

  const filteredTopics = useMemo(() => {
    const keyword = topicSearch.trim().toLowerCase()
    return topicBankTopics.filter(topic => {
      if (topicBrowserTask !== 'all' && topic.task_type !== topicBrowserTask) return false
      if (topicBrowserChartType && topic.chart_type !== topicBrowserChartType) return false
      if (topicBrowserQuestionType && topic.question_type !== topicBrowserQuestionType) return false
      if (topicBrowserDifficulty !== 'all' && topic.difficulty !== topicBrowserDifficulty) return false
      return topicMatchesSearch(topic, keyword)
    })
  }, [topicBankTopics, topicBrowserTask, topicBrowserChartType, topicBrowserQuestionType, topicBrowserDifficulty, topicSearch])

  const totalTopicBankPages = Math.max(1, Math.ceil(filteredTopics.length / TOPIC_PAGE_SIZE))
  const safeTopicPage = Math.min(topicBrowserPage, totalTopicBankPages)
  const pagedTopics = filteredTopics.slice((safeTopicPage - 1) * TOPIC_PAGE_SIZE, safeTopicPage * TOPIC_PAGE_SIZE)
  const topicBrowserSubtypeOptions = topicBrowserTask === 'part_a'
    ? TASK1_CHART_TYPES
    : topicBrowserTask === 'part_b'
      ? TASK2_QUESTION_TYPES
      : []

  useEffect(() => {
    if (topicBrowserPage !== safeTopicPage) {
      setTopicBrowserPage(safeTopicPage)
    }
  }, [safeTopicPage, topicBrowserPage])

  const handleRandomTest = async () => {
    setStarting(true)
    navigate('/writing/editor?type=task1&mode=random-test')
  }

  const handleQuickPractice = (taskType: string) => {
    navigate(`/writing/editor?type=${taskType === 'part_a' ? 'task1' : 'task2'}`)
  }

  const handleFreeStart = async () => {
    setStarting(true)
    const type = selectedTask === 'part_a' ? 'task1' : 'task2'
    const ct = selectedTask === 'part_a' ? selectedChartType : undefined
    const qt = selectedTask === 'part_b' ? selectedQuestionType : undefined
    const params = new URLSearchParams({ type })
    if (ct) params.set('chartType', ct)
    if (qt) params.set('questionType', qt)
    if (sourceMode === 'ai') params.set('source', 'ai')
    navigate(`/writing/editor?${params}`)
  }

  const handleOpenTopic = (topic: TopicData) => {
    const params = new URLSearchParams({
      type: topic.task_type === 'part_a' ? 'task1' : 'task2',
    })
    if (topic.id) params.set('topicId', topic.id)
    if (topic.chart_type) params.set('chartType', topic.chart_type)
    if (topic.question_type) params.set('questionType', topic.question_type)
    navigate(`/writing/editor?${params.toString()}`, { state: { topic } })
  }

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
        <p className="mt-1 text-sm text-[#636E72]">Choose your practice mode, browse the full bank, or revisit your writing history</p>
      </header>

      <div className="mb-5 animate-fade-in" style={{ animationDelay: '0.03s' }}>
        <button onClick={handleRandomTest} disabled={starting} className="w-full text-left">
          <GlassCard className="flex cursor-pointer items-center gap-6 p-6 transition-all hover:scale-[1.01]" hover>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#A78BFA]/30 to-[#74B9FF]/30">
              <Dices className="text-[#A78BFA]" size={28} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-[#2D3436]">Random Test</p>
              <p className="text-sm text-[#636E72]">Task 1 + Task 2 complete simulation</p>
            </div>
          </GlassCard>
        </button>
      </div>

      <div className="mb-5 grid gap-4 animate-fade-in sm:grid-cols-2" style={{ animationDelay: '0.06s' }}>
        <button onClick={() => handleQuickPractice('part_a')} className="text-left">
          <GlassCard className="flex min-h-[100px] cursor-pointer items-center gap-5 p-6 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#CAE9E0]/70">
              <BarChart3 className="text-[#2D3436]" size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-medium text-[#2D3436]">Task 1 Only</p>
              <p className="text-xs text-[#636E72]">Chart description</p>
            </div>
          </GlassCard>
        </button>
        <button onClick={() => handleQuickPractice('part_b')} className="text-left">
          <GlassCard className="flex min-h-[100px] cursor-pointer items-center gap-5 p-6 transition-all hover:scale-[1.02]" hover>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFD6A5]/60">
              <Feather className="text-[#E17055]" size={24} strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-medium text-[#2D3436]">Task 2 Only</p>
              <p className="text-xs text-[#636E72]">Essay writing</p>
            </div>
          </GlassCard>
        </button>
      </div>

      <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.09s' }}>
        <GlassCard className="overflow-hidden" hover>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full cursor-pointer items-center justify-between px-6 py-4 transition-colors hover:bg-white/20"
          >
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-[#FDCB6E]" />
              <span className="font-medium text-[#2D3436]">Free Choice</span>
              <span className="text-xs text-[#636E72]">Pick task type, chart type, and source</span>
            </div>
            {expanded ? <ChevronUp size={18} className="text-[#636E72]" /> : <ChevronDown size={18} className="text-[#636E72]" />}
          </button>

          {expanded && (
            <div className="space-y-5 border-t border-[#636E72]/8 px-6 pb-6 pt-2">
              <div>
                <p className="mb-2 text-[11px] font-medium text-[#636E72]">Task</p>
                <div className="flex gap-2">
                  {(['part_a', 'part_b'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTask(t)
                        setSelectedChartType(null)
                        setSelectedQuestionType(null)
                      }}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                        selectedTask === t
                          ? 'bg-[#00B894] text-white shadow-sm'
                          : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                      }`}
                    >
                      {t === 'part_a' ? 'Task 1' : 'Task 2'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium text-[#636E72]">
                  {selectedTask === 'part_a' ? 'Chart Type' : 'Question Type'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedTask === 'part_a'
                    ? TASK1_CHART_TYPES.map(ct => {
                        const Icon = ct.icon
                        const active = selectedChartType === ct.value
                        return (
                          <button
                            key={ct.value}
                            onClick={() => setSelectedChartType(active ? null : ct.value)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                              active
                                ? 'bg-[#5EEAD4]/20 text-[#00B894] ring-1 ring-[#5EEAD4]/50'
                                : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                            }`}
                          >
                            <Icon size={13} />
                            {ct.label}
                          </button>
                        )
                      })
                    : TASK2_QUESTION_TYPES.map(qt => {
                        const active = selectedQuestionType === qt.value
                        return (
                          <button
                            key={qt.value}
                            onClick={() => setSelectedQuestionType(active ? null : qt.value)}
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                              active
                                ? 'bg-[#E17055]/15 text-[#E17055] ring-1 ring-[#E17055]/30'
                                : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                            }`}
                          >
                            {qt.label}
                          </button>
                        )
                      })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium text-[#636E72]">Source</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSourceMode('bank')}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                      sourceMode === 'bank'
                        ? 'bg-[#74B9FF]/15 text-[#74B9FF] ring-1 ring-[#74B9FF]/40'
                        : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                    }`}
                  >
                    <Zap size={14} />
                    Topic Bank
                    <span className="text-[9px] opacity-70">instant</span>
                  </button>
                  <button
                    onClick={() => setSourceMode('ai')}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                      sourceMode === 'ai'
                        ? 'bg-[#A78BFA]/15 text-[#A78BFA] ring-1 ring-[#A78BFA]/40'
                        : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                    }`}
                  >
                    <Sparkles size={14} />
                    AI Generate
                    {tokenEst && (
                      <span className="text-[9px] opacity-70">
                        ~{tokenEst.total_tokens.toLocaleString()} tokens
                        {tokenEst.estimated_cost ? ` ($${tokenEst.estimated_cost.toFixed(4)})` : ''}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleFreeStart}
                disabled={starting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00B894] to-[#5EEAD4] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-95 disabled:opacity-50"
              >
                Start Writing
              </button>
            </div>
          )}
        </GlassCard>
      </div>

      <section className="mb-6 animate-fade-in" style={{ animationDelay: '0.12s' }}>
        <GlassCard className="overflow-hidden" hover>
          <button
            onClick={() => setTopicBankExpanded(!topicBankExpanded)}
            className="flex w-full cursor-pointer items-center justify-between px-6 py-4 transition-colors hover:bg-white/20"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={18} className="text-[#74B9FF]" />
              <span className="font-medium text-[#2D3436]">Topic Browser</span>
              <span className="text-xs text-[#636E72]">
                {topicBankLoading ? 'Loading...' : `${topicBankTopics.length} topics`}
              </span>
            </div>
            {topicBankExpanded ? <ChevronUp size={18} className="text-[#636E72]" /> : <ChevronDown size={18} className="text-[#636E72]" />}
          </button>

          {topicBankExpanded && (
            <div className="space-y-5 border-t border-[#636E72]/8 px-6 pb-6 pt-4">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
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
                          onClick={() => {
                            setTopicBrowserTask(option.value)
                            setTopicBrowserChartType(null)
                            setTopicBrowserQuestionType(null)
                          }}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                            topicBrowserTask === option.value
                              ? 'bg-[#2D3436] text-white shadow-sm'
                              : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {topicBrowserSubtypeOptions.length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-medium text-[#636E72]">
                        {topicBrowserTask === 'part_a' ? 'Chart Type' : 'Question Type'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {topicBrowserTask === 'part_a'
                          ? TASK1_CHART_TYPES.map(option => {
                              const Icon = option.icon
                              const active = topicBrowserChartType === option.value
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => setTopicBrowserChartType(active ? null : option.value)}
                                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                                    active
                                      ? 'bg-[#5EEAD4]/20 text-[#00B894] ring-1 ring-[#5EEAD4]/50'
                                      : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                                  }`}
                                >
                                  <Icon size={13} />
                                  {option.label}
                                </button>
                              )
                            })
                          : TASK2_QUESTION_TYPES.map(option => {
                              const active = topicBrowserQuestionType === option.value
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => setTopicBrowserQuestionType(active ? null : option.value)}
                                  className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                                    active
                                      ? 'bg-[#E17055]/15 text-[#E17055] ring-1 ring-[#E17055]/30'
                                      : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              )
                            })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-[11px] font-medium text-[#636E72]">Difficulty</p>
                    <div className="flex flex-wrap gap-2">
                      {DIFFICULTY_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => setTopicBrowserDifficulty(option.value)}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                            topicBrowserDifficulty === option.value
                              ? 'bg-[#74B9FF] text-white shadow-sm'
                              : 'bg-[#F7F6F2] text-[#636E72] hover:bg-[#DFE6E9]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-medium text-[#636E72]">Search topic</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B2BEC3]" />
                      <input
                        value={topicSearch}
                        onChange={event => setTopicSearch(event.target.value)}
                        placeholder="Search by ID, prompt, or tags"
                        className="w-full rounded-xl border border-white/60 bg-white/50 py-2.5 pl-9 pr-3 text-sm text-[#2D3436] outline-none transition-all placeholder:text-[#B2BEC3] focus:border-[#74B9FF]/30 focus:bg-white/70"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#636E72]">
                <span>Showing {filteredTopics.length} of {topicBankTopics.length} topics</span>
                <span>Page {safeTopicPage} / {totalTopicBankPages}</span>
              </div>

              {topicBankLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-[#B2BEC3]" />
                </div>
              ) : topicBankError ? (
                <div className="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-600">
                  {topicBankError}
                </div>
              ) : pagedTopics.length === 0 ? (
                <div className="rounded-2xl bg-white/30 px-4 py-10 text-center">
                  <p className="text-sm text-[#636E72]">No topics matched your current filters.</p>
                </div>
              ) : (
                <ul className="grid gap-3 xl:grid-cols-2">
                  {pagedTopics.map(topic => (
                    <li key={topic.id || `${topic.task_type}-${topic.prompt}`}>
                      <button
                        onClick={() => handleOpenTopic(topic)}
                        className="w-full rounded-2xl border border-white/60 bg-white/35 p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white/55"
                      >
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="rounded-full bg-[#2D3436]/5 px-2.5 py-1 font-semibold text-[#2D3436]">
                            {topic.id || 'No ID'}
                          </span>
                          <span className="rounded-full bg-[#F7F6F2] px-2.5 py-1 text-[#636E72]">
                            {getTaskLabel(topic.task_type)}
                          </span>
                          <span className="rounded-full bg-[#F7F6F2] px-2.5 py-1 text-[#636E72]">
                            {getSubtypeLabel(topic)}
                          </span>
                          <span className="rounded-full bg-[#74B9FF]/10 px-2.5 py-1 text-[#74B9FF] capitalize">
                            {topic.difficulty || 'medium'}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-[13px] leading-relaxed text-[#2D3436]">
                          {topic.prompt}
                        </p>
                        {topic.topic_tags && topic.topic_tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {topic.topic_tags.slice(0, 3).map(tag => (
                              <span key={tag} className="rounded-full bg-[#F7F6F2] px-2 py-1 text-[10px] text-[#636E72]">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#74B9FF]">
                          <span>Practice this topic</span>
                          <ArrowRight size={13} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setTopicBrowserPage(page => Math.max(1, page - 1))}
                  disabled={safeTopicPage <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#636E72]/10 px-3 py-2 text-xs text-[#636E72] transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <button
                  onClick={() => setTopicBrowserPage(page => Math.min(totalTopicBankPages, page + 1))}
                  disabled={safeTopicPage >= totalTopicBankPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#636E72]/10 px-3 py-2 text-xs text-[#636E72] transition-all hover:bg-white/50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </GlassCard>
      </section>

      <section className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-[#636E72]">Recent Essays</h3>
          <Link
            to="/writing/history"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#74B9FF] transition-colors hover:text-[#2D3436]"
          >
            View All
            <ArrowRight size={13} />
          </Link>
        </div>
        <GlassCard className="overflow-hidden" hover>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-[#B2BEC3]" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <FileText size={28} className="text-[#B2BEC3]" />
              <p className="text-xs text-[#B2BEC3]">No writing records yet</p>
              <p className="text-[10px] text-[#B2BEC3]/70">Choose a mode above to start writing</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#636E72]/10">
              {sessions.map(item => (
                <li key={item.id}>
                  <Link
                    to={`/writing/report/${item.id}`}
                    className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-white/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[#2D3436]">
                        {item.task_type === 'part_a' ? 'Task 1' : 'Task 2'}: {item.topic.slice(0, 60)}
                        {item.topic.length > 60 ? '...' : ''}
                      </p>
                      <p className="text-xs text-[#636E72]">
                        {item.topic_id ? `${item.topic_id} · ` : ''}
                        {formatDate(item.created_at)}
                        {item.word_count > 0 ? ` · ${item.word_count} words` : ''}
                      </p>
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
