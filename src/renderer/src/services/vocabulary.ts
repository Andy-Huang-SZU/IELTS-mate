/* ===== Vocabulary API Service ===== */

const getBaseUrl = async (): Promise<string> => {
  const info = await window.electronAPI.getBackendInfo()
  if (!info.baseUrl) throw new Error('Backend is not ready')
  return info.baseUrl
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
  data: { words: VocabularyWord[]; today_learned: number; daily_limit: number }
  message: string
}

export interface VocabSettings {
  daily_new_words_limit: number
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

export const fetchNewWords = async (limit = 30): Promise<NewWordsListResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/new-words?limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to fetch new words: ${res.status}`)
  return (await res.json()) as NewWordsListResponse
}

export const fetchTodaySummary = async (): Promise<TodaySummaryResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/today-summary`)
  if (!res.ok) throw new Error(`Failed to fetch today summary: ${res.status}`)
  return (await res.json()) as TodaySummaryResponse
}

export const submitReview = async (
  wordId: number,
  quality: 0 | 2 | 3 | 5
): Promise<ReviewResultResponse> => {
  const baseUrl = await getBaseUrl()
  const res = await fetch(`${baseUrl}/api/vocabulary/${wordId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quality })
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
