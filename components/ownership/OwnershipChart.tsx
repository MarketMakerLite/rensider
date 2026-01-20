'use client'

import { useMemo, useCallback } from 'react'
import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { scaleBand, scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip'
import { localPoint } from '@visx/event'
import { ParentSize } from '@visx/responsive'
import type { QuarterlyChange } from '@/types/ownership'
import { BloombergChart } from '@/components/charts'
import { formatNumber } from '@/lib/format'

interface OwnershipChartProps {
  data: QuarterlyChange[]
  variant?: 'simple' | 'bloomberg'
}

const defaultMargin = { top: 24, right: 24, bottom: 48, left: 56 }

const colors = {
  bullish: '#16a34a',         // green-600
  bullishSecondary: '#4ade80', // green-400
  bearish: '#dc2626',         // red-600
  bearishSecondary: '#f87171', // red-400
  grid: '#e4e4e7',            // zinc-200
  axis: '#a1a1aa',            // zinc-400
  axisLabel: '#52525b',       // zinc-600
}

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
  color: '#18181b',
  padding: '12px 16px',
  borderRadius: '8px',
  fontSize: '13px',
  border: '1px solid #e4e4e7',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
}

interface ChartData {
  quarter: string
  bullish: number
  newOnly: number
  bearish: number
  closedOnly: number
  original: QuarterlyChange
}

