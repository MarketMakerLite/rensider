'use client'

import type { ChartStats, ChartColors } from '../types'

interface StatsPanelProps {
  stats: ChartStats
  colors: ChartColors
}

/**
 * Statistics summary panel showing key metrics
 */
export function StatsPanel({ stats, colors }: StatsPanelProps) {
  const trendIcon = {
    up: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    flat: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  }

  const trendColor = {
    up: colors.bullishPrimary,
    down: colors.bearishPrimary,
    flat: colors.axis,
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {/* New Positions */}
      <div className="border border-zinc-200 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          New Positions
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums text-zinc-900">
            {stats.totalNewPositions}
          </span>
          <span className="text-xs text-zinc-500">total</span>
        </div>
      </div>

      {/* Closed Positions */}
      <div className="border border-zinc-200 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Closed Positions
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums text-zinc-900">
            {stats.totalClosedPositions}
          </span>
          <span className="text-xs text-zinc-500">total</span>
        </div>
      </div>

      {/* Avg Net Change */}
      <div className="border border-zinc-200 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Avg Net Change
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: stats.avgNetChange >= 0 ? colors.bullishPrimary : colors.bearishPrimary }}
          >
            {stats.avgNetChange >= 0 ? '+' : ''}
            {stats.avgNetChange.toFixed(1)}
          </span>
          <span className="text-xs text-zinc-500">/qtr</span>
        </div>
      </div>

      {/* Max Bullish */}
      <div className="border border-zinc-200 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Peak Bullish
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: colors.bullishPrimary }}
          >
            {stats.maxBullish}
          </span>
          <span className="text-xs text-zinc-500">max</span>
        </div>
      </div>

      {/* Max Bearish */}
      <div className="border border-zinc-200 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Peak Bearish
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: colors.bearishPrimary }}
          >
            {stats.maxBearish}
          </span>
          <span className="text-xs text-zinc-500">max</span>
        </div>
      </div>

      {/* Trend */}
      <div className="border border-zinc-200 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Trend (4Q)
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span style={{ color: trendColor[stats.trendDirection] }}>
            {trendIcon[stats.trendDirection]}
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: trendColor[stats.trendDirection] }}
          >
            {stats.trendPercent >= 0 ? '+' : ''}
            {stats.trendPercent.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  )
}
