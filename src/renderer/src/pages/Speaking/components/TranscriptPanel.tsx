import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '@renderer/services/speaking'

interface TranscriptPanelProps {
  transcript: TranscriptEntry[]
  className?: string
  /** Max height before scroll (default '320px') */
  maxHeight?: string
}

function formatTime(isoOrNull: string | null): string {
  if (!isoOrNull) return ''
  const d = new Date(isoOrNull)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TranscriptPanel({
  transcript,
  className = '',
  maxHeight = '320px',
}: TranscriptPanelProps): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript.length])

  if (transcript.length === 0) {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        <p className="text-sm text-[#B2BEC3]">Start speaking to begin the conversation...</p>
      </div>
    )
  }

  return (
    <div
      className={`overflow-y-auto scrollbar-hide ${className}`}
      style={{ maxHeight }}
    >
      <div className="space-y-3 px-1 py-2">
        {transcript.map((entry, index) => {
          const isExaminer = entry.role === 'examiner'
          return (
            <div
              key={index}
              className={`flex ${isExaminer ? 'justify-start' : 'justify-end'} animate-fade-in`}
              style={{ animationDelay: '0s', animationDuration: '0.3s' }}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isExaminer
                    ? 'rounded-tl-md bg-white/50 backdrop-blur-sm border border-white/40'
                    : 'rounded-tr-md bg-[#A78BFA]/12 border border-[#A78BFA]/15'
                }`}
              >
                {/* Role label */}
                <p className={`text-[10px] font-medium mb-1 ${
                  isExaminer ? 'text-[#636E72]' : 'text-[#A78BFA]'
                }`}>
                  {isExaminer ? 'Examiner' : 'You'}
                </p>

                {/* Message text */}
                <p className="text-[13px] leading-relaxed text-[#2D3436]">
                  {entry.content}
                </p>

                {/* Timestamp */}
                {entry.created_at && (
                  <p className="mt-1 text-[9px] text-[#B2BEC3]">
                    {formatTime(entry.created_at)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
