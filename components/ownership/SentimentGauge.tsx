'use client'

import { motion, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { Text } from '@/components/twc/text'

interface SentimentGaugeProps {
  score: number
  signal: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
}

export function SentimentGauge({ score, signal }: SentimentGaugeProps) {
  const getSignalStyles = () => {
    switch (signal) {
      case 'BULLISH':
        return {
          bg: 'bg-green-500',
          text: 'text-green-600',
          label: 'Bullish',
        }
      case 'BEARISH':
        return {
          bg: 'bg-red-500',
          text: 'text-red-600',
          label: 'Bearish',
        }
      default:
        return {
          bg: 'bg-yellow-500',
          text: 'text-yellow-600',
          label: 'Neutral',
        }
    }
  }

  const styles = getSignalStyles()

  // Animated score value
  const springScore = useSpring(0, { stiffness: 80, damping: 20 })
  const displayScore = useTransform(springScore, (value) => Math.round(value))

  useEffect(() => {
    springScore.set(score)
  }, [score, springScore])

  const interpretation =
    score >= 60
      ? 'Institutions are net buyers'
      : score <= 40
        ? 'Institutions are net sellers'
        : 'Mixed institutional activity'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <Text className="text-sm text-zinc-500">Institutional Sentiment</Text>

      {/* Score and interpretation inline */}
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <motion.span className={`text-2xl font-bold tabular-nums ${styles.text}`}>
            {displayScore}
          </motion.span>
          <span className="text-sm text-zinc-400">/100</span>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="ml-auto text-right text-xs text-zinc-500"
        >
          {interpretation}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="relative h-2 w-full overflow-hidden rounded-full">
          {/* Track background */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)',
              opacity: 0.2,
            }}
          />
          {/* Filled portion */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: score / 100 }}
            transition={{ duration: 0.6, ease: [0, 0, 0.2, 1], delay: 0.1 }}
            className="absolute inset-y-0 left-0 origin-left"
            style={{
              width: '100%',
              background: 'linear-gradient(to right, #ef4444 0%, #eab308 50%, #22c55e 100%)',
            }}
          />
          {/* Position indicator - triangle marker */}
          <motion.div
            initial={{ left: '0%', opacity: 0 }}
            animate={{ left: `${score}%`, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0, 0, 0.2, 1], delay: 0.1 }}
            className="absolute -bottom-1"
          >
            <div className="relative -translate-x-1/2">
              <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-zinc-900" />
            </div>
          </motion.div>
        </div>

        {/* Scale labels */}
        <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
          <span>Selling</span>
          <span>Mixed</span>
          <span>Accumulating</span>
        </div>
      </div>
    </motion.div>
  )
}
