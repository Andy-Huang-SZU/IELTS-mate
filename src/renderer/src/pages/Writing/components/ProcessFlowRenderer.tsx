import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChartData } from '../../../services/writing'

/** Color palette for step badges — cycles through Flux Academy accent colors */
const STEP_COLORS = [
  '#5EEAD4', // Teal
  '#74B9FF', // Blue
  '#FDCB6E', // Gold
  '#E17055', // Coral
  '#A78BFA', // Lavender
  '#00B894', // Green
]

/** Minimum width (px) for each step card — used to compute items per row */
const NODE_MIN_WIDTH = 150
/** Maximum items per row */
const MAX_PER_ROW = 5
/** Minimum items per row */
const MIN_PER_ROW = 2

/**
 * ProcessFlowRenderer — renders process diagram steps as a responsive
 * snake-flow layout using pure HTML/CSS/React. Replaces MermaidRenderer.
 *
 * Layout:
 *   Row 0 (L→R):  [1] → [2] → [3] → [4]
 *                                      ↓
 *   Row 1 (R→L):  [8] ← [7] ← [6] ← [5]
 *                   ↓
 *   Row 2 (L→R):  [9] → [10] → [11] → [12]
 */
export function ProcessFlowRenderer({ chartData }: { chartData: ChartData }) {
  const steps = chartData.steps
  const containerRef = useRef<HTMLDivElement>(null)
  const [perRow, setPerRow] = useState(4)

  // Responsive: compute items per row based on container width
  const updatePerRow = useCallback(() => {
    if (!containerRef.current) return
    const width = containerRef.current.offsetWidth
    const computed = Math.floor(width / NODE_MIN_WIDTH)
    setPerRow(Math.max(MIN_PER_ROW, Math.min(MAX_PER_ROW, computed)))
  }, [])

  useEffect(() => {
    updatePerRow()
    const ro = new ResizeObserver(updatePerRow)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [updatePerRow])

  if (!steps?.length) {
    return (
      <div className="mt-4 text-center text-sm text-[#B2BEC3]">
        No process steps available.
      </div>
    )
  }

  // Split steps into rows
  const rows: string[][] = []
  for (let i = 0; i < steps.length; i += perRow) {
    rows.push(steps.slice(i, i + perRow))
  }

  return (
    <div className="mt-4">
      {chartData.title && (
        <p className="text-xs text-[#636E72] mb-3 text-center font-medium">
          {chartData.title}
        </p>
      )}
      <div
        ref={containerRef}
        className="bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-white/60"
        style={{
          boxShadow:
            '0 4px 6px -1px rgba(0,0,0,0.02), 0 20px 40px -8px rgba(0,0,0,0.04)',
        }}
      >
        {rows.map((row, rowIdx) => {
          const isReversed = rowIdx % 2 === 1
          // For display: reversed rows show items right-to-left
          const displayRow = isReversed ? [...row].reverse() : row

          // Global step index for each item in this display row
          const getGlobalIdx = (localIdx: number) => {
            const base = rowIdx * perRow
            return isReversed ? base + (row.length - 1 - localIdx) : base + localIdx
          }

          return (
            <div key={rowIdx}>
              {/* Step cards row */}
              <div
                className="flex items-stretch"
                style={{
                  flexDirection: 'row',
                }}
              >
                {displayRow.map((step, localIdx) => {
                  const globalIdx = getGlobalIdx(localIdx)
                  const color = STEP_COLORS[globalIdx % STEP_COLORS.length]
                  const isLast = globalIdx === steps.length - 1
                  const isLastInRow = localIdx === displayRow.length - 1

                  return (
                    <div
                      key={globalIdx}
                      className="flex items-center"
                      style={{ flex: '1 1 0%', minWidth: 0 }}
                    >
                      {/* Step card */}
                      <div
                        className="flex items-start gap-2 px-2.5 py-2 rounded-xl transition-colors duration-200 hover:bg-white/60"
                        style={{ flex: '1 1 0%', minWidth: 0 }}
                      >
                        {/* Step number badge */}
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 2px 8px ${color}40`,
                          }}
                        >
                          {globalIdx + 1}
                        </div>
                        {/* Step text */}
                        <p className="text-[12px] leading-snug text-[#2D3436]/85 pt-0.5">
                          {step}
                        </p>
                      </div>

                      {/* Horizontal arrow (between cards in same row) */}
                      {!isLastInRow && !isLast && (
                        <div className="flex items-center shrink-0 px-0.5">
                          <ArrowIcon direction={isReversed ? 'left' : 'right'} />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Invisible spacers for short last rows to keep card widths consistent */}
                {row.length < perRow &&
                  Array.from({ length: perRow - row.length }).map((_, i) => (
                    <div key={`spacer-${i}`} style={{ flex: '1 1 0%', minWidth: 0 }} />
                  ))}
              </div>

              {/* Vertical connector to next row */}
              {rowIdx < rows.length - 1 && (
                <VerticalConnector
                  alignRight={!isReversed}
                  perRow={perRow}
                  rowLength={row.length}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Directional arrow SVG — right or left */
function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const isLeft = direction === 'left'
  return (
    <svg
      width="16"
      height="10"
      viewBox="0 0 16 10"
      fill="none"
      className="shrink-0"
      style={isLeft ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M1 5h12.5M11 1.5L14.5 5 11 8.5"
        stroke="#B2BEC3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Vertical down-arrow connector between rows.
 * Aligns to the right edge (after L→R row) or left edge (after R→L row).
 */
function VerticalConnector({
  alignRight,
  perRow,
  rowLength,
}: {
  alignRight: boolean
  perRow: number
  rowLength: number
}) {
  // Calculate percentage position: center of the last card in the row
  // Each card takes 1/perRow of width. For L→R row, last card is at position (rowLength-1).
  // For R→L row, the visual last card (lowest global idx) is at the left edge.
  let positionFraction: number
  if (alignRight) {
    // After L→R row: arrow under the last card (rightmost)
    positionFraction = (rowLength - 0.5) / perRow
  } else {
    // After R→L row: arrow under the first displayed card (leftmost = highest global idx)
    positionFraction = 0.5 / perRow
  }

  return (
    <div
      className="relative"
      style={{
        height: 24,
      }}
    >
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        className="absolute"
        style={{
          left: `calc(${positionFraction * 100}% - 10px)`,
          top: 0,
        }}
      >
        <path
          d="M10 2v16M6 14l4 4 4-4"
          stroke="#B2BEC3"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
