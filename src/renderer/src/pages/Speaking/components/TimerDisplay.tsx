import type { WarningLevel } from '@renderer/services/speaking'

interface TimerDisplayProps {
  /** Elapsed seconds */
  elapsed: number
  /** Total duration in seconds */
  total: number
  /** Warning level from backend / local timer */
  warningLevel: WarningLevel
  /** Label text (e.g. "Preparation" or "Speaking") */
  label?: string
  /** Size of the ring (default 120) */
  size?: number
}

/* ── Warning level → colour ── */
const WARNING_COLORS: Record<WarningLevel, { ring: string; text: string; bg: string; glow: string }> = {
  none: {
    ring: '#00B894',
    text: '#2D3436',
    bg: 'rgba(0, 184, 148, 0.08)',
    glow: 'rgba(0, 184, 148, 0.15)',
  },
  yellow: {
    ring: '#FDCB6E',
    text: '#2D3436',
    bg: 'rgba(253, 203, 110, 0.10)',
    glow: 'rgba(253, 203, 110, 0.20)',
  },
  orange: {
    ring: '#E17055',
    text: '#E17055',
    bg: 'rgba(225, 112, 85, 0.10)',
    glow: 'rgba(225, 112, 85, 0.25)',
  },
  red: {
    ring: '#FF6B6B',
    text: '#FF6B6B',
    bg: 'rgba(255, 107, 107, 0.12)',
    glow: 'rgba(255, 107, 107, 0.30)',
  },
}

function formatSeconds(s: number): string {
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function TimerDisplay({
  elapsed,
  total,
  warningLevel,
  label = 'Time',
  size = 120,
}: TimerDisplayProps): JSX.Element {
  const remaining = Math.max(0, total - elapsed)
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0
  const colors = WARNING_COLORS[warningLevel]

  // SVG ring maths
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const isFlashing = warningLevel === 'red' || warningLevel === 'orange'

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl p-4 transition-all duration-500 ${
        isFlashing ? 'animate-timer-flash' : ''
      }`}
      style={{ backgroundColor: colors.bg }}
    >
      {/* Label */}
      {label && (
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#636E72]">
          {label}
        </p>
      )}

      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow effect */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-500"
          style={{
            boxShadow: `0 0 ${warningLevel === 'none' ? '15' : '25'}px ${colors.glow}`,
          }}
        />

        <svg
          className="-rotate-90"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(203, 213, 225, 0.3)"
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.ring}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-serif text-2xl font-bold tabular-nums transition-colors duration-500"
            style={{ color: colors.text }}
          >
            {formatSeconds(remaining)}
          </span>
        </div>
      </div>

      {/* Progress bar text */}
      <p className="text-[10px] text-[#B2BEC3]">
        {formatSeconds(elapsed)} / {formatSeconds(total)}
      </p>

      {/* Flash animation */}
      <style>{`
        @keyframes timerFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .animate-timer-flash {
          animation: timerFlash 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
