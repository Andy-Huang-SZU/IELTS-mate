/* ===== Speaking API Service ===== */

const getBaseUrl = async (): Promise<string> => {
  if (window.electronAPI?.getBackendInfo) {
    const info = await window.electronAPI.getBackendInfo()
    if (info?.baseUrl) return info.baseUrl
  }
  return ''
}

/* ---------- Types ---------- */

export interface SpeakingScores {
  fc: number
  lr: number
  gra: number
  pronunciation: number
  overall: number
}

export interface SpeakingAgentReport {
  criterion: string
  score: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

export interface TopicCardData {
  topic: string
  bullet_points: string[]
  follow_up: string
}

export interface TranscriptEntry {
  role: 'examiner' | 'candidate'
  content: string
  phase: string
  created_at: string | null
}

export interface SessionListItem {
  id: number
  mode: string
  status: string
  topic_summary: string | null
  overall_score: number | null
  scores: SpeakingScores | null
  duration_seconds: number
  created_at: string
}

export interface SessionDetailData {
  session_id: number
  mode: string
  status: string
  topic_card: TopicCardData | null
  topic_summary: string | null
  overall_score: number | null
  scores: SpeakingScores | null
  agent_reports: Record<string, SpeakingAgentReport>
  report_markdown: string
  transcript: TranscriptEntry[]
  duration_seconds: number
  created_at: string
}

/* ---------- WebSocket Message Types ---------- */

export type SpeakingMode = 'chat' | 'mock_test'
export type InputMode = 'ptt' | 'vad'
export type SpeakingPhase =
  | 'idle'
  | 'part1_intro'
  | 'part1_qa'
  | 'part2_prep'
  | 'part2_speak'
  | 'part3_discussion'
  | 'report_generating'
  | 'completed'

export type WarningLevel = 'none' | 'yellow' | 'orange' | 'red'

/** Server → Client message */
export interface WSServerMessage {
  type:
    | 'connected'
    | 'pong'
    | 'transcription'
    | 'ai_text'
    | 'ai_audio'
    | 'state_change'
    | 'timer'
    | 'topic_card'
    | 'error'
    | 'session_ended'
  payload: Record<string, unknown>
}

/** Client → Server message */
export interface WSClientMessage {
  type: 'start_session' | 'audio_chunk' | 'end_turn' | 'stop_session' | 'ping'
  payload?: Record<string, unknown>
}

/* ---------- API Functions ---------- */

export async function fetchSpeakingSessions(
  mode = 'all',
  page = 1,
  pageSize = 20
) {
  const base = await getBaseUrl()
  const params = new URLSearchParams({
    mode,
    page: String(page),
    page_size: String(pageSize),
  })
  const res = await fetch(`${base}/api/speaking/sessions?${params}`)
  if (!res.ok) throw new Error(`Fetch speaking sessions failed: ${res.status}`)
  const json = await res.json()
  return json as {
    success: boolean
    data: { total: number; sessions: SessionListItem[] }
    message: string
  }
}

export async function fetchSpeakingSessionDetail(sessionId: number) {
  const base = await getBaseUrl()
  const res = await fetch(`${base}/api/speaking/sessions/${sessionId}`)
  if (!res.ok) throw new Error(`Fetch speaking session detail failed: ${res.status}`)
  const json = await res.json()
  return json as { success: boolean; data: SessionDetailData; message: string }
}

/** Build the WebSocket URL for speaking module */
export async function getSpeakingWsUrl(): Promise<string> {
  const base = await getBaseUrl()
  // Convert http(s) to ws(s)
  if (base) {
    const wsBase = base.replace(/^http/, 'ws')
    return `${wsBase}/api/speaking/ws`
  }
  // Browser dev mode: use current host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/speaking/ws`
}
