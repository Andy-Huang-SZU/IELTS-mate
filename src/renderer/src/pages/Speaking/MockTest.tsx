import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { PageContainer } from '../../components/flux'
import { useSpeakingStore } from '../../store/useSpeakingStore'
import { getSpeakingWsUrl } from '../../services/speaking'
import type { WSServerMessage, SpeakingPhase, TopicCardData } from '../../services/speaking'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useAudioRecorder } from '../../hooks/useAudioRecorder'
import { useTimer } from '../../hooks/useTimer'
import { AudioVisualizer } from './components/AudioVisualizer'
import { MicButton } from './components/MicButton'
import { TranscriptPanel } from './components/TranscriptPanel'
import { TimerDisplay } from './components/TimerDisplay'
import { TopicCard } from './components/TopicCard'

/* ── Phase label mapping ── */
const PHASE_LABELS: Record<string, string> = {
  idle: 'Preparing...',
  part1_intro: 'Part 1 · Introduction',
  part1_qa: 'Part 1 · Interview',
  part2_prep: 'Part 2 · Preparation',
  part2_speak: 'Part 2 · Long Turn',
  part3_discussion: 'Part 3 · Discussion',
  report_generating: 'Generating Report...',
  completed: 'Completed',
}

/* ── Phase progress (0-1) for top progress bar ── */
const PHASE_PROGRESS: Record<string, number> = {
  idle: 0,
  part1_intro: 0.1,
  part1_qa: 0.25,
  part2_prep: 0.4,
  part2_speak: 0.6,
  part3_discussion: 0.8,
  report_generating: 0.95,
  completed: 1.0,
}

