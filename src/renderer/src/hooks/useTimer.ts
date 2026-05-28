import { useCallback, useEffect, useRef, useState } from 'react'
import type { WarningLevel } from '@renderer/services/speaking'

/* ---------- Types ---------- */

export interface TimerState {
  elapsed: number
  total: number
  warningLevel: WarningLevel
  isRunning: boolean
}

export interface UseTimerOptions {
  /** Total duration in seconds (e.g. 60 for prep, 130 for speaking) */
  total: number
  /** Warning thresholds in seconds (ascending) */
  warningThresholds?: {
    yellow?: number
    orange?: number
    red?: number
  }
  /** Callback when timer completes (elapsed >= total) */
  onComplete?: () => void
  /** Callback on each tick */
  onTick?: (state: TimerState) => void
  /** Auto-start on mount (default false) */
  autoStart?: boolean
}

export interface UseTimerReturn {
  /** Current timer state */
  state: TimerState
  /** Start the timer */
  start: () => void
  /** Pause the timer */
  pause: () => void
  /** Reset the timer */
  reset: (newTotal?: number) => void
  /** Sync with backend timer push (server is authoritative) */
  sync: (elapsed: number, total: number, warningLevel: WarningLevel) => void
  /** Remaining seconds */
  remaining: number
  /** Progress ratio 0-1 */
  progress: number
}

/* ---------- Helpers ---------- */

function calcWarningLevel(
  elapsed: number,
  thresholds?: { yellow?: number; orange?: number; red?: number }
): WarningLevel {
  if (!thresholds) return 'none'
  if (thresholds.red !== undefined && elapsed >= thresholds.red) return 'red'
  if (thresholds.orange !== undefined && elapsed >= thresholds.orange) return 'orange'
  if (thresholds.yellow !== undefined && elapsed >= thresholds.yellow) return 'yellow'
  return 'none'
}

/* ---------- Hook ---------- */

export function useTimer(options: UseTimerOptions): UseTimerReturn {
  const { total, warningThresholds, onComplete, onTick, autoStart = false } = options

  const [state, setState] = useState<TimerState>({
    elapsed: 0,
    total,
    warningLevel: 'none',
    isRunning: false,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onTickRef = useRef(onTick)
  const completedRef = useRef(false)
  onCompleteRef.current = onComplete
  onTickRef.current = onTick

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    clearTimer()
    completedRef.current = false

    setState((prev) => ({ ...prev, isRunning: true }))

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (!prev.isRunning) return prev

        const newElapsed = prev.elapsed + 1
        const newWarning = calcWarningLevel(newElapsed, warningThresholds)
        const newState = {
          ...prev,
          elapsed: newElapsed,
          warningLevel: newWarning,
        }

        onTickRef.current?.(newState)

        if (newElapsed >= prev.total && !completedRef.current) {
          completedRef.current = true
          // Use setTimeout to avoid calling setState during setState
          setTimeout(() => onCompleteRef.current?.(), 0)
        }

        return newState
      })
    }, 1000)
  }, [clearTimer, warningThresholds])

  const pause = useCallback(() => {
    clearTimer()
    setState((prev) => ({ ...prev, isRunning: false }))
  }, [clearTimer])

  const reset = useCallback(
    (newTotal?: number) => {
      clearTimer()
      completedRef.current = false
      setState({
        elapsed: 0,
        total: newTotal ?? total,
        warningLevel: 'none',
        isRunning: false,
      })
    },
    [clearTimer, total]
  )

  /** Sync with authoritative backend timer data */
  const sync = useCallback(
    (elapsed: number, syncTotal: number, warningLevel: WarningLevel) => {
      setState((prev) => ({
        ...prev,
        elapsed,
        total: syncTotal,
        warningLevel,
      }))
    },
    []
  )

  // Auto-start
  useEffect(() => {
    if (autoStart) start()
    return () => clearTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  // Update total if option changes
  useEffect(() => {
    setState((prev) => ({ ...prev, total }))
  }, [total])

  const remaining = Math.max(0, state.total - state.elapsed)
  const progress = state.total > 0 ? Math.min(1, state.elapsed / state.total) : 0

  return {
    state,
    start,
    pause,
    reset,
    sync,
    remaining,
    progress,
  }
}
