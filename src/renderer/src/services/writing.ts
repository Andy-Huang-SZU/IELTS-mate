/* ===== Writing API Service ===== */

const getBaseUrl = async (): Promise<string> => {
  if (window.electronAPI?.getBackendInfo) {
    const info = await window.electronAPI.getBackendInfo()
    if (info?.baseUrl) return info.baseUrl
  }
  // Browser preview mode: use same-origin and rely on Vite /api proxy
  return ''
}

/* ---------- Types ---------- */

export interface ChartSeries {
  name: string
  data: number[]
}

export interface ChartData {
  title: string
  categories: string[]
  series: ChartSeries[]
  unit: string
  // Table-specific
  columns?: string[]
  rows?: (string | number)[][]
  // Combination-specific (legacy, kept for backward compat)
  bar_series?: ChartSeries[]
  line_series?: ChartSeries[]
  bar_unit?: string
  line_unit?: string
  // Process-specific
  mermaid_code?: string
  steps?: string[]
  // Map-specific — two maps for before/after comparison
  maps?: MapView[]
  // Mixed-specific — two independent sub-charts
  sub_charts?: SubChart[]
}

export interface MapFeature {
  type: 'building' | 'road' | 'river' | 'park' | 'lake' | 'area' | 'label'
  id: string
  label?: string
  x?: number
  y?: number
  width?: number
  height?: number
  points?: [number, number][]
  style?: string
}

export interface MapView {
  label: string
  width: number
  height: number
  features: MapFeature[]
}

export interface SubChart {
  chart_type: 'bar' | 'line' | 'pie' | 'table'
  chart_data: ChartData
}

export interface TopicData {
  id?: string
  legacy_id?: string | null
  task_type: 'part_a' | 'part_b'
  prompt: string
  chart_type?: 'bar' | 'line' | 'pie' | 'table' | 'map' | 'mixed' | 'combination' | 'process'
  chart_data?: ChartData
  question_type?: 'opinion' | 'discussion' | 'problem_solution' | 'two_part' | 'advantage_disadvantage'
  topic_tags?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  source?: 'generated' | 'manual' | 'bank'
}

export interface TokenUsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface DetailedAnnotation {
  text: string
  issue: string
  suggestion: string
}

export interface AgentReport {
  criterion: string
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  detailed_annotations: DetailedAnnotation[]
}

export interface WritingScores {
  tr: number
  cc: number
  lr: number
  gra: number
  overall: number
}

export interface EvaluateData {
  session_id: number
  scores: WritingScores
  agent_reports: Record<string, AgentReport>
  report_markdown: string
}

export interface SessionListItem {
  id: number
  task_type: string
  topic_id: string | null
  topic: string
  topic_data: TopicData | null
  word_count: number
  overall_score: number | null
  scores: WritingScores | null
  created_at: string
}

export interface RewriteSuggestion {
  text: string
  source: 'chief' | 'agent'
  dimension?: string
}

export interface StructuredReport {
  summary_title: string
  summary_paragraphs: string[]
  model_answer_title: string
  model_answer_paragraphs: string[]
  rewrite_title: string
  rewrite_suggestions: RewriteSuggestion[]
  has_model_answer: boolean
  has_rewrite_suggestions: boolean
}

export interface SessionDetailData {
  session_id: number
  task_type: string
  topic_id: string | null
  topic: string
  topic_data: Record<string, unknown> | null
  user_essay: string
  word_count: number
  scores: WritingScores | null
  agent_reports: Record<string, AgentReport>
  report_markdown: string
  structured_report: StructuredReport | null
  created_at: string
}

export interface TopicEstimateData extends TokenUsageInfo {
  estimated_cost?: number
  cost_currency?: string
}

export interface TopicBankListData {
  total: number
  topics: TopicData[]
}

/* ---------- API Functions ---------- */

export async function generateTopic(params: {
  task_type: 'part_a' | 'part_b'
  chart_type?: string
  question_type?: string
  theme?: string
}) {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/generate-topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`Generate topic failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: TopicData; usage?: TokenUsageInfo; message: string }
}

export async function randomTopic(params?: {
  task_type?: string
  chart_type?: string
  question_type?: string
}) {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/random-topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {}),
  })
  if (!res.ok) throw new Error(`Random topic failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: TopicData; message: string }
}

