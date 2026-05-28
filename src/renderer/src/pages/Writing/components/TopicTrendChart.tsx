import { useMemo } from 'react'
import type { TopicTrendPoint } from '../../../services/writing'

/**
 * Lightweight trend chart showing overall score progression for a single topic.
 * Uses SVG path + circles for minimal bundle impact.
 */
export function TopicTrendChart({ points }: { points: TopicTrendPoint[] }): JSX.Element {
  const validPoints = useMemo(
    () => points.filter(p => p.overall_score != null && p.overall_score > 0),
    [points],
  )

  if (validPoints.length === 0) {
    return <p className="text-xs text-[#B2BEC3] py-3 text-center">暂无分数数据</p>
  }

  const w = 280
  const h = 80
  const padX = 28
  const padY = 12
  const plotW = w - padX * 2
  const plotH = h - padY * 2

  const minScore = Math.min(...validPoints.map(p => p.overall_score!))
  const maxScore = Math.max(...validPoints.map(p => p.overall_score!))
  const range = maxScore - minScore || 1

  const coords = validPoints.map((p, i) => ({
    x: padX + (validPoints.length > 1 ? (i / (validPoints.length - 1)) * plotW : plotW / 2),
    y: padY + plotH - ((p.overall_score! - minScore) / range) * plotH,
    score: p.overall_score!,
    date: p.created_at.slice(0, 10),
  }))

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  // Color based on latest score
  const latestScore = coords[coords.length - 1].score
  const lineColor = latestScore >= 7 ? '#00B894' : latestScore >= 5.5 ? '#FDCB6E' : '#E17055'

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0, 0.5, 1].map(r => (
          <line
            key={r}
            x1={padX}
            y1={padY + plotH - r * plotH}
            x2={w - padX}
            y2={padY + plotH - r * plotH}
            stroke="rgba(0,0,0,0.04)"
            strokeWidth={0.5}
          />
        ))}

        {/* Y-axis labels */}
        <text x={padX - 4} y={padY + 3} textAnchor="end" className="text-[7px] fill-[#B2BEC3]">
          {maxScore}
        </text>
        <text x={padX - 4} y={padY + plotH + 3} textAnchor="end" className="text-[7px] fill-[#B2BEC3]">
          {minScore}
        </text>

        {/* Gradient fill under line */}
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {coords.length > 1 && (
          <path
            d={`${pathD} L ${coords[coords.length - 1].x} ${padY + plotH} L ${coords[0].x} ${padY + plotH} Z`}
            fill="url(#trendFill)"
          />
        )}

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {coords.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={3}
              fill="white"
              stroke={lineColor}
              strokeWidth={1.5}
            />
            {/* Score label */}
            <text
              x={c.x}
              y={c.y - 7}
              textAnchor="middle"
              className="text-[7px] font-semibold"
              fill={lineColor}
            >
              {c.score}
            </text>
          </g>
        ))}

        {/* X-axis date labels (first and last) */}
        {coords.length > 0 && (
          <>
            <text x={coords[0].x} y={h - 1} textAnchor="start" className="text-[7px] fill-[#B2BEC3]">
              {coords[0].date.slice(5)}
            </text>
            {coords.length > 1 && (
              <text x={coords[coords.length - 1].x} y={h - 1} textAnchor="end" className="text-[7px] fill-[#B2BEC3]">
                {coords[coords.length - 1].date.slice(5)}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  )
}
