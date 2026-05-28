/* ===== Vocabulary API Service ===== */

const getBaseUrl = async (): Promise<string> => {
  // In Electron mode, get the backend URL from the main process
  if (window.electronAPI?.getBackendInfo) {
    const info = await window.electronAPI.getBackendInfo()
    if (info?.baseUrl) return info.baseUrl
  }
  // Browser preview mode: use same-origin and rely on Vite /api proxy
  return ''
}

/* ---------- Types ---------- */

export interface VocabularyWord {
  id: number
  word: string
  phonetic: string
  definition: string
  translation: string
  full_translation: string
  pos: string
  example: string
  interval: number
  repetition: number
  ease_factor: number
  status: 'new' | 'learning' | 'mastered'
  difficulty: number
  next_review: string | null
  bookmarked?: boolean
  note?: string
  wrong_count?: number
}

export interface ReviewListResponse {
  success: boolean
  data: { total_due: number; words: VocabularyWord[] }
  message: string
}

export interface ReviewResultResponse {
  success: boolean
  data: {
    word_id: number
    new_interval: number
    new_repetition: number
    new_ease_factor: number
    next_review: string
    status: string
  }
  message: string
}

export interface VocabularyStats {
  total_words: number
  new_words: number
  learning_words: number
  mastered_words: number
  due_today: number
  streak_days: number
}

export interface StatsResponse {
  success: boolean
  data: VocabularyStats
  message: string
}

export interface TodaySummary {
  due_review: number
  new_words_learned_today: number
  daily_new_words_limit: number
  new_words_remaining: number
  total_new_words: number
}

export interface TodaySummaryResponse {
  success: boolean
  data: TodaySummary
  message: string
}

export interface NewWordsListResponse {
  success: boolean
  data: { words: VocabularyWord[]; today_learned: number; daily_limit: number; order: string }
  message: string
}

export type WordOrder = 'random' | 'ielts_core' | 'difficulty_asc' | 'difficulty_desc' | 'alphabetical'

export const WORD_ORDER_OPTIONS: { value: WordOrder; label: string; desc: string }[] = [
  { value: 'random', label: 'Random', desc: 'Shuffle words randomly' },
  { value: 'ielts_core', label: 'IELTS Core First', desc: 'Difficulty order: 3 → 4 → 2 → 5 → 1' },
  { value: 'difficulty_asc', label: 'Easy to Hard', desc: 'Start from simpler words' },
  { value: 'difficulty_desc', label: 'Hard to Easy', desc: 'Start from more difficult words' },
  { value: 'alphabetical', label: 'Alphabetical', desc: 'Sorted from A to Z' },
]

export interface VocabSettings {
  daily_new_words_limit: number
  word_order?: WordOrder
}

export interface VocabSettingsResponse {
  success: boolean
  data: VocabSettings
  message: string
}

export interface DistractorsResponse {
  success: boolean
  data: { distractors: string[] }
  message: string
}

/* ---------- API calls ---------- */

export const fetchReviewWords = async (limit = 20): Promise<ReviewListResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/review?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to fetch review words: ${res.status}`)
  return (await res.json()) as ReviewListResponse
}

export const fetchNewWords = async (limit = 30, order?: WordOrder): Promise<NewWordsListResponse> => {
  const baseUrl = await getBaseUrl()
  const params = new URLSearchParams({ limit: String(limit) })
  if (order) params.set('order', order)
  const res = await fetch(`${baseUrl}/api/vocabulary/new-words?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch new words: ${res.status}`)
  return (await res.json()) as NewWordsListResponse
}

export const fetchTodaySummary = async (): Promise<TodaySummaryResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/today-summary`)
  if (!res.ok) throw new Error(`Failed to fetch today summary: ${res.status}`)
  return (await res.json()) as TodaySummaryResponse
}

export type LearningMode = 'review' | 'learn_quiz' | 'spelling' | 'dictation'

export const submitReview = async (
  wordId: number,
  quality: 0 | 2 | 3 | 5,
  mode: LearningMode = 'review'
): Promise<ReviewResultResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/${wordId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quality, mode })
  })
  if (!res.ok) throw new Error(`Failed to submit review: ${res.status}`)
  return (await res.json()) as ReviewResultResponse
}

export const fetchVocabularyStats = async (): Promise<StatsResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/stats`)
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`)
  return (await res.json()) as StatsResponse
}

