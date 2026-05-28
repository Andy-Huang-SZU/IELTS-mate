import { useEffect, useRef, useCallback } from 'react'

interface AudioVisualizerProps {
  /** AnalyserNode from useAudioRecorder for live frequency data */
  analyserNode: AnalyserNode | null
  /** Current visual state — drives colour scheme */
  state: 'idle' | 'recording' | 'ai-speaking'
  /** CSS class for the canvas wrapper */
  className?: string
  /** Canvas size (defaults to 240) */
  size?: number
}

/* ── Colour palettes per state ── */
const PALETTES = {
  idle: {
    primary: 'rgba(167, 139, 250, 0.25)',   // muted lavender
    secondary: 'rgba(167, 139, 250, 0.10)',
    glow: 'rgba(167, 139, 250, 0.08)',
  },
  recording: {
    primary: 'rgba(225, 112, 85, 0.85)',     // warm coral
    secondary: 'rgba(253, 203, 110, 0.55)',
    glow: 'rgba(225, 112, 85, 0.20)',
  },
  'ai-speaking': {
    primary: 'rgba(0, 206, 201, 0.80)',      // teal / cyan
    secondary: 'rgba(94, 234, 212, 0.50)',
    glow: 'rgba(0, 206, 201, 0.18)',
  },
}

export function AudioVisualizer({
  analyserNode,
  state,
  className = '',
  size = 240,
}: AudioVisualizerProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number | null>(null)

  /** Draw one frame */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const palette = PALETTES[state]
    const centerX = w / 2
    const centerY = h / 2
    const baseRadius = Math.min(w, h) * 0.28

    // Get frequency data (or synthesise gentle noise for idle)
    let freqData: Uint8Array
    if (analyserNode) {
      freqData = new Uint8Array(analyserNode.frequencyBinCount)
      analyserNode.getByteFrequencyData(freqData)
    } else {
      // Generate gentle idle ripple
      freqData = new Uint8Array(64)
      const t = Date.now() / 1000
      for (let i = 0; i < 64; i++) {
        freqData[i] = 8 + Math.sin(t * 1.2 + i * 0.3) * 6
      }
    }

    // Outer glow
    const glowGrad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.6, centerX, centerY, baseRadius * 1.8)
    glowGrad.addColorStop(0, palette.glow)
    glowGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 0, w, h)

    // Draw circular waveform
    const bars = Math.min(freqData.length, 64)
    const angleStep = (Math.PI * 2) / bars

    // Two layers: outer (primary) + inner (secondary)
    for (let layer = 0; layer < 2; layer++) {
      const color = layer === 0 ? palette.primary : palette.secondary
      const radiusMultiplier = layer === 0 ? 1.0 : 0.65
      const barWidthMultiplier = layer === 0 ? 1.0 : 0.6

      ctx.strokeStyle = color
      ctx.lineWidth = 2.5 * barWidthMultiplier
      ctx.lineCap = 'round'

      ctx.beginPath()
      for (let i = 0; i < bars; i++) {
        const amplitude = (freqData[i] / 255) * baseRadius * 0.6 * radiusMultiplier
        const angle = i * angleStep - Math.PI / 2

        const innerR = baseRadius * radiusMultiplier
        const outerR = innerR + amplitude

        const x1 = centerX + Math.cos(angle) * innerR
        const y1 = centerY + Math.sin(angle) * innerR
        const x2 = centerX + Math.cos(angle) * outerR
        const y2 = centerY + Math.sin(angle) * outerR

        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
      }
      ctx.stroke()
    }

    // Centre circle
    const centreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.3)
    centreGrad.addColorStop(0, palette.secondary)
    centreGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = centreGrad
    ctx.beginPath()
    ctx.arc(centerX, centerY, baseRadius * 0.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    animFrameRef.current = requestAnimationFrame(draw)
  }, [analyserNode, state])

  /** Setup canvas DPR + animation loop */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    animFrameRef.current = requestAnimationFrame(draw)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [size, draw])

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none"
        style={{ width: size, height: size }}
      />
    </div>
  )
}
