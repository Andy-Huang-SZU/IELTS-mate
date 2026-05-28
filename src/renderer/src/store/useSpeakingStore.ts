import { create } from 'zustand'
import type {
  SpeakingMode,
  SpeakingPhase,
  InputMode,
  WarningLevel,
  TopicCardData,
  TranscriptEntry,
} from '@renderer/services/speaking'

/* ---------- Types ---------- */

export interface TimerState {
  elapsed: number
  total: number
  warningLevel: WarningLevel
}

export interface SpeakingState {
  /* connection */
  connected: boolean
  sessionId: number | null
  mode: SpeakingMode
  inputMode: InputMode

  /* phase */
  phase: SpeakingPhase

  /* audio */
  isRecording: boolean
  isAISpeaking: boolean

  /* transcript */
  transcript: TranscriptEntry[]

  /* mock test specifics */
  timer: TimerState | null
  topicCard: TopicCardData | null

  /* errors */
  error: string | null

  /* actions */
  setConnected: (connected: boolean) => void
  setSessionId: (id: number | null) => void
  setMode: (mode: SpeakingMode) => void
  setInputMode: (inputMode: InputMode) => void
  setPhase: (phase: SpeakingPhase) => void
  setRecording: (isRecording: boolean) => void
  setAISpeaking: (isAISpeaking: boolean) => void
  addTranscript: (entry: TranscriptEntry) => void
  setTimer: (timer: TimerState | null) => void
  setTopicCard: (card: TopicCardData | null) => void
  setError: (error: string | null) => void
  reset: () => void
}

/* ---------- Initial State ---------- */

const initialState = {
  connected: false,
  sessionId: null,
  mode: 'chat' as SpeakingMode,
  inputMode: 'ptt' as InputMode,
  phase: 'idle' as SpeakingPhase,
  isRecording: false,
  isAISpeaking: false,
  transcript: [] as TranscriptEntry[],
  timer: null as TimerState | null,
  topicCard: null as TopicCardData | null,
  error: null as string | null,
}

/* ---------- Store ---------- */

export const useSpeakingStore = create<SpeakingState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setSessionId: (sessionId) => set({ sessionId }),
  setMode: (mode) => set({ mode }),
  setInputMode: (inputMode) => set({ inputMode }),
  setPhase: (phase) => set({ phase }),
  setRecording: (isRecording) => set({ isRecording }),
  setAISpeaking: (isAISpeaking) => set({ isAISpeaking }),

  addTranscript: (entry) =>
    set((state) => ({ transcript: [...state.transcript, entry] })),

  setTimer: (timer) => set({ timer }),
  setTopicCard: (topicCard) => set({ topicCard }),
  setError: (error) => set({ error }),

  reset: () => set(initialState),
}))
