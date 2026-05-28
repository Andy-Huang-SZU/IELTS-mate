import { useRef, useEffect, useState } from 'react'
import type { ChartData } from '../../../services/writing'

const COLORS = ['#5EEAD4', '#74B9FF', '#FDCB6E', '#E17055', '#A78BFA', '#00B894']

type EChartsType = 'bar' | 'line' | 'pie' | 'combination'

function buildBarOption(chart: ChartData, containerWidth: number): Record<string, unknown> {
  const catCount = chart.categories?.length || 0
  // Responsive font sizes based on container width
  const axisFs = containerWidth > 600 ? 12 : containerWidth > 400 ? 11 : 10
  const legendFs = containerWidth > 600 ? 12 : 11
  // Rotate labels when categories are many or labels are long
  const maxLabelLen = Math.max(...(chart.categories || []).map(c => String(c).length))
  const needRotate = catCount > 5 || (catCount > 3 && maxLabelLen > 8)
  const rotateAngle = needRotate ? (catCount > 8 ? 45 : 30) : 0
  const bottomMargin = chart.series.length > 1 ? 42 : (needRotate ? 28 : 20)

  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: legendFs, color: '#636E72' } },
    grid: { left: 60, right: 20, top: 28, bottom: bottomMargin, containLabel: true },
    xAxis: {
      type: 'category',
      data: chart.categories,
      axisLabel: {
        fontSize: axisFs,
        color: '#636E72',
        rotate: rotateAngle,
        interval: 0,
        overflow: 'truncate',
        width: containerWidth > 600 ? 120 : 80,
      },
      axisLine: { lineStyle: { color: '#DFE6E9' } },
    },
    yAxis: {
      type: 'value',
      name: chart.unit || undefined,
      nameTextStyle: { fontSize: axisFs, color: '#B2BEC3' },
      axisLabel: { fontSize: axisFs, color: '#B2BEC3' },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    series: chart.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      itemStyle: { color: COLORS[i % COLORS.length], borderRadius: [4, 4, 0, 0] },
      barMaxWidth: containerWidth > 600 ? 48 : 32,
    })),
  }
}

function buildLineOption(chart: ChartData, containerWidth: number): Record<string, unknown> {
  const axisFs = containerWidth > 600 ? 12 : containerWidth > 400 ? 11 : 10
  const legendFs = containerWidth > 600 ? 12 : 11
  const bottomMargin = chart.series.length > 1 ? 42 : 20

  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: legendFs, color: '#636E72' } },
    grid: { left: 60, right: 20, top: 28, bottom: bottomMargin, containLabel: true },
    xAxis: {
      type: 'category',
      data: chart.categories,
      axisLabel: { fontSize: axisFs, color: '#636E72', interval: 0 },
      axisLine: { lineStyle: { color: '#DFE6E9' } },
    },
    yAxis: {
      type: 'value',
      name: chart.unit || undefined,
      nameTextStyle: { fontSize: axisFs, color: '#B2BEC3' },
      axisLabel: { fontSize: axisFs, color: '#B2BEC3' },
      splitLine: { lineStyle: { color: '#F0F0F0' } },
    },
    series: chart.series.map((s, i) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      symbol: 'circle',
      symbolSize: containerWidth > 600 ? 8 : 6,
      lineStyle: { width: 2.5, color: COLORS[i % COLORS.length] },
      itemStyle: { color: COLORS[i % COLORS.length] },
    })),
  }
}

function buildPieOption(chart: ChartData, containerWidth: number): Record<string, unknown> {
  const hasMultiple = chart.series.length > 1
  const labelFs = containerWidth > 600 ? 12 : 10
  const legendFs = containerWidth > 600 ? 12 : 11

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: legendFs, color: '#636E72' } },
    color: COLORS,
    series: chart.series.map((s, si) => ({
      name: s.name,
      type: 'pie',
      radius: hasMultiple ? ['20%', '42%'] : ['25%', '55%'],
      center: hasMultiple ? [`${30 + si * 40}%`, '45%'] : ['50%', '45%'],
      data: s.data.map((v, i) => ({ value: v, name: chart.categories[i] || `Item ${i + 1}` })),
      label: {
        fontSize: labelFs,
        color: '#636E72',
        formatter: containerWidth > 500 ? '{b}: {d}%' : '{d}%',
      },
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
    })),
  }
}