function ResponsiveChart({ data, width, height }: { data: QuarterlyChange[]; width: number; height: number }) {
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
    detectBounds: true,
  })

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip<ChartData>()

  // Transform data for easier rendering
  const chartData = useMemo<ChartData[]>(() =>
    data.map(d => ({
      quarter: d.quarter,
      bullish: d.newPositions + d.addedPositions,
      newOnly: d.newPositions,
      bearish: d.reducedPositions + d.closedPositions,
      closedOnly: d.closedPositions,
      original: d,
    })), [data])

  // Dimensions
  const xMax = Math.max(width - defaultMargin.left - defaultMargin.right, 0)
  const yMax = Math.max(height - defaultMargin.top - defaultMargin.bottom, 0)

  // Scales
  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        domain: chartData.map(d => d.quarter),
        padding: 0.35,
      }),
    [xMax, chartData]
  )

  const yScale = useMemo(() => {
    const maxValue = Math.max(
      ...chartData.map(d => Math.max(d.bullish, d.bearish)),
      1 // Prevent 0 max
    )
    return scaleLinear<number>({
      range: [yMax, 0],
      domain: [0, maxValue * 1.15],
      nice: true,
    })
  }, [yMax, chartData])

  const barWidth = Math.max(xScale.bandwidth() / 2 - 3, 4)

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGRectElement>, d: ChartData) => {
    // localPoint returns SVG-relative coords, which match container coords since SVG fills container
    const coords = localPoint(event) || { x: 0, y: 0 }
    showTooltip({
      tooltipData: d,
      tooltipLeft: coords.x,
      tooltipTop: coords.y,
    })
  }, [showTooltip])

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/50">
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="mt-2 text-sm text-zinc-500">No historical data available</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Quarterly ownership changes chart showing ${chartData.length} quarters of institutional position changes`}
      >
        <Group left={defaultMargin.left} top={defaultMargin.top}>
          {/* Grid lines */}
          <GridRows
            scale={yScale}
            width={xMax}
            stroke={colors.grid}
            strokeOpacity={0.5}
            strokeDasharray="2,3"
            numTicks={5}
          />

          {/* Bars */}
          {chartData.map((d) => {
            const x = xScale(d.quarter)
            if (x === undefined) return null

            return (
              <Group key={d.quarter}>
                {/* Bullish bar (new + added) - lighter shade for added */}
                <Bar
                  x={x}
                  y={yScale(d.bullish)}
                  width={barWidth}
                  height={yMax - yScale(d.bullish)}
                  fill={colors.bullishSecondary}
                  opacity={0.7}
                  onMouseMove={(e) => handleMouseMove(e, d)}
                  onMouseLeave={hideTooltip}
                  style={{ cursor: 'pointer' }}
                />
                {/* New positions overlay (darker green) */}
                <Bar
                  x={x}
                  y={yScale(d.newOnly)}
                  width={barWidth}
                  height={yMax - yScale(d.newOnly)}
                  fill={colors.bullish}
                  onMouseMove={(e) => handleMouseMove(e, d)}
                  onMouseLeave={hideTooltip}
                  style={{ cursor: 'pointer' }}
                />

                {/* Bearish bar (reduced + closed) - lighter shade for reduced */}
                <Bar
                  x={x + barWidth + 6}
                  y={yScale(d.bearish)}
                  width={barWidth}
                  height={yMax - yScale(d.bearish)}
                  fill={colors.bearishSecondary}
                  opacity={0.7}
                  onMouseMove={(e) => handleMouseMove(e, d)}
                  onMouseLeave={hideTooltip}
                  style={{ cursor: 'pointer' }}
                />
                {/* Closed positions overlay (darker red) */}
                <Bar
                  x={x + barWidth + 6}
                  y={yScale(d.closedOnly)}
                  width={barWidth}
                  height={yMax - yScale(d.closedOnly)}
                  fill={colors.bearish}
                  onMouseMove={(e) => handleMouseMove(e, d)}
                  onMouseLeave={hideTooltip}
                  style={{ cursor: 'pointer' }}
                />
              </Group>
            )
          })}

          {/* Axes */}
          <AxisBottom
            top={yMax}
            scale={xScale}
            tickLabelProps={() => ({
              fill: colors.axisLabel,
              fontSize: 11,
              fontFamily: 'inherit',
              textAnchor: 'middle',
              dy: 4,
            })}
            stroke={colors.axis}
            tickStroke={colors.axis}
            hideAxisLine={false}
            tickLength={4}
          />
          <AxisLeft
            scale={yScale}
            numTicks={5}
            tickFormat={(v) => String(v)}
            tickLabelProps={() => ({
              fill: colors.axisLabel,
              fontSize: 11,
              fontFamily: 'inherit',
              textAnchor: 'end',
              dx: -8,
              dy: 4,
            })}
            stroke={colors.axis}
            tickStroke={colors.axis}
            hideAxisLine={false}
            tickLength={4}
          />

          {/* Y-axis label */}
          <text
            x={-yMax / 2}
            y={-40}
            transform="rotate(-90)"
            fontSize={11}
            fill={colors.axisLabel}
            textAnchor="middle"
            fontFamily="inherit"
          >
            Number of Institutions
          </text>
        </Group>
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="h-3 w-2 rounded-sm bg-green-600" />
            <div className="h-3 w-2 rounded-sm bg-green-400/70" />
          </div>
          <span className="text-zinc-600">New / Added Positions</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            <div className="h-3 w-2 rounded-sm bg-red-600" />
            <div className="h-3 w-2 rounded-sm bg-red-400/70" />
          </div>
          <span className="text-zinc-600">Closed / Reduced Positions</span>
        </div>
      </div>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div className="font-semibold tracking-wide text-zinc-900">{tooltipData.quarter}</div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                New
              </span>
              <span className="font-mono text-zinc-900">{formatNumber(tooltipData.original.newPositions)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="inline-block h-2 w-2 rounded-full bg-green-300" />
                Added
              </span>
              <span className="font-mono text-zinc-900">{formatNumber(tooltipData.original.addedPositions)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="inline-block h-2 w-2 rounded-full bg-red-300" />
                Reduced
              </span>
              <span className="font-mono text-zinc-900">{formatNumber(tooltipData.original.reducedPositions)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Closed
              </span>
              <span className="font-mono text-zinc-900">{formatNumber(tooltipData.original.closedPositions)}</span>
            </div>
            <div className="mt-2 border-t border-zinc-200 pt-2">
              <div className="flex items-center justify-between gap-6">
                <span className="text-zinc-600">Institutional Holders</span>
                <span className="font-mono font-semibold text-zinc-900">{formatNumber(tooltipData.original.totalHolders)}</span>
              </div>
            </div>
          </div>
        </TooltipInPortal>
      )}
    </div>
  )
}

export function OwnershipChart({ data, variant = 'bloomberg' }: OwnershipChartProps) {
  // Use Bloomberg chart by default for enhanced features
  if (variant === 'bloomberg') {
    return <BloombergChart data={data} config={{ height: 400 }} />
  }

  // Simple variant for backwards compatibility
  return (
    <div className="h-80 w-full">
      <ParentSize>
        {({ width, height }) => (
          <ResponsiveChart data={data} width={width} height={height} />
        )}
      </ParentSize>
    </div>
  )
}
