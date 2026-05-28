import { useEffect, useRef, useState } from 'react'
import type { ChartData } from '../../../services/writing'

// Unique ID counter to avoid Mermaid render ID collisions
let mermaidIdCounter = 0

/**
 * Convert top-down (TD/TB) Mermaid graphs to left-right (LR) layout
 * for better horizontal space usage in the UI panel.
 */
function optimiseMermaidLayout(code: string): string {
  // Replace graph TD / graph TB → graph LR (case-insensitive for the keyword part)
  return code.replace(/^(graph\s+)(TD|TB)\b/im, '$1LR')
}

export function MermaidRenderer({ chartData }: { chartData: ChartData }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mermaidWrapperRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rendered, setRendered] = useState(false)

  const mermaidCode = chartData.mermaid_code
  const steps = chartData.steps

  useEffect(() => {
    if (!mermaidCode || !containerRef.current) return

    let cancelled = false

    // Create or clear an isolated wrapper div that React doesn't manage
    if (!mermaidWrapperRef.current) {
      mermaidWrapperRef.current = document.createElement('div')
      containerRef.current.appendChild(mermaidWrapperRef.current)
    }
    const wrapper = mermaidWrapperRef.current

    const renderMermaid = async () => {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          primaryColor: '#5EEAD4',
          primaryTextColor: '#2D3436',
          primaryBorderColor: '#00B894',
          lineColor: '#636E72',
          secondaryColor: '#74B9FF',
          tertiaryColor: '#F7F6F2',
          fontSize: '12px',
        },
      })

      // Optimise layout: convert TD → LR for better horizontal fit
      const optimisedCode = optimiseMermaidLayout(mermaidCode)

      // Validate first
      const isValid = await mermaid.parse(optimisedCode).catch(() => false)
      if (cancelled) return

      if (!isValid) {
        setError('Invalid Mermaid syntax')
        return
      }

      const renderId = `mermaid-diagram-${++mermaidIdCounter}`
      const { svg } = await mermaid.render(renderId, optimisedCode)
      if (cancelled) return

      // Write to our isolated wrapper, not directly to React-managed DOM
      wrapper.innerHTML = svg

      // Post-process SVG to make it responsive — set width to 100% and preserve aspect ratio
      const svgEl = wrapper.querySelector('svg')
      if (svgEl) {
        // Preserve the original viewBox (Mermaid sets it); just override width/height for responsiveness
        const origWidth = svgEl.getAttribute('width')
        const origHeight = svgEl.getAttribute('height')
        if (origWidth && origHeight) {
          // If no viewBox, create one from width/height
          if (!svgEl.getAttribute('viewBox')) {
            svgEl.setAttribute('viewBox', `0 0 ${parseFloat(origWidth)} ${parseFloat(origHeight)}`)
          }
        }
        svgEl.style.width = '100%'
        svgEl.style.height = 'auto'
        svgEl.style.maxHeight = '420px'
        svgEl.removeAttribute('width')
        svgEl.setAttribute('height', 'auto')
      }

      setRendered(true)
    }

    renderMermaid().catch(e => {
      if (!cancelled) setError(String(e))
    })

    return () => {
      cancelled = true
      // Clean up the isolated wrapper content
      if (wrapper) wrapper.innerHTML = ''
    }
  }, [mermaidCode])

  // Fallback: show steps if no mermaid code or render failed
  if (!mermaidCode || error) {
    const COLORS = ['#5EEAD4', '#74B9FF', '#FDCB6E', '#E17055', '#A78BFA', '#00B894']
    return (
      <div className="mt-4">
        {chartData.title && (
          <p className="text-xs text-[#636E72] mb-3 text-center font-medium">{chartData.title}</p>
        )}
        {error && (
          <p className="text-[10px] text-[#E17055] mb-2 text-center">⚠ Mermaid render failed, showing steps</p>
        )}
        {steps?.length ? (
          <div className="flex flex-col gap-0">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  >
                    {i + 1}
                  </div>
                  {i < steps.length - 1 && <div className="w-0.5 h-4 bg-[#DFE6E9]" />}
                </div>
                <p className="text-[13px] leading-snug text-[#2D3436]/85 pt-0.5 pb-2">{step}</p>
              </div>
            ))}
          </div>
        ) : mermaidCode ? (
          <pre className="text-[10px] text-[#636E72] bg-[#F7F6F2] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {mermaidCode}
          </pre>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-4">
      {chartData.title && (
        <p className="text-xs text-[#636E72] mb-2 text-center font-medium">{chartData.title}</p>
      )}
      <div
        ref={containerRef}
        className={`bg-white rounded-xl p-3 border border-[#DFE6E9]/40 overflow-x-auto ${rendered ? '' : 'min-h-[80px] flex items-center justify-center'}`}
      >
        {!rendered && (
          <p className="text-[10px] text-[#B2BEC3] animate-pulse">Loading diagram...</p>
        )}
      </div>
    </div>
  )
}
