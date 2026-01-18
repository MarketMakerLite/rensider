'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { easing, duration } from '@/lib/animations'

/**
 * World-class spinner/loading components
 * Elegant, formal, business-appropriate animations
 */

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type SpinnerVariant =
  | 'ring'
  | 'pulse'
  | 'dots'
  | 'bars'
  | 'orbital'
  | 'segments'
  | 'line'
  | 'wave'

interface SpinnerProps {
  size?: SpinnerSize
  variant?: SpinnerVariant
  className?: string
}

const sizes: Record<SpinnerSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
}

const strokeWidths: Record<SpinnerSize, number> = {
  xs: 1.5,
  sm: 1.5,
  md: 2,
  lg: 2,
  xl: 2.5,
}

/**
 * Elegant Ring Spinner
 * Smooth rotating arc with gradient fade
 */
export function RingSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const stroke = strokeWidths[size]
  const center = s / 2
  const radius = (s - stroke) / 2

  return (
    <motion.svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={className}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1.2,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <defs>
        <linearGradient id={`ring-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        opacity={0.1}
      />
      {/* Animated arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={`url(#ring-gradient-${size})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${radius * Math.PI * 0.75} ${radius * Math.PI * 2}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </motion.svg>
  )
}

/**
 * Pulse Spinner
 * Concentric rings with staggered pulse animation
 */
export function PulseSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const center = s / 2

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={center}
          cy={center}
          r={s * 0.15}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [0.5, 1.5],
            opacity: [0.6, 0],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: i * 0.4,
            ease: easing.decelerate,
          }}
          style={{ transformOrigin: 'center' }}
        />
      ))}
      {/* Center dot */}
      <motion.circle
        cx={center}
        cy={center}
        r={s * 0.08}
        fill="currentColor"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  )
}

/**
 * Dots Spinner
 * Three dots with staggered bounce animation
 */
