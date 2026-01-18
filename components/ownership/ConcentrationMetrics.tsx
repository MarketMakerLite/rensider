'use client'

import { memo } from 'react'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { formatNumber } from '@/lib/format'
import type { ConcentrationMetrics as ConcentrationMetricsType } from '@/types/ownership'

interface ConcentrationMetricsProps {
  metrics: ConcentrationMetricsType
}

function getConcentrationLevel(hhi: number): {
  label: string
  color: string
} {
  // HHI interpretation:
  // < 1500: Unconcentrated (diversified ownership)
  // 1500-2500: Moderately concentrated
  // > 2500: Highly concentrated
  if (hhi < 1500) {
    return { label: 'Diversified', color: 'text-green-600' }
  }
  if (hhi < 2500) {
    return { label: 'Moderate', color: 'text-yellow-600' }
  }
  return { label: 'Concentrated', color: 'text-red-600' }
}

export const ConcentrationMetrics = memo(function ConcentrationMetrics({ metrics }: ConcentrationMetricsProps) {
  const concentration = getConcentrationLevel(metrics.herfindahlIndex)

  // Don't show if no meaningful data
  if (
    metrics.top10Concentration === 0 &&
    metrics.herfindahlIndex === 0 &&
    !metrics.largestHolderName
  ) {
    return null
  }

  return (
    <div className="mt-8">
      <Subheading level={2}>Ownership Concentration</Subheading>
      <Text className="mt-1 text-sm text-zinc-500">
        Measures how concentrated institutional ownership is among top holders
      </Text>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Top 10 Concentration */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <Text className="text-sm text-zinc-500">
            Top 10 Holders
          </Text>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {metrics.top10Concentration.toFixed(1)}%
          </div>
          <Text className="mt-1 text-xs text-zinc-500">
            of institutional shares
          </Text>
        </div>

        {/* HHI Index */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <Text className="text-sm text-zinc-500">
            HHI Index
          </Text>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(metrics.herfindahlIndex)}
          </div>
          <Text className={`mt-1 text-xs ${concentration.color}`}>
            {concentration.label} ownership
          </Text>
        </div>

        {/* Largest Holder */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <Text className="text-sm text-zinc-500">
            Largest Holder
          </Text>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {metrics.largestHolderPercent.toFixed(1)}%
          </div>
          <Text className="mt-1 truncate text-xs text-zinc-500">
            {metrics.largestHolderName || 'Unknown'}
          </Text>
        </div>
      </div>
    </div>
  )
})