export async function fetchTopicBank(params?: {
  task_type?: string
  chart_type?: string
  question_type?: string
  difficulty?: string
}) {
  const base = await getBaseUrl()
  const query = new URLSearchParams()
  if (params?.task_type) query.set('task_type', params.task_type)
  if (params?.chart_type) query.set('chart_type', params.chart_type)
  if (params?.question_type) query.set('question_type', params.question_type)
  if (params?.difficulty) query.set('difficulty', params.difficulty)
  const qs = query.toString()
  const res = await fetch(`${base}/api/writing/topic-bank${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`Fetch topic bank failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: TopicBankListData; message: string }
}

export async function topicEstimate(params: {
  task_type: string
  chart_type?: string
  question_type?: string
  count?: number
}) {
  const base = await getBaseUrl()
  const qs = new URLSearchParams({ task_type: params.task_type })
  if (params.chart_type) qs.set('chart_type', params.chart_type)
  if (params.question_type) qs.set('question_type', params.question_type)
  if (params.count) qs.set('count', String(params.count))
  const res = await fetch(`${base}/api/writing/topic-estimate?${qs}`)
  if (!res.ok) throw new Error(`Topic estimate failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: TopicEstimateData; message: string }
}

export async function topicBankStats() {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/topic-bank-stats`)
  if (!res.ok) throw new Error(`Topic bank stats failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: { total: number; breakdown: Record<string, number> }; message: string }
}

export async function evaluateEssay(params: {
  session_id?: number | null
  task_type: string
  topic_id?: string | null
  topic: string
  topic_data?: Record<string, unknown> | null
  user_essay: string
}) {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: params.session_id ?? null,
      task_type: params.task_type,
      topic_id: params.topic_id ?? null,
      topic: params.topic,
      topic_data: params.topic_data ?? null,
      user_essay: params.user_essay,
    }),
  })
  if (!res.ok) throw new Error(`Evaluate failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: EvaluateData; message: string }
}

export async function fetchWritingSessions(
  taskType = 'all',
  page = 1,
  pageSize = 20,
  topicId?: string,
  sortBy: 'latest' | 'score_desc' | 'score_asc' = 'latest',
) {
  const base = await getBaseUrl()
  const params = new URLSearchParams({
    task_type: taskType,
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
  })
  if (topicId) params.set('topic_id', topicId)
  const res = await fetch(`${base}/api/writing/sessions?${params}`)
  if (!res.ok) throw new Error(`Fetch sessions failed: ${res.status}`)
  const json = await res.json()
  return json as {
    success: boolean
    data: { total: number; sessions: SessionListItem[] }
    message: string
  }
}

export async function fetchSessionDetail(sessionId: number) {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/sessions/${sessionId}`)
  if (!res.ok) throw new Error(`Fetch session detail failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: SessionDetailData; message: string }
}

/* ---------- Topic Aggregation ---------- */

export interface TopicAggregateItem {
  topic_id: string
  task_type: string
  topic: string
  topic_data: TopicData | null
  attempts: number
  avg_score: number | null
  best_score: number | null
  latest_score: number | null
  latest_at: string | null
}

export async function fetchTopicAggregates(
  taskType = 'all',
  page = 1,
  pageSize = 20,
  sortBy: 'latest' | 'attempts_desc' | 'best_score_desc' = 'latest',
) {
  const base = await getBaseUrl()
  const params = new URLSearchParams({
    task_type: taskType,
    page: String(page),
    page_size: String(pageSize),
    sort_by: sortBy,
  })
  const res = await fetch(`${base}/api/writing/topics/aggregate?${params}`)
  if (!res.ok) throw new Error(`Fetch topic aggregates failed: ${res.status}`)
  const json = await res.json()
  return json as {
    success: boolean
    data: { total: number; topics: TopicAggregateItem[] }
    message: string
  }
}

/* ---------- Topic Trend ---------- */

export interface TopicTrendPoint {
  session_id: number
  overall_score: number | null
  scores: WritingScores | null
  word_count: number
  created_at: string
}

export async function fetchTopicTrend(topicId: string) {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/topics/${encodeURIComponent(topicId)}/trend`)
  if (!res.ok) throw new Error(`Fetch topic trend failed: ${res.status}`)
  const json = await res.json()
  return json as {
    success: boolean
    data: { topic_id: string; attempts: TopicTrendPoint[] }
    message: string
  }
}