export function MockTest(): JSX.Element {
  const navigate = useNavigate()
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const store = useSpeakingStore()

  // Resolve WS URL once
  useEffect(() => {
    getSpeakingWsUrl().then(setWsUrl)
  }, [])

  // Part 2 timers
  const prepTimer = useTimer({
    total: 60,
    onComplete: () => {
      // Backend will also trigger state change
    },
  })

  const speakTimer = useTimer({
    total: 130,
    warningThresholds: { yellow: 90, orange: 110, red: 120 },
  })

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
          phase: store.phase,
          created_at: new Date().toISOString(),
        })
        break
      case 'ai_text':
        store.setAISpeaking(true)
        store.addTranscript({
          role: 'examiner',
          content: (p.text as string) ?? '',
          phase: (p.phase as string) || store.phase,
          created_at: new Date().toISOString(),
        })
        break
      case 'ai_audio':
        playAudio((p.data as string) ?? '', (p.format as string) || 'mp3')
        break
      case 'state_change': {
        const newPhase = p.phase as SpeakingPhase
        store.setPhase(newPhase)

        // Handle timer transitions
        if (newPhase === 'part2_prep') {
          prepTimer.reset(60)
          prepTimer.start()
        } else if (newPhase === 'part2_speak') {
          prepTimer.pause()
          speakTimer.reset(130)
          speakTimer.start()
        } else if (newPhase === 'part3_discussion') {
          speakTimer.pause()
        } else if (newPhase === 'report_generating') {
          speakTimer.pause()
        } else if (newPhase === 'completed') {
          // Navigate to report
          if (store.sessionId) {
            navigate(`/speaking/report/${store.sessionId}`)
          }
        }
        break
      }
      case 'timer':
        // Sync local timer with backend
        if (store.phase === 'part2_prep') {
          prepTimer.sync(
            p.elapsed as number,
            p.total as number,
            (p.warning_level as 'none') || 'none'
          )
        } else if (store.phase === 'part2_speak') {
          speakTimer.sync(
            p.elapsed as number,
            p.total as number,
            (p.warning_level as 'none' | 'yellow' | 'orange' | 'red') || 'none'
          )
        }
        break
      case 'topic_card':
        store.setTopicCard(p as unknown as TopicCardData)
        break
      case 'session_ended':
        store.setPhase('completed')
        store.setAISpeaking(false)
        if (store.sessionId) {
          navigate(`/speaking/report/${store.sessionId}`)
        }
        break
      case 'error':
        store.setError(p.message as string)
        break
    }
  }, [store, prepTimer, speakTimer, navigate])

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
    mode: 'ptt',
    onRecordingComplete: handleRecordingComplete,
  })

  // Start session
  const [sessionStarted, setSessionStarted] = useState(false)
  useEffect(() => {
    if (status === 'connected' && !sessionStarted) {
      send({
        type: 'start_session',
        payload: { mode: 'mock_test', input_mode: 'ptt' },
      })
      setSessionStarted(true)
    }
  }, [status, sessionStarted, send])

  // Cleanup
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

  // Audio playback — queued to prevent overlapping playback ("炸麦")
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

  const handleMicPress = useCallback(async () => {
    store.setRecording(true)
    await recorder.startRecording()
  }, [store, recorder])

  const handleMicRelease = useCallback(() => {
    if (recorder.isRecording) {
      recorder.stopRecording()
    }
  }, [recorder])

  // Determine states
  const isPrepPhase = store.phase === 'part2_prep'
  const isSpeakPhase = store.phase === 'part2_speak'
  const isReportGenerating = store.phase === 'report_generating'

  const canSpeak =
    status === 'connected' &&
    !store.isAISpeaking &&
    !isPrepPhase &&
    !isReportGenerating &&
    store.phase !== 'completed' &&
    store.phase !== 'idle'

  const micState = store.isAISpeaking
    ? 'ai-speaking' as const
    : !canSpeak
      ? 'disabled' as const
      : recorder.isRecording
        ? 'recording' as const
        : 'idle' as const

  const vizState = store.isAISpeaking
    ? 'ai-speaking' as const
    : recorder.isRecording
      ? 'recording' as const
      : 'idle' as const

  const statusText = isReportGenerating
    ? ''
    : store.isAISpeaking
      ? 'Examiner is speaking...'
      : recorder.isRecording
        ? 'Listening...'
        : isPrepPhase
          ? 'Prepare your answer...'
          : canSpeak
            ? 'Hold to speak'
            : status !== 'connected'
              ? 'Connecting...'
              : 'Waiting...'

  const progressWidth = PHASE_PROGRESS[store.phase] || 0

  return (
    <PageContainer>
      <h1 className="sr-only">Speaking Mock Test</h1>

      {/* Top status bar */}
      <header className="mb-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/speaking')}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/50 backdrop-blur-sm border border-white/40 transition-all hover:bg-white/70 hover:scale-105 active:scale-95"
            >
              <ArrowLeft size={18} className="text-[#2D3436]" />
            </button>
            <div>
              <h2 className="font-serif text-lg font-semibold text-[#2D3436]">
                {PHASE_LABELS[store.phase] || 'Mock Test'}
              </h2>
            </div>
          </div>

          {/* Phase badge */}
          <span className="rounded-full bg-[#A78BFA]/10 px-3 py-1 text-[11px] font-medium text-[#A78BFA]">
            {store.phase.includes('part1')
              ? 'Part 1'
              : store.phase.includes('part2')
                ? 'Part 2'
                : store.phase.includes('part3')
                  ? 'Part 3'
                  : '—'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-[#DFE6E9]/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#A78BFA] to-[#00CEC9] transition-all duration-1000"
            style={{ width: `${progressWidth * 100}%` }}
          />
        </div>
      </header>

      {/* Connection / Error indicators */}
      {status !== 'connected' && (
        <div className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-[#FDCB6E]/10 px-4 py-2 animate-fade-in">
          <span className="h-2 w-2 rounded-full bg-[#FDCB6E] animate-pulse" />
          <span className="text-xs text-[#636E72]">{status === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
        </div>
      )}
      {store.error && (
        <div className="mb-3 rounded-xl bg-[#E17055]/10 px-4 py-2 text-xs text-[#E17055] animate-fade-in">
          {store.error}
          <button onClick={() => store.setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* ── Report generating state ── */}
      {isReportGenerating && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 animate-fade-in">
          <div className="flex items-center gap-2">
            <Loader2 size={24} className="animate-spin text-[#A78BFA]" />
          </div>
          <p className="font-serif text-xl font-semibold text-[#2D3436]">Generating your report...</p>
          <p className="text-sm text-[#636E72]">Our AI examiners are evaluating your performance</p>
          <div className="flex gap-1.5 mt-2">
            <span className="h-2 w-2 rounded-full bg-[#A78BFA] animate-pulse" style={{ animationDelay: '0s' }} />
            <span className="h-2 w-2 rounded-full bg-[#A78BFA] animate-pulse" style={{ animationDelay: '0.3s' }} />
            <span className="h-2 w-2 rounded-full bg-[#A78BFA] animate-pulse" style={{ animationDelay: '0.6s' }} />
          </div>
        </div>
      )}

      {/* ── Part 2 Prep view ── */}
      {isPrepPhase && !isReportGenerating && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-center">
            <TimerDisplay
              elapsed={prepTimer.state.elapsed}
              total={prepTimer.state.total}
              warningLevel={prepTimer.state.warningLevel}
              label="Preparation Time"
              size={110}
            />
          </div>
          {store.topicCard && (
            <TopicCard topicCard={store.topicCard} />
          )}
        </div>
      )}

      {/* ── Normal speaking view (Part 1, Part 2 speak, Part 3) ── */}
      {!isPrepPhase && !isReportGenerating && store.phase !== 'completed' && (
        <div className="space-y-2">
          {/* Part 2 speak: show compact topic + timer */}
          {isSpeakPhase && (
            <div className="flex items-center gap-3 animate-fade-in">
              {store.topicCard && (
                <div className="flex-1">
                  <TopicCard topicCard={store.topicCard} compact />
                </div>
              )}
              <TimerDisplay
                elapsed={speakTimer.state.elapsed}
                total={speakTimer.state.total}
                warningLevel={speakTimer.state.warningLevel}
                label="Speaking"
                size={90}
              />
            </div>
          )}

          {/* Visualizer */}
          <div className="flex justify-center animate-fade-in" style={{ animationDelay: '0.03s' }}>
            <AudioVisualizer
              analyserNode={recorder.analyserNode}
              state={vizState}
              size={isSpeakPhase ? 180 : 200}
            />
          </div>

          {/* Transcript */}
          <div className="animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <TranscriptPanel
              transcript={store.transcript}
              maxHeight={isSpeakPhase ? '200px' : '260px'}
            />
          </div>

          {/* Mic button */}
          <div className="flex justify-center pt-2 animate-fade-in" style={{ animationDelay: '0.07s' }}>
            <MicButton
              state={micState}
              onPress={handleMicPress}
              onRelease={handleMicRelease}
              size={68}
              statusText={statusText}
            />
          </div>
        </div>
      )}

      <div className="h-20" />
    </PageContainer>
  )
}
