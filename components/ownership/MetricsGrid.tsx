'use client'

import { memo } from 'react'
import { motion } from 'motion/react'
import { Text } from '@/components/twc/text'
import { formatCurrency, formatNumber } from '@/lib/format'
import type { OwnershipMetrics } from '@/types/ownership'

interface MetricsGridProps {
  metrics: OwnershipMetrics
}

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
      ease: 'easeOut' as const,
    },
  }),
}

export const MetricsGrid = memo(function MetricsGrid({ metrics }: MetricsGridProps) {
  const totalChanges = metrics.increasedPositions + metrics.decreasedPositions
  const increasedPercent = totalChanges > 0 ? (metrics.increasedPositions / totalChanges) * 100 : 50

  return (
    <>
      {/* Total Holders */}
      <motion.div
        custom={0}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
      >
        <Text className="text-sm text-zinc-500">Total Holders</Text>
        <div className="mt-1 flex items-baseline justify-between">
          <div className="text-2xl font-bold tabular-nums">
            {formatNumber(metrics.totalHolders)}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="flex items-center gap-2 text-xs"
          >
            <span className="inline-flex items-center gap-1 text-green-600">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
              {metrics.newPositions} new
            </span>
            <span className="inline-flex items-center gap-1 text-red-600">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              {metrics.closedPositions} closed
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Total Value */}
      <motion.div
        custom={1}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
      >
        <Text className="text-sm text-zinc-500">Institutional Value</Text>
        <div className="mt-1 flex items-baseline justify-between">
          <div className="text-2xl font-bold tabular-nums">
            {formatCurrency(metrics.totalValue * 1000)}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            className="flex items-center gap-1.5 text-xs text-zinc-500"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="tabular-nums">{formatNumber(metrics.totalShares)}</span> shares
          </motion.div>
        </div>
      </motion.div>

      {/* Position Changes */}
      <motion.div
        custom={2}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
      >
        <Text className="text-sm text-zinc-500">Position Changes</Text>

        {/* Stats row */}
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums text-green-600">
              {metrics.increasedPositions}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">increased</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold tabular-nums text-red-600">
              {metrics.decreasedPositions}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">decreased</span>
          </div>
        </div>

        {/* Visual bar */}
        {totalChanges > 0 && (
          <div className="mt-2">
            <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0, 0, 0.2, 1] }}
                className="origin-left bg-green-500"
                style={{ width: `${increasedPercent}%` }}
              />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.5, ease: [0, 0, 0.2, 1] }}
                className="origin-right bg-red-500"
                style={{ width: `${100 - increasedPercent}%` }}
              />
            </div>
          </div>
        )}

        {totalChanges === 0 && (
          <div className="mt-2 flex h-2 items-center justify-center rounded-full bg-zinc-100">
            <span className="text-[10px] text-zinc-400">No position changes</span>
          </div>
        )}
      </motion.div>
    </>
  )
})
