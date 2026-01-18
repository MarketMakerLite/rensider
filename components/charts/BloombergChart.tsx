'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { Group } from '@visx/group'
import { scaleBand, scaleLinear } from '@visx/scale'
import { ParentSize } from '@visx/responsive'
import type { QuarterlyChange } from '@/types/ownership'
import {
  type TimeRange,
  type SeriesVisibility,
  type ChartConfig,
  type ChartStyle,
  defaultChartConfig,
  defaultSeriesVisibility,
  lightColors,
  classicColors,
} from './types'
import {
  useChartDimensions,
  useChartData,
  useChartInteraction,
  useChartAnimation,
} from './hooks'
import { GridLayer, BarLayer, LineLayer, AxisLayer } from './layers'
import {
  Crosshair,
  TimeRangeSelector,
  ChartStyleSelector,
  ChartTooltip,
  StatsPanel,
  ChartLegend,
} from './primitives'

interface BloombergChartProps {
  data: QuarterlyChange[]
  config?: Partial<ChartConfig>
  showStats?: boolean
  showTimeRange?: boolean
  showLegend?: boolean
  className?: string
}

function ResponsiveBloombergChart({
  data,
  width,
  height,
  config: configOverrides,
  showStats = true,
  showTimeRange = true,
  showLegend = true,
}: BloombergChartProps & { width: number; height: number }) {
  // State
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL')
  const [chartStyle, setChartStyle] = useState<ChartStyle>(configOverrides?.style ?? defaultChartConfig.style)

  // Merge config with defaults
  const config = useMemo<ChartConfig>(() => ({
    ...defaultChartConfig,
    ...configOverrides,
    height,
  }), [configOverrides, height])
  const [visibility, setVisibility] = useState<SeriesVisibility>(defaultSeriesVisibility)
  const containerRef = useRef<HTMLDivElement>(null)
  const colors = chartStyle === 'classic' ? classicColors : lightColors

  // Hooks
  const dimensions = useChartDimensions({
    width,
    height,
    margin: config.margin,
  })

  const { chartData, stats, domains } = useChartData({
    data,
    timeRange,
    rollingAvgPeriod: config.rollingAvgPeriod,
    chartStyle,
  })

  // Scales
  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, dimensions.innerWidth],
        domain: chartData.map((d) => d.quarter),
        padding: config.barPadding,
      }),
    [dimensions.innerWidth, chartData, config.barPadding]
  )

  const yScaleLeft = useMemo(
    () =>
      scaleLinear<number>({
        range: [dimensions.innerHeight, 0],
        domain: [0, domains.countMax],
        nice: true,
      }),
    [dimensions.innerHeight, domains.countMax]
  )

  // Value scale for classic mode (totalValue in USD)
  const yScaleValue = useMemo(
    () =>
      scaleLinear<number>({
        range: [dimensions.innerHeight, 0],
        domain: [0, domains.valueMax * 1.3], // 30% headroom
        nice: true,
      }),
    [dimensions.innerHeight, domains.valueMax]
  )

  // Net change scale (right axis) - symmetric around 0
  const yScaleRight = useMemo(() => {
    const netChanges = chartData.map((d) => d.netChange)
    const rollingAvgs = chartData.map((d) => d.rollingAvg).filter((v): v is number => v !== null)
    const allValues = [...netChanges, ...rollingAvgs]
    const maxAbs = Math.max(Math.abs(Math.min(...allValues, 0)), Math.abs(Math.max(...allValues, 0)), 1)

    return scaleLinear<number>({
      range: [dimensions.innerHeight, 0],
      domain: [-maxAbs * 1.2, maxAbs * 1.2],
      nice: true,
    })
  }, [dimensions.innerHeight, chartData])

  // Is this the classic chart style?
  const isClassic = chartStyle === 'classic'

  // Animation
  const { state: animationState, getAnimatedValue } = useChartAnimation({
    enabled: config.showAnimations,
    duration: 800,
  })

  // Interaction
  const {
    state: interactionState,
    handlers,
    containerRef: svgRef,
  } = useChartInteraction({
    data: chartData,
    dimensions,
    xScale,
    yScale: yScaleLeft,
    enabled: true,
  })

  // Handlers
  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range)
  }, [])

  const handleStyleChange = useCallback((style: ChartStyle) => {
    setChartStyle(style)
  }, [])

  const handleSeriesToggle = useCallback((series: keyof SeriesVisibility) => {
    setVisibility((prev) => ({
      ...prev,
      [series]: !prev[series],
    }))
  }, [])

  const handleBarMouseMove = useCallback(
    (_point: typeof chartData[0], event: React.MouseEvent) => {
      handlers.onMouseMove(event as React.MouseEvent<SVGElement>)
    },
    [handlers]
  )

  // Empty state
  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-zinc-200/50 bg-zinc-50/30">
        <div className="text-center opacity-60">
          <div className="mx-auto flex h-10 w-10 items-center justify-center border border-zinc-200/50 bg-zinc-100/50 text-zinc-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="mt-2 text-sm text-zinc-500">No historical data available</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {showTimeRange && (
          <TimeRangeSelector
            value={timeRange}
            onChange={handleTimeRangeChange}
          />
        )}
        <ChartStyleSelector
          value={chartStyle}
          onChange={handleStyleChange}
        />
      </div>

      {/* Stats panel */}
      {showStats && <StatsPanel stats={stats} colors={colors} />}

      {/* Main chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onMouseDown={handlers.onMouseDown}
          onMouseUp={handlers.onMouseUp}
          onKeyDown={handlers.onKeyDown}
          tabIndex={0}
          role="img"
          aria-label={`Institutional ownership chart showing ${chartData.length} quarters of position changes`}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{ cursor: 'crosshair' }}
        >
          <Group left={dimensions.margin.left} top={dimensions.margin.top}>
            {/* Grid */}
            {config.showGrid && (
              <GridLayer
                width={dimensions.innerWidth}
                height={dimensions.innerHeight}
                xScale={xScale}
                yScale={yScaleLeft}
                colors={colors}
              />
            )}

            {/* Zero reference line for net change - hidden in classic mode */}
            {!isClassic && config.showZeroLine && (
              <line
                x1={0}
                x2={dimensions.innerWidth}
                y1={yScaleRight(0)}
                y2={yScaleRight(0)}
                stroke={colors.axis}
                strokeWidth={1}
                strokeDasharray="4,2"
                opacity={0.6}
              />
            )}

            {/* Chart border for classic style */}
            {isClassic && (
              <rect
                x={0}
                y={0}
                width={dimensions.innerWidth}
                height={dimensions.innerHeight}
                fill="none"
                stroke={colors.grid}
                strokeWidth={1}
              />
            )}

            {/* Bars */}
            <BarLayer
              data={chartData}
              xScale={xScale}
              yScaleLeft={yScaleLeft}
              yScaleValue={yScaleValue}
              colors={colors}
              visibility={visibility}
              animation={animationState}
              getAnimatedValue={getAnimatedValue}
              onMouseMove={handleBarMouseMove}
              onMouseLeave={handlers.onMouseLeave}
              showValueLabels={config.showValueLabels}
              showChangeIndicators={config.showChangeIndicators}
              activeQuarter={interactionState.crosshair.dataPoint?.quarter}
              chartStyle={chartStyle}
            />

            {/* Lines (Net change + Rolling avg) - hidden in classic mode */}
            {!isClassic && (config.showNetChangeLine || config.showRollingAvg) && (
              <LineLayer
                data={chartData}
                xScale={xScale}
                yScaleRight={yScaleRight}
                colors={colors}
                visibility={visibility}
                animation={animationState}
                showDataPoints={true}
                activeQuarter={interactionState.crosshair.dataPoint?.quarter}
                chartStyle={chartStyle}
              />
            )}

            {/* Axes */}
            <AxisLayer
              xScale={xScale}
              yScaleLeft={isClassic ? yScaleValue : yScaleLeft}
              yScaleRight={yScaleRight}
              height={dimensions.innerHeight}
              colors={colors}
              showLeftAxis={true}
              showRightAxis={!isClassic && config.showDualAxis}
              leftAxisLabel={isClassic ? 'USD (M)' : 'Positions'}
              chartStyle={chartStyle}
            />

            {/* Crosshair - hidden in classic mode */}
            {!isClassic && config.showCrosshair && interactionState.crosshair.visible && (
              <Crosshair
                x={interactionState.crosshair.x}
                y={interactionState.crosshair.y}
                dimensions={dimensions}
                colors={colors}
                visible={interactionState.crosshair.visible}
                dataPoint={interactionState.crosshair.dataPoint}
              />
            )}
          </Group>
        </svg>

        {/* Tooltip */}
        <ChartTooltip
          dataPoint={interactionState.crosshair.dataPoint}
          left={interactionState.crosshair.svgX}
          top={interactionState.crosshair.svgY}
          visible={interactionState.crosshair.visible}
          colors={colors}
          chartStyle={chartStyle}
        />
      </div>

      {/* Legend below chart */}
      {showLegend && !isClassic && (
        <div className="-mt-2 flex justify-center">
          <ChartLegend
            colors={colors}
            visibility={visibility}
            interactive={true}
            onToggle={handleSeriesToggle}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Bloomberg-style institutional ownership chart with advanced features:
 * - Interactive crosshair with data point snapping
 * - Time range selector (1Q, 4Q, 2Y, All)
 * - Multi-series toggle for showing/hiding data
 * - Dual Y-axis for position counts and net change
 * - Rolling average line overlay
 * - Animated bar transitions
 * - Statistics summary panel
 * - Keyboard navigation support
 * - Dark mode with mocha theme
 */
export function BloombergChart({
  data,
  config,
  showStats = true,
  showTimeRange = true,
  showLegend = true,
  className,
}: BloombergChartProps) {
  return (
    <div className={`w-full ${className ?? ''}`}>
      <ParentSize debounceTime={100}>
        {({ width }) => (
          <ResponsiveBloombergChart
            data={data}
            width={width}
            height={config?.height ?? defaultChartConfig.height}
            config={config}
            showStats={showStats}
            showTimeRange={showTimeRange}
            showLegend={showLegend}
          />
        )}
      </ParentSize>
    </div>
  )
}
