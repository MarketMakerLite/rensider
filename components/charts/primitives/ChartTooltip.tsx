'use client'

import { formatNumber, formatCurrency } from '@/lib/format'
import type { ChartDataPoint, ChartColors, ChartStyle } from '../types'

interface ChartTooltipProps {
  dataPoint: ChartDataPoint | null
  left: number
  top: number
  visible: boolean
  colors: ChartColors
  chartStyle?: ChartStyle
}

/**
 * Enhanced tooltip with Bloomberg-style data display
 * Classic mode shows a simple tooltip with just quarter and value
 */
export function ChartTooltip({
  dataPoint,
  left,
  top,
  visible,
  colors,
  chartStyle = 'advanced',
}: ChartTooltipProps) {
  if (!visible || !dataPoint) {
    return null
  }

  // Offset tooltip so it doesn't cover the cursor
  const tooltipLeft = left + 12
  const tooltipTop = top - 10

  // Classic mode: simple tooltip
  if (chartStyle === 'classic') {
    return (
      <div
        className="pointer-events-none absolute z-50"
        style={{
          left: tooltipLeft,
          top: tooltipTop,
          transform: 'translateY(-100%)',
        }}
      >
        <div className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs shadow-md">
          <div className="font-medium text-zinc-900">{dataPoint.quarter}</div>
          <div className="text-zinc-600">
            {formatCurrency(dataPoint.totalValue * 1000)}
          </div>
        </div>
      </div>
    )
  }

  // Advanced mode: full Bloomberg-style tooltip
  const netChange = dataPoint.netChange
  const netChangeColor = netChange >= 0 ? colors.bullishPrimary : colors.bearishPrimary
  const netChangeSign = netChange >= 0 ? '+' : ''

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: tooltipLeft,
        top: tooltipTop,
        transform: 'translateY(-100%)',
      }}
    >
      <div
        className="border border-zinc-700/50 bg-zinc-900/97 text-white text-xs shadow-xl"
        style={{ minWidth: '200px' }}
      >
        {/* Header */}
        <div className="border-b border-zinc-700 bg-zinc-800 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold tracking-wide">{dataPoint.quarter}</span>
            <span
              className="font-mono text-sm font-bold"
              style={{ color: netChangeColor }}
            >
              {netChangeSign}{netChange}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-zinc-400">Total Value</span>
            <span className="font-mono text-white">{formatCurrency(dataPoint.totalValue * 1000)}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {/* Bullish Section */}
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Bullish Activity
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2"
                    style={{ backgroundColor: colors.bullishPrimary }}
                  />
                  <span className="text-zinc-300">New Positions</span>
                </span>
                <span className="font-mono font-medium">{dataPoint.newPositions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2"
                    style={{ backgroundColor: colors.bullishSecondary }}
                  />
                  <span className="text-zinc-300">Added</span>
                </span>
                <span className="font-mono font-medium">{dataPoint.addedPositions}</span>
              </div>
            </div>
          </div>

          {/* Bearish Section */}
          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Bearish Activity
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2"
                    style={{ backgroundColor: colors.bearishSecondary }}
                  />
                  <span className="text-zinc-300">Reduced</span>
                </span>
                <span className="font-mono font-medium">{dataPoint.reducedPositions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2"
                    style={{ backgroundColor: colors.bearishPrimary }}
                  />
                  <span className="text-zinc-300">Closed</span>
                </span>
                <span className="font-mono font-medium">{dataPoint.closedPositions}</span>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="border-t border-zinc-700 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Total Holders</span>
              <span className="font-mono font-semibold">{formatNumber(dataPoint.totalHolders)}</span>
            </div>
            {dataPoint.rollingAvg !== null && (
              <div className="mt-1 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2"
                    style={{ backgroundColor: colors.rollingAvgLine }}
                  />
                  <span className="text-zinc-400">4Q Avg</span>
                </span>
                <span className="font-mono font-semibold">
                  {dataPoint.rollingAvg >= 0 ? '+' : ''}
                  {dataPoint.rollingAvg.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
