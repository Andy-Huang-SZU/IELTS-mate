import { lazy, Suspense, useRef, useState, useEffect } from 'react'
import type { ChartData, SubChart } from '../../../services/writing'

const EChartsRenderer = lazy(() =>
  import('./EChartsRenderer').then(m => ({ default: m.EChartsRenderer }))
)
const TableRenderer = lazy(() =>
  import('./TableRenderer').then(m => ({ default: m.TableRenderer }))
)

const LoadingFallback = () => (
  <div className="h-[120px] flex items-center justify-center">
    <p className="text-[10px] text-[#B2BEC3] animate-pulse">Loading chart...</p>
  </div>
)

function SubChartRenderer({ subChart, height }: { subChart: SubChart; height?: number }) {
  const { chart_type, chart_data } = subChart

  if (chart_type === 'table') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TableRenderer chartData={chart_data} />
      </Suspense>
    )
  }

  if (['bar', 'line', 'pie'].includes(chart_type)) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <EChartsRenderer
          chartType={chart_type as 'bar' | 'line' | 'pie'}
          chartData={chart_data}
          height={height}
        />
      </Suspense>
    )
  }

  // Fallback for unknown sub-chart types
  return (
    <div className="p-3 bg-[#F7F6F2] rounded-lg">
      <p className="text-[10px] text-[#636E72]">Unsupported chart type: {chart_type}</p>
    </div>
  )
}

export function MixedChartRenderer({ chartData }: { chartData: ChartData }) {
  const subCharts = chartData.sub_charts as SubChart[] | undefined
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w) setContainerWidth(w)
    })
    ro.observe(wrapperRef.current)
    setContainerWidth(wrapperRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  if (!subCharts || subCharts.length === 0) {
    return (
      <div className="mt-4 p-4 bg-[#F7F6F2] rounded-xl text-center">
        <p className="text-[11px] text-[#636E72]">Mixed chart data not available</p>
      </div>
    )
  }

  // Use side-by-side layout when container is wide enough and we have exactly 2 sub-charts
  const useSideBySide = containerWidth > 600 && subCharts.length === 2
  // Dynamic sub-chart height based on container width
  const subChartHeight = useSideBySide
    ? Math.max(240, Math.round(containerWidth * 0.22))
    : Math.max(260, Math.round(containerWidth * 0.3))

  return (
    <div className="mt-4" ref={wrapperRef}>
      {chartData.title && (
        <p className="text-xs text-[#636E72] mb-3 text-center font-medium">{chartData.title}</p>
      )}
      <div className={`flex ${useSideBySide ? 'flex-row' : 'flex-col'} gap-3`}>
        {subCharts.map((sc, i) => (
          <div key={i} className={`bg-white/60 rounded-xl border border-[#DFE6E9]/30 px-2 py-1 ${useSideBySide ? 'flex-1 min-w-0' : ''}`}>
            <SubChartRenderer subChart={sc} height={subChartHeight} />
          </div>
        ))}
      </div>
    </div>
  )
}
