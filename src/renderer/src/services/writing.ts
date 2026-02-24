/* ===== Writing API Service ===== */

const getBaseUrl = async (): Promise<string> => {
  if (window.electronAPI?.getBackendInfo) {
    const info = await window.electronAPI.getBackendInfo()
    if (info?.baseUrl) return info.baseUrl
  }
  return 'http://localhost:8000'
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
}

export interface TopicData {
  task_type: 'part_a' | 'part_b'
  prompt: string
  chart_type?: 'bar' | 'line' | 'pie'
  chart_data?: ChartData
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
  topic: string
  overall_score: number | null
  created_at: string
}

export interface SessionDetailData {
  session_id: number
  task_type: string
  topic: string
  topic_data: Record<string, unknown> | null
  user_essay: string
  word_count: number
  scores: WritingScores | null
  agent_reports: Record<string, AgentReport>
  report_markdown: string
  created_at: string
}

/* ---------- API Functions ---------- */

export async function generateTopic(taskType: 'part_a' | 'part_b') {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/writing/generate-topic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_type: taskType }),
  })
  if (!res.ok) throw new Error(`Generate topic failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: TopicData; message: string }
}

export async function evaluateEssay(params: {
  session_id?: number | null
  task_type: string
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
) {
  const base = await getBaseUrl()
  const params = new URLSearchParams({
    task_type: taskType,
    page: String(page),
    page_size: String(pageSize),
  })
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