function buildDualAxisOption(chart: ChartData, containerWidth: number): Record<string, unknown> {
  const barSeries = chart.bar_series || []
  const lineSeries = chart.line_series || []
  const barColors = ['#5EEAD4', '#74B9FF', '#FDCB6E']
  const lineColors = ['#E17055', '#A78BFA']
  const axisFs = containerWidth > 600 ? 12 : containerWidth > 400 ? 11 : 10
  const legendFs = containerWidth > 600 ? 12 : 11

  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, textStyle: { fontSize: legendFs, color: '#636E72' } },
    grid: { left: 60, right: 60, top: 28, bottom: 42, containLabel: true },
    xAxis: {
      type: 'category',
      data: chart.categories,
      axisLabel: { fontSize: axisFs, color: '#636E72', interval: 0 },
      axisLine: { lineStyle: { color: '#DFE6E9' } },
    },
    yAxis: [
      {
        type: 'value',
        name: chart.bar_unit || undefined,
        nameTextStyle: { fontSize: axisFs, color: '#B2BEC3' },
        axisLabel: { fontSize: axisFs, color: '#B2BEC3' },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
      },
      {
        type: 'value',
        name: chart.line_unit || undefined,
        nameTextStyle: { fontSize: axisFs, color: '#B2BEC3' },
        axisLabel: { fontSize: axisFs, color: '#B2BEC3' },
        splitLine: { show: false },
      },
    ],
    series: [
      ...barSeries.map((s, i) => ({
        name: s.name,
        type: 'bar',
        yAxisIndex: 0,
        data: s.data,
        itemStyle: { color: barColors[i % barColors.length], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: containerWidth > 600 ? 40 : 28,
      })),
      ...lineSeries.map((s, i) => ({
        name: s.name,
        type: 'line',
        yAxisIndex: 1,
        data: s.data,
        smooth: true,
        symbol: 'circle',
        symbolSize: containerWidth > 600 ? 8 : 6,
        lineStyle: { width: 2.5, color: lineColors[i % lineColors.length] },
        itemStyle: { color: lineColors[i % lineColors.length] },
      })),
    ],
  }
}

type OptionBuilder = (chart: ChartData, containerWidth: number) => Record<string, unknown>

const optionBuilders: Record<EChartsType, OptionBuilder> = {
  bar: buildBarOption,
  line: buildLineOption,
  pie: buildPieOption,
  combination: buildDualAxisOption,
}

export function EChartsRenderer({
  chartType,
  chartData,
  height: fixedHeight,
}: {
  chartType: EChartsType
  chartData: ChartData
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('echarts')['init']> | null>(null)
  const [dynamicHeight, setDynamicHeight] = useState(fixedHeight || 320)

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false
    let resizeObserver: ResizeObserver | null = null

    const initChart = async () => {
      const echarts = await import('echarts')
      if (disposed || !containerRef.current) return

      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }

      const instance = echarts.init(containerRef.current)
      chartRef.current = instance

      // Calculate responsive height based on container width
      const cw = containerRef.current.clientWidth
      if (!fixedHeight) {
        const catCount = chartData.categories?.length || 0
        const seriesCount = chartData.series?.length || 1
        // Base height scales with container width, adjusted for data complexity
        let h = Math.max(280, Math.min(450, cw * 0.38))
        // More categories or series → taller chart
        if (catCount > 6) h += 20
        if (seriesCount > 2) h += 20
        setDynamicHeight(Math.round(h))
      }

      const builder = optionBuilders[chartType] || buildBarOption
      const option = builder(chartData, cw)
      instance.setOption(option)

      // Responsive resize
      resizeObserver = new ResizeObserver((entries) => {
        if (!disposed && chartRef.current) {
          chartRef.current.resize()
          // Rebuild options on significant width change for font recalculation
          const newWidth = entries[0]?.contentRect?.width
          if (newWidth && Math.abs(newWidth - cw) > 100) {
            const newOption = builder(chartData, newWidth)
            chartRef.current.setOption(newOption)
            if (!fixedHeight) {
              const newH = Math.max(280, Math.min(450, newWidth * 0.38))
              setDynamicHeight(Math.round(newH))
            }
          }
        }
      })
      resizeObserver.observe(containerRef.current)
    }

    initChart()

    return () => {
      disposed = true
      // Disconnect observer FIRST, then dispose chart
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }
    }
  }, [chartType, chartData, fixedHeight])

  const chartHeight = fixedHeight || dynamicHeight

  return (
    <div className="mt-4">
      {chartData.title && (
        <p className="text-xs text-[#636E72] mb-2 text-center font-medium">{chartData.title}</p>
      )}
      <div ref={containerRef} style={{ width: '100%', height: chartHeight }} />
    </div>
  )
}