export function DotsSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const dotSize = s * 0.18
  const gap = s * 0.28

  return (
    <div className={`flex items-center justify-center gap-[${gap}px] ${className}`} style={{ width: s, height: s }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full bg-current"
          style={{ width: dotSize, height: dotSize }}
          animate={{
            y: [0, -s * 0.2, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: easing.smooth,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Bars Spinner
 * Vertical bars with wave animation
 */
export function BarsSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const barWidth = s * 0.12
  const barCount = 4
  const gap = (s - barWidth * barCount) / (barCount + 1)

  return (
    <div className={`flex items-center ${className}`} style={{ width: s, height: s, gap: gap }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-sm bg-current"
          style={{ width: barWidth, height: s * 0.4 }}
          animate={{
            scaleY: [0.4, 1, 0.4],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.12,
            ease: easing.smooth,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Orbital Spinner
 * Dots orbiting around a center point
 */
export function OrbitalSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const center = s / 2
  const orbitRadius = s * 0.35
  const dotSize = s * 0.12

  return (
    <div className={`relative ${className}`} style={{ width: s, height: s }}>
      {/* Orbit track */}
      <svg width={s} height={s} className="absolute inset-0">
        <circle
          cx={center}
          cy={center}
          r={orbitRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.1}
        />
      </svg>
      {/* Orbiting dots */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-current"
          style={{
            width: dotSize,
            height: dotSize,
            left: center - dotSize / 2,
            top: center - orbitRadius - dotSize / 2,
            transformOrigin: `${dotSize / 2}px ${orbitRadius + dotSize / 2}px`,
          }}
          initial={{ rotate: i * 120, opacity: 0.3 + i * 0.25 }}
          animate={{ rotate: i * 120 + 360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

/**
 * Segments Spinner
 * Segmented ring with sequential highlight
 */
export function SegmentsSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const center = s / 2
  const radius = s * 0.38
  const segmentCount = 8
  const segmentAngle = 360 / segmentCount
  const gapAngle = 8

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
      {Array.from({ length: segmentCount }).map((_, i) => {
        const startAngle = i * segmentAngle - 90
        const endAngle = startAngle + segmentAngle - gapAngle
        const startRad = (startAngle * Math.PI) / 180
        const endRad = (endAngle * Math.PI) / 180

        const x1 = center + radius * Math.cos(startRad)
        const y1 = center + radius * Math.sin(startRad)
        const x2 = center + radius * Math.cos(endRad)
        const y2 = center + radius * Math.sin(endRad)

        return (
          <motion.path
            key={i}
            d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidths[size]}
            strokeLinecap="round"
            animate={{
              opacity: [0.15, 1, 0.15],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * (1.2 / segmentCount),
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </svg>
  )
}

/**
 * Line Spinner
 * Minimalist rotating line
 */
export function LineSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const center = s / 2
  const lineLength = s * 0.35

  return (
    <motion.svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={className}
      animate={{ rotate: 360 }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <line
        x1={center}
        y1={center - lineLength}
        x2={center}
        y2={center + lineLength}
        stroke="currentColor"
        strokeWidth={strokeWidths[size]}
        strokeLinecap="round"
        opacity={0.9}
      />
      <circle
        cx={center}
        cy={center}
        r={s * 0.06}
        fill="currentColor"
      />
    </motion.svg>
  )
}

/**
 * Wave Spinner
 * Horizontal wave with flowing motion
 */
export function WaveSpinner({ size = 'md', className = '' }: Omit<SpinnerProps, 'variant'>) {
  const s = sizes[size]
  const dotCount = 5
  const dotSize = s * 0.12

  return (
    <div
      className={`flex items-center justify-between ${className}`}
      style={{ width: s, height: s * 0.6 }}
    >
      {Array.from({ length: dotCount }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full bg-current"
          style={{ width: dotSize, height: dotSize }}
          animate={{
            y: [0, -s * 0.15, 0, s * 0.15, 0],
            opacity: [0.3, 1, 0.3, 1, 0.3],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/**
 * Main Spinner Component
 * Unified interface for all spinner variants
 */
export function Spinner({ size = 'md', variant = 'ring', className = '' }: SpinnerProps) {
  const spinnerClass = `text-zinc-800 ${className}`

  switch (variant) {
    case 'ring':
      return <RingSpinner size={size} className={spinnerClass} />
    case 'pulse':
      return <PulseSpinner size={size} className={spinnerClass} />
    case 'dots':
      return <DotsSpinner size={size} className={spinnerClass} />
    case 'bars':
      return <BarsSpinner size={size} className={spinnerClass} />
    case 'orbital':
      return <OrbitalSpinner size={size} className={spinnerClass} />
    case 'segments':
      return <SegmentsSpinner size={size} className={spinnerClass} />
    case 'line':
      return <LineSpinner size={size} className={spinnerClass} />
    case 'wave':
      return <WaveSpinner size={size} className={spinnerClass} />
    default:
      return <RingSpinner size={size} className={spinnerClass} />
  }
}

/**
 * Loading Overlay
 * Full-screen or container overlay with spinner
 */
interface LoadingOverlayProps {
  variant?: SpinnerVariant
  size?: SpinnerSize
  label?: string
  fullScreen?: boolean
  className?: string
}

export function LoadingOverlay({
  variant = 'ring',
  size = 'lg',
  label,
  fullScreen = false,
  className = '',
}: LoadingOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: duration.normal }}
      className={`
        flex flex-col items-center justify-center gap-4
        ${fullScreen ? 'fixed inset-0 z-50 bg-white/80 backdrop-blur-sm' : 'absolute inset-0 bg-white/60'}
        ${className}
      `}
    >
      <Spinner variant={variant} size={size} />
      {label && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: duration.normal }}
          className="text-sm font-medium text-zinc-500"
        >
          {label}
        </motion.p>
      )}
    </motion.div>
  )
}

/**
 * Inline Loading
 * Small inline spinner for buttons or text
 */
interface InlineLoadingProps {
  size?: 'xs' | 'sm'
  className?: string
}

export function InlineLoading({ size = 'sm', className = '' }: InlineLoadingProps) {
  return <RingSpinner size={size} className={`inline-block text-current ${className}`} />
}

/**
 * Skeleton Pulse
 * Elegant skeleton loading animation
 */
interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <motion.div
      className={`rounded bg-zinc-100 ${className}`}
      style={{ width, height }}
      animate={{
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

/**
 * Progress Dots
 * Sequential dots that fill in to show progress
 */
interface ProgressDotsProps {
  total?: number
  current?: number
  size?: SpinnerSize
  className?: string
}

export function ProgressDots({ total = 3, current = 0, size = 'sm', className = '' }: ProgressDotsProps) {
  const dotSize = sizes[size] * 0.3

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full bg-current"
          style={{ width: dotSize, height: dotSize }}
          animate={{
            opacity: i <= current ? 1 : 0.2,
            scale: i === current ? [1, 1.2, 1] : 1,
          }}
          transition={{
            opacity: { duration: 0.2 },
            scale: { duration: 0.6, repeat: i === current ? Infinity : 0 },
          }}
        />
      ))}
    </div>
  )
}

/**
 * Rotating Loading Messages
 * Cycles through cheeky messages during long loads
 */

const loadingMessages = [
  'Crunching the numbers',
  'Interrogating the database',
  'Consulting the oracles',
  'Reading the fine print',
  'Herding the data',
  'Wrangling spreadsheets',
  'Summoning insights',
  'Decoding Wall Street',
  'Counting shares',
  'Following the money',
  'Checking under the cushions',
  'Asking nicely',
  'Bribing the servers',
  'Consulting the tea leaves',
  'Running the numbers',
]

const searchMessages = [
  'Scanning the horizon',
  'Hunting for matches',
  'Querying the oracle',
  'Shaking the trees',
  'Digging through filings',
  'Consulting the archives',
  'Poking around',
]

interface RotatingLoadingMessageProps {
  messages?: string[]
  interval?: number
  className?: string
}

export function RotatingLoadingMessage({
  messages = loadingMessages,
  interval = 2000,
  className = '',
}: RotatingLoadingMessageProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * messages.length))

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length)
    }, interval)
    return () => clearInterval(timer)
  }, [messages.length, interval])

  return (
    <motion.p
      key={index}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: duration.normal, ease: easing.decelerate }}
      className={`text-sm font-medium tracking-wide text-zinc-400 ${className}`}
    >
      {messages[index]}
    </motion.p>
  )
}

export function SearchLoadingMessage({ className = '' }: { className?: string }) {
  return <RotatingLoadingMessage messages={searchMessages} interval={1500} className={className} />
}

export { loadingMessages, searchMessages }

export default Spinner