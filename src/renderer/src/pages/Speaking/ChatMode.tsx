import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react'
import { PageContainer } from '../../components/flux'
import { useSpeakingStore } from '../../store/useSpeakingStore'
import { getSpeakingWsUrl } from '../../services/speaking'
import type { WSServerMessage, TranscriptEntry, InputMode } from '../../services/speaking'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { AudioVisualizer } from './components/AudioVisualizer'
import { MicButton } from './components/MicButton'
import { TranscriptPanel } from './components/TranscriptPanel'

export function ChatMode(): JSX.Element {
  const navigate = useNavigate()
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const store = useSpeakingStore()

  // Resolve WS URL once
  useEffect(() => {
    getSpeakingWsUrl().then(setWsUrl)
  }, [])

  const handleMessage = useCallback((msg: WSServerMessage) => {
    // Backend sends flat messages (no "payload" wrapper), so read fields
    // from either msg.payload or the message root for compatibility.
    const p = msg.payload ?? (msg as unknown as Record<string, unknown>)
    switch (msg.type) {
      case 'connected':
        store.setConnected(true)
        store.setSessionId((p.session_id as number) ?? null)
        break
      case 'transcription':
        store.addTranscript({
          role: 'candidate',
          content: (p.text as string) ?? '',
          phase: '',
          created_at: new Date().toISOString(),
        })
        break
      case 'ai_text':
        store.setAISpeaking(true)
        store.addTranscript({
          role: 'examiner',
          content: (p.text as string) ?? '',
          phase: (p.phase as string) || '',
          created_at: new Date().toISOString(),
        })
        break
      case 'ai_audio':
        playAudio((p.data as string) ?? '', (p.format as string) || 'mp3')
        break
      case 'state_change':
        if (p.phase) store.setPhase(p.phase as string as typeof store.phase)
        break
      case 'session_ended':
        store.setPhase('completed')
        store.setAISpeaking(false)
        break
      case 'error':
        store.setError((p.message as string) ?? 'Unknown error')
        break
    }
  }, [store])

  const handleOpen = useCallback(() => {
    store.setConnected(true)
  }, [store])

  const handleClose = useCallback(() => {
    store.setConnected(false)
    store.setAISpeaking(false)
  }, [store])

  const { status, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    onOpen: handleOpen,
    onClose: handleClose,
  })

  // Audio recorder
  const handleRecordingComplete = useCallback(
    (_blob: Blob, base64: string) => {
      send({
        type: 'audio_chunk',
        payload: { data: base64, format: 'webm' },
      })
      send({ type: 'end_turn' })
      store.setRecording(false)
    },
    [send, store]
  )

  const recorder = useAudioRecorder({
    mode: store.inputMode,
    onRecordingComplete: handleRecordingComplete,
    vadThreshold: 30,
    vadSilenceTimeout: 1500,
  })

  // Start session when connected
  const [sessionStarted, setSessionStarted] = useState(false)
  useEffect(() => {
    if (status === 'connected' && !sessionStarted) {
      send({
        type: 'start_session',
        payload: { mode: 'chat', input_mode: store.inputMode },
      })
      setSessionStarted(true)
    }
  }, [status, sessionStarted, send, store.inputMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recorder.cleanup()
      // Stop any playing audio and clear queue
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      audioQueueRef.current = []
      isPlayingRef.current = false
      store.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Audio playback for AI speech — queued to prevent overlapping playback ("炸麦")
  const audioQueueRef = useRef<Array<{ base64: string; format: string }>>([])
  const isPlayingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const processAudioQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    const { base64, format } = audioQueueRef.current.shift()!
    isPlayingRef.current = true

    const byteChars = atob(base64)
    const byteArr = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) {
      byteArr[i] = byteChars.charCodeAt(i)
    }
    const blob = new Blob([byteArr], { type: `audio/${format}` })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentAudioRef.current = audio

    audio.onended = () => {
      URL.revokeObjectURL(url)
      currentAudioRef.current = null
      isPlayingRef.current = false
      if (audioQueueRef.current.length > 0) {
        processAudioQueue()
      } else {
        store.setAISpeaking(false)
      }
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      currentAudioRef.current = null
      isPlayingRef.current = false
      if (audioQueueRef.current.length > 0) {
        processAudioQueue()
      } else {
        store.setAISpeaking(false)
      }
    }
    audio.play().catch((err) => {
      console.error('Audio playback failed:', err)
      isPlayingRef.current = false
      currentAudioRef.current = null
      if (audioQueueRef.current.length > 0) {
        processAudioQueue()
      } else {
        store.setAISpeaking(false)
      }
    })
  }, [store])

  const playAudio = useCallback((base64: string, format: string) => {
    audioQueueRef.current.push({ base64, format })
    processAudioQueue()
  }, [processAudioQueue])

  const toggleInputMode = useCallback(() => {
    const next: InputMode = store.inputMode === 'ptt' ? 'vad' : 'ptt'
    store.setInputMode(next)
  }, [store])

  const handleMicPress = useCallback(async () => {
    if (store.inputMode === 'ptt') {
      store.setRecording(true)
      await recorder.startRecording()
    }
  }, [store, recorder])

  const handleMicRelease = useCallback(() => {
    if (store.inputMode === 'ptt' && recorder.isRecording) {
      recorder.stopRecording()
    }
  }, [store, recorder])

  // Determine mic button state
  const micState = store.isAISpeaking
    ? 'ai-speaking' as const
    : status !== 'connected'
      ? 'disabled' as const
      : recorder.isRecording
        ? 'recording' as const
        : 'idle' as const

  const statusText = store.isAISpeaking
    ? 'AI is speaking...'
    : recorder.isRecording
      ? 'Listening...'
      : status === 'connected'
        ? store.inputMode === 'ptt'
          ? 'Hold to speak'
          : 'Speak now (VAD active)'
        : 'Connecting...'

  // Visualizer state
  const vizState = store.isAISpeaking ? 'ai-speaking' as const : recorder.isRecording ? 'recording' as const : 'idle' as const

  return (
    <PageContainer>
      <h1 className="sr-only">Speaking Free Chat</h1>

      {/* Top nav */}
      <header className="mb-4 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/speaking')}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 transition-all hover:bg-white/70 hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={18} className="text-[#2D3436]" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-semibold text-[#2D3436]">Free Chat</h2>
            <p className="text-[10px] text-[#636E72]">Practice your English freely</p>
          </div>
        </div>

        {/* PTT/VAD Toggle */}
        <button
          onClick={toggleInputMode}
          className="flex items-center gap-2 rounded-xl bg-white/50 px-3 py-2 text-[11px] font-medium text-[#636E72] backdrop-blur-sm border border-white/40 transition-all hover:bg-white/70"
        >
          {store.inputMode === 'ptt' ? (
            <>
              <ToggleLeft size={18} className="text-[#636E72]" />
              Push to Talk
            </>
          ) : (
            <>
              <ToggleRight size={18} className="text-[#00B894]" />
              <span className="text-[#00B894]">Voice Activity</span>
            </>
          )}
        </button>
      </header>

      {/* Connection indicator */}
      {status !== 'connected' && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-[#FDCB6E]/10 px-4 py-2 animate-fade-in">
          <span className="h-2 w-2 rounded-full bg-[#FDCB6E] animate-pulse" />
          <span className="text-xs text-[#636E72]">
            {status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      )}

      {/* Error banner */}
      {store.error && (
        <div className="mb-4 rounded-xl bg-[#E17055]/10 px-4 py-2 text-xs text-[#E17055] animate-fade-in">
          {store.error}
          <button onClick={() => store.setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Central visualizer */}
      <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.05s' }}>
        <AudioVisualizer
          analyserNode={recorder.analyserNode}
          state={vizState}
          size={220}
        />
      </div>

      {/* Transcript */}
      <div className="mt-2 animate-fade-in" style={{ animationDelay: '0.08s' }}>
        <TranscriptPanel
          transcript={store.transcript}
          maxHeight="280px"
        />
      </div>

      {/* Bottom mic control */}
      <div className="mt-4 flex justify-center animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <MicButton
          state={micState}
          onPress={handleMicPress}
          onRelease={handleMicRelease}
          size={72}
          statusText={statusText}
        />
      </div>

      <div className="h-20" />
    </PageContainer>
  )
}
