import { GlassCard } from '../../../components/flux'
import type { TopicCardData } from '@renderer/services/speaking'

interface TopicCardProps {
  topicCard: TopicCardData
  /** Compact mode — used when topic is pinned at top during speaking */
  compact?: boolean
  className?: string
}

export function TopicCard({
  topicCard,
  compact = false,
  className = '',
}: TopicCardProps): JSX.Element {
  if (compact) {
    return (
      <div
        className={`rounded-xl border border-[#A78BFA]/15 bg-[#A78BFA]/5 px-4 py-2.5 backdrop-blur-sm ${className}`}
      >
        <p className="text-[11px] font-medium text-[#A78BFA]">Topic Card</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[#2D3436] line-clamp-2">
          {topicCard.topic}
        </p>
      </div>
    )
  }

  return (
    <GlassCard className={`p-6 ${className}`} hover>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#A78BFA]/15">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#2D3436]">Part 2 · Topic Card</p>
      </div>

      {/* Topic text */}
      <p className="text-sm leading-relaxed text-[#2D3436]">
        {topicCard.topic}
      </p>

      {/* Bullet points */}
      {topicCard.bullet_points.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#636E72]">
            You should say:
          </p>
          <ul className="space-y-1.5">
            {topicCard.bullet_points.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[13px] leading-relaxed text-[#636E72]"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A78BFA]/40" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-up */}
      {topicCard.follow_up && (
        <div className="mt-4 rounded-xl bg-[#A78BFA]/5 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[#A78BFA]">
            And explain:
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#2D3436]">
            {topicCard.follow_up}
          </p>
        </div>
      )}
    </GlassCard>
  )
}
