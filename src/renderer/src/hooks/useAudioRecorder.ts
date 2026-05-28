import { useCallback, useEffect, useRef, useState } from 'react'

/* ---------- Types ---------- */

export interface UseAudioRecorderOptions {
  /** Recording mode: push-to-talk or voice activity detection */
  mode: 'ptt' | 'vad'
  /** VAD: volume threshold to start recording (0-255, default 30) */
  vadThreshold?: number
  /** VAD: silence duration in ms before stopping (default 1500) */
  vadSilenceTimeout?: number
  /** Callback when recording finishes with the audio blob */
  onRecordingComplete?: (blob: Blob, base64: string) => void
  /** Callback for real-time volume level (0-255) */
  onVolumeChange?: (volume: number) => void
  /** Callback for frequency data (for visualization) */
  onFrequencyData?: (data: Uint8Array) => void
}

export interface UseAudioRecorderReturn {
  isRecording: boolean
  /** Start recording (PTT mode) */
  startRecording: () => Promise<void>
  /** Stop recording (PTT mode) */
  stopRecording: () => void
  /** Current volume level (0-255) */
  volume: number
  /** Get the AnalyserNode for external visualization */
  analyserNode: AnalyserNode | null
  /** Cleanup all resources */
  cleanup: () => void
}

/* ---------- Helpers ---------- */

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return 'audio/webm'
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      // Strip data URL prefix: "data:audio/webm;base64,..."
      const base64 = dataUrl.split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/* ---------- Hook ---------- */

export function useAudioRecorder(options: UseAudioRecorderOptions): UseAudioRecorderReturn {
  const {
    mode,
    vadThreshold = 30,
    vadSilenceTimeout = 1500,
    onRecordingComplete,
    onVolumeChange,
    onFrequencyData,
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [volume, setVolume] = useState(0)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const vadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vadActiveRef = useRef(false)
  const isRecordingRef = useRef(false)

  // Refs for latest callbacks
  const onRecordingCompleteRef = useRef(onRecordingComplete)
  const onVolumeChangeRef = useRef(onVolumeChange)
  const onFrequencyDataRef = useRef(onFrequencyData)
  onRecordingCompleteRef.current = onRecordingComplete
  onVolumeChangeRef.current = onVolumeChange
  onFrequencyDataRef.current = onFrequencyData

  /** Initialize microphone stream and audio context */
  const initAudio = useCallback(async () => {
    if (streamRef.current) return

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    streamRef.current = stream

    const ctx = new AudioContext()
    audioContextRef.current = ctx

    const source = ctx.createMediaStreamSource(stream)
    sourceRef.current = source

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    source.connect(analyser)

    analyserRef.current = analyser
    setAnalyserNode(analyser)
  }, [])

  /** Start volume monitoring (for both PTT visualization and VAD detection) */
  const startMonitoring = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const freqArray = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteTimeDomainData(dataArray)
      analyser.getByteFrequencyData(freqArray)

      // Calculate volume as max deviation from 128 (silence)
      let maxVol = 0
      for (let i = 0; i < dataArray.length; i++) {
        const v = Math.abs(dataArray[i] - 128)
        if (v > maxVol) maxVol = v
      }
      // Scale to 0-255
      const vol = Math.min(255, maxVol * 2)

      setVolume(vol)
      onVolumeChangeRef.current?.(vol)
      onFrequencyDataRef.current?.(freqArray)

      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const stopMonitoring = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [])

  /** Start MediaRecorder */
  const doStartRecording = useCallback(() => {
    if (!streamRef.current || isRecordingRef.current) return

    chunksRef.current = []
    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(streamRef.current, { mimeType })

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      if (blob.size > 0) {
        const base64 = await blobToBase64(blob)
        onRecordingCompleteRef.current?.(blob, base64)
      }
      chunksRef.current = []
    }

    recorder.start()
    mediaRecorderRef.current = recorder
    isRecordingRef.current = true
    setIsRecording(true)
  }, [])

  /** Stop MediaRecorder */
  const doStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    isRecordingRef.current = false
    setIsRecording(false)
  }, [])

  /** PTT: start */
  const startRecording = useCallback(async () => {
    await initAudio()
    startMonitoring()
    doStartRecording()
  }, [initAudio, startMonitoring, doStartRecording])

  /** PTT: stop */
  const stopRecording = useCallback(() => {
    doStopRecording()
    // Keep monitoring running for visualization in PTT mode
  }, [doStopRecording])

  /** VAD logic: continuously monitor volume and auto-start/stop */
  useEffect(() => {
    if (mode !== 'vad') return

    let mounted = true

    const setupVAD = async () => {
      await initAudio()
      if (!mounted) return
      startMonitoring()
    }

    setupVAD()

    return () => {
      mounted = false
    }
  }, [mode, initAudio, startMonitoring])

  // VAD volume watching
  useEffect(() => {
    if (mode !== 'vad') return

    if (volume > vadThreshold) {
      // Voice detected
      if (vadTimerRef.current) {
        clearTimeout(vadTimerRef.current)
        vadTimerRef.current = null
      }
      if (!vadActiveRef.current) {
        vadActiveRef.current = true
        doStartRecording()
      }
    } else if (vadActiveRef.current && !vadTimerRef.current) {
      // Silence detected, start timeout
      vadTimerRef.current = setTimeout(() => {
        vadActiveRef.current = false
        vadTimerRef.current = null
        doStopRecording()
      }, vadSilenceTimeout)
    }
  }, [mode, volume, vadThreshold, vadSilenceTimeout, doStartRecording, doStopRecording])

  /** Cleanup all resources */
  const cleanup = useCallback(() => {
    stopMonitoring()
    doStopRecording()

    if (vadTimerRef.current) {
      clearTimeout(vadTimerRef.current)
      vadTimerRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    analyserRef.current = null
    setAnalyserNode(null)
    setVolume(0)
    vadActiveRef.current = false
  }, [stopMonitoring, doStopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording,
    volume,
    analyserNode,
    cleanup,
  }
}