export const resetVocabularyProgress = async (): Promise<{ success: boolean; data: { reset_count: number } }> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to reset progress: ${res.status}`)
  return await res.json()
}

export const fetchDistractors = async (
  wordId: number,
  count = 3,
  mode: 'translation' | 'word' = 'translation'
): Promise<DistractorsResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/${wordId}/distractors?count=${count}&mode=${mode}`)
  if (!res.ok) throw new Error(`Failed to fetch distractors: ${res.status}`)
  return await res.json()
}

export const fetchVocabSettings = async (): Promise<VocabSettingsResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/settings/vocabulary`)
  if (!res.ok) throw new Error(`Failed to fetch vocab settings: ${res.status}`)
  return (await res.json()) as VocabSettingsResponse
}

export const updateVocabSettings = async (settings: VocabSettings): Promise<VocabSettingsResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/settings/vocabulary`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  })
  if (!res.ok) throw new Error(`Failed to update vocab settings: ${res.status}`)
  return (await res.json()) as VocabSettingsResponse
}

/* ---------- Heatmap ---------- */

export interface HeatmapPoint {
  date: string
  count: number
}

export interface HeatmapResponse {
  success: boolean
  data: { year: number; data: HeatmapPoint[] }
  message: string
}

export const fetchHeatmap = async (year?: number): Promise<HeatmapResponse> => {
  const baseUrl = await getBaseUrl()
  const params = year ? `?year=${year}` : ''
  const res = await fetch(`${baseUrl}/api/vocabulary/heatmap${params}`)
  if (!res.ok) throw new Error(`Failed to fetch heatmap: ${res.status}`)
  return (await res.json()) as HeatmapResponse
}

/* ---------- Learning Curve ---------- */

export interface LearningCurveResponse {
  success: boolean
  data: { dates: string[]; mastered: number[]; learning: number[] }
  message: string
}

export const fetchLearningCurve = async (days = 30): Promise<LearningCurveResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/learning-curve?days=${days}`)
  if (!res.ok) throw new Error(`Failed to fetch learning curve: ${res.status}`)
  return (await res.json()) as LearningCurveResponse
}

/* ---------- Bookmark / Note ---------- */

export const toggleBookmark = async (wordId: number, bookmarked: boolean) => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/${wordId}/bookmark`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookmarked })
  })
  if (!res.ok) throw new Error(`Failed to toggle bookmark: ${res.status}`)
  return await res.json()
}

export const updateWordNote = async (wordId: number, note: string) => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/${wordId}/note`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note })
  })
  if (!res.ok) throw new Error(`Failed to update note: ${res.status}`)
  return await res.json()
}

export interface BookmarkedWordsResponse {
  success: boolean
  data: { total: number; words: VocabularyWord[] }
  message: string
}

export const fetchBookmarkedWords = async (page = 1, pageSize = 50): Promise<BookmarkedWordsResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/bookmarks?page=${page}&page_size=${pageSize}`)
  if (!res.ok) throw new Error(`Failed to fetch bookmarks: ${res.status}`)
  return (await res.json()) as BookmarkedWordsResponse
}

/* ---------- Most Wrong ---------- */

export interface MostWrongWord {
  id: number
  word: string
  translation: string
  definition?: string
  phonetic: string
  pos: string
  wrong_count: number
  difficulty: number
  status: string
  bookmarked: boolean
  note: string
}

export interface MostWrongWordsResponse {
  success: boolean
  data: { words: MostWrongWord[] }
  message: string
}

export const fetchMostWrongWords = async (limit = 20): Promise<MostWrongWordsResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/most-wrong?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to fetch most wrong words: ${res.status}`)
  return (await res.json()) as MostWrongWordsResponse
}

/* ---------- Activity Trend ---------- */

export interface ActivityTrendPoint {
  date: string
  total: number
  review: number
  learn_quiz: number
  spelling: number
  dictation: number
}

export interface ActivityTrendResponse {
  success: boolean
  data: { days: number; data: ActivityTrendPoint[] }
  message: string
}

export const fetchActivityTrend = async (days = 14): Promise<ActivityTrendResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/activity-trend?days=${days}`)
  if (!res.ok) throw new Error(`Failed to fetch activity trend: ${res.status}`)
  return (await res.json()) as ActivityTrendResponse
}
