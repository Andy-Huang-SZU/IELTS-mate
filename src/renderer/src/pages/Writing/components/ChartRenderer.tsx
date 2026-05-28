import { lazy, Suspense, useMemo } from 'react'
import type { ChartData } from '../../../services/writing'

const EChartsRenderer = lazy(() =>
  import('./EChartsRenderer').then(m => ({ default: m.EChartsRenderer }))
)
const TableRenderer = lazy(() =>
  import('./TableRenderer').then(m => ({ default: m.TableRenderer }))
)
const ProcessFlowRenderer = lazy(() =>
  import('./ProcessFlowRenderer').then(m => ({ default: m.ProcessFlowRenderer }))
)
const D3MapRenderer = lazy(() =>
  import('./D3MapRenderer').then(m => ({ default: m.D3MapRenderer }))
)
const MixedChartRenderer = lazy(() =>
  import('./MixedChartRenderer').then(m => ({ default: m.MixedChartRenderer }))
)

const ChartFallback = () => (
  <div className="h-[160px] flex items-center justify-center rounded-xl bg-[#F7F6F2]/50">
    <div className="flex flex-col items-center gap-2">
      <div className="w-5 h-5 border-2 border-[#5EEAD4] border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] text-[#B2BEC3]">Loading chart...</p>
    </div>
  </div>
)

const hasLegacyMixedCombinationData = (chartData: ChartData): boolean => {
  const hasCategories = Array.isArray(chartData.categories) && chartData.categories.length > 0
  const hasBarSeries = Array.isArray(chartData.bar_series) && chartData.bar_series.length > 0
  const hasLineSeries = Array.isArray(chartData.line_series) && chartData.line_series.length > 0
  return hasCategories && (hasBarSeries || hasLineSeries)
}

export function ChartRenderer({
  chartType,
  chartData,
}: {
  chartType?: string
  chartData?: ChartData
}) {
  // Generate a stable key from chartData to force full remount on topic change.
  // This prevents React DOM conflicts with imperative libraries (ECharts, D3, Mermaid).
  const chartKey = useMemo(() => {
    if (!chartData) return 'empty'
    try {
      // Use title + first few data points as a lightweight fingerprint
      const parts = [
        chartData.title || '',
        chartType || '',
        JSON.stringify(chartData.categories?.slice(0, 3)),
        JSON.stringify(chartData.series?.[0]?.data?.slice(0, 3)),
        JSON.stringify(chartData.bar_series?.[0]?.data?.slice(0, 3)),
        JSON.stringify(chartData.line_series?.[0]?.data?.slice(0, 3)),
        JSON.stringify(chartData.sub_charts?.map(sub => [sub.chart_type, sub.chart_data?.title]).slice(0, 2)),
      ]
      return parts.join('|')
    } catch {
      return String(Date.now())
    }
  }, [chartData, chartType])

  if (!chartData) return null

  return (
    <Suspense fallback={<ChartFallback />}>
      <ChartRendererInner key={chartKey} chartType={chartType} chartData={chartData} />
    </Suspense>
  )
}

function ChartRendererInner({
  chartType,
  chartData,
}: {
  chartType?: string
  chartData: ChartData
}) {
  switch (chartType) {
    case 'bar':
    case 'line':
    case 'pie':
      return <EChartsRenderer chartType={chartType} chartData={chartData} />

    case 'combination':
      // Legacy dual-axis chart (bar + line on same axes)
      return <EChartsRenderer chartType="combination" chartData={chartData} />

    case 'table':
      return <TableRenderer chartData={chartData} />

    case 'process':
      return <ProcessFlowRenderer chartData={chartData} />

    case 'map':
      return <D3MapRenderer chartData={chartData} />

    case 'mixed':
      if (hasLegacyMixedCombinationData(chartData)) {
        return <EChartsRenderer chartType="combination" chartData={chartData} />
      }
      return <MixedChartRenderer chartData={chartData} />

    default:
      // Default to bar chart for unknown types
      return <EChartsRenderer chartType="bar" chartData={chartData} />
  }
}
