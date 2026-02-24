import { create } from 'zustand'
import {
  fetchReviewWords,
  fetchNewWords,
  fetchTodaySummary,
  submitReview,
  fetchVocabularyStats,
  resetVocabularyProgress,
  fetchVocabSettings,
  updateVocabSettings as apiUpdateVocabSettings,
  type VocabularyWord,
  type VocabularyStats,
  type TodaySummary,
  type VocabSettings,
  type WordOrder,
} from '@renderer/services/vocabulary'

interface VocabularyState {
  /* review session */
  words: VocabularyWord[]
  currentIndex: number
  totalDue: number
  loading: boolean
  error: string | null

  /* new words session */
  newWords: VocabularyWord[]

  /* stats & summary */
  stats: VocabularyStats | null
  todaySummary: TodaySummary | null
  vocabSettings: VocabSettings | null

  /* actions */
  loadReviewWords: (limit?: number) => Promise<void>
  loadNewWords: (limit?: number, order?: WordOrder) => Promise<void>
  loadTodaySummary: () => Promise<void>
  loadVocabSettings: () => Promise<void>
  updateVocabSettings: (settings: VocabSettings) => Promise<void>
  submitAnswer: (quality: 0 | 2 | 3 | 5) => Promise<void>
  loadStats: () => Promise<void>
  resetProgress: () => Promise<number>

  /* computed helpers */
  currentWord: () => VocabularyWord | null
  hasMore: () => boolean
}

export const useVocabularyStore = create<VocabularyState>((set, get) => ({
  words: [],
  currentIndex: 0,
  totalDue: 0,
  loading: false,
  error: null,
  newWords: [],
  stats: null,
  todaySummary: null,
  vocabSettings: null,

  loadReviewWords: async (limit = 20) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchReviewWords(limit)
      set({
        words: res.data.words,
        totalDue: res.data.total_due,
        currentIndex: 0,
        loading: false
      })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadNewWords: async (limit = 30, order?: WordOrder) => {
    set({ loading: true, error: null })
    try {
      const res = await fetchNewWords(limit, order)
      set({
        newWords: res.data.words,
        loading: false
      })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  loadTodaySummary: async () => {
    try {
      const res = await fetchTodaySummary()
      set({ todaySummary: res.data })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadVocabSettings: async () => {
    try {
      const res = await fetchVocabSettings()
      set({ vocabSettings: res.data })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  updateVocabSettings: async (settings: VocabSettings) => {
    try {
      const res = await apiUpdateVocabSettings(settings)
      set({ vocabSettings: res.data })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  submitAnswer: async (quality) => {
    const { words, currentIndex } = get()
    const word = words[currentIndex]
    if (!word) return

    try {
      await submitReview(word.id, quality)
      set({ currentIndex: currentIndex + 1 })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  loadStats: async () => {
    try {
      const res = await fetchVocabularyStats()
      set({ stats: res.data })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  resetProgress: async () => {
    try {
      const res = await resetVocabularyProgress()
      return res.data.reset_count
    } catch (e) {
      set({ error: (e as Error).message })
      return 0
    }
  },

  currentWord: () => {
    const { words, currentIndex } = get()
    return currentIndex < words.length ? words[currentIndex] : null
  },

  hasMore: () => {
    const { words, currentIndex } = get()
    return currentIndex < words.length
  }
}))
