import { Mic, Square, Volume2 } from 'lucide-react'

interface MicButtonProps {
  /** Current state of the mic button */
  state: 'idle' | 'recording' | 'ai-speaking' | 'disabled'
  /** Press handler — behaviour depends on PTT/VAD mode */
  onPress?: () => void
  /** Release handler — for PTT mode */
  onRelease?: () => void
  /** Button size (default 72) */
  size?: number
  /** Status text shown above the button */
  statusText?: string
}

export function MicButton({
  state,
  onPress,
  onRelease,
  size = 72,
  statusText,
}: MicButtonProps): JSX.Element {
  const isDisabled = state === 'disabled' || state === 'ai-speaking'
  const isRecording = state === 'recording'

  const iconSize = size * 0.38

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Status text */}
      {statusText && (
        <p className={`text-xs font-medium tracking-wide transition-colors duration-300 ${
          isRecording ? 'text-[#E17055]' :
          state === 'ai-speaking' ? 'text-[#00CEC9]' :
          'text-[#636E72]'
        }`}>
          {statusText}
        </p>
      )}

      {/* Button */}
      <div className="relative">
        {/* Pulsing ring when recording */}
        {isRecording && (
          <>
            <span
              className="absolute inset-0 rounded-full"
              style={{
                animation: 'micPulse 1.5s ease-out infinite',
                border: '2px solid rgba(225, 112, 85, 0.4)',
              }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{
                animation: 'micPulse 1.5s ease-out infinite 0.5s',
                border: '2px solid rgba(225, 112, 85, 0.25)',
              }}
            />
          </>
        )}

        {/* AI speaking ripple */}
        {state === 'ai-speaking' && (
          <>
            <span
              className="absolute inset-0 rounded-full"
              style={{
                animation: 'micPulse 2s ease-out infinite',
                border: '2px solid rgba(0, 206, 201, 0.3)',
              }}
            />
          </>
        )}

        <button
          onMouseDown={!isDisabled ? onPress : undefined}
          onMouseUp={!isDisabled && isRecording ? onRelease : undefined}
          onMouseLeave={!isDisabled && isRecording ? onRelease : undefined}
          onTouchStart={!isDisabled ? onPress : undefined}
          onTouchEnd={!isDisabled && isRecording ? onRelease : undefined}
          disabled={isDisabled}
          className={`relative flex items-center justify-center rounded-full transition-all duration-300 select-none ${
            isRecording
              ? 'bg-gradient-to-br from-[#E17055] to-[#E17055]/80 shadow-xl shadow-[#E17055]/30 scale-105'
              : state === 'ai-speaking'
                ? 'bg-gradient-to-br from-[#00CEC9]/30 to-[#5EEAD4]/20 shadow-lg shadow-[#00CEC9]/15 cursor-default'
                : state === 'disabled'
                  ? 'bg-[#DFE6E9]/60 cursor-not-allowed'
                  : 'bg-white/50 shadow-lg shadow-black/5 hover:bg-white/70 hover:shadow-xl hover:scale-[1.04] active:scale-95 backdrop-blur-sm border border-white/60'
          }`}
          style={{ width: size, height: size }}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? (
            <Square size={iconSize * 0.7} className="text-white" fill="white" />
          ) : state === 'ai-speaking' ? (
            <Volume2 size={iconSize} className="text-[#00CEC9]" strokeWidth={1.5} />
          ) : (
            <Mic
              size={iconSize}
              className={state === 'disabled' ? 'text-[#B2BEC3]' : 'text-[#2D3436]'}
              strokeWidth={1.5}
            />
          )}
        </button>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes micPulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
