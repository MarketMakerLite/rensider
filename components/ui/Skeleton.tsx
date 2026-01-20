'use client'

import type React from 'react'
import clsx from 'clsx'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Base skeleton component with pulse animation
 * Includes accessibility attributes for screen readers
 */
export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={clsx(
        'animate-pulse rounded-md bg-zinc-200',
        className
      )}
      style={style}
    />
  )
}

/**
 * Skeleton for metric/stat cards (like on stock page)
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5', className)}
      role="status"
      aria-label="Loading card"
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-7 w-24" />
      <Skeleton className="mt-2 h-2.5 w-16" />
    </div>
  )
}

/**
 * Skeleton for table rows
 */
export function SkeletonTableRow({ columns = 6 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-zinc-100 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx(
            'h-4',
            i === 0 ? 'w-24' : i === columns - 1 ? 'w-16' : 'w-20'
          )}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton for full table with header and rows
 */
export function SkeletonTable({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white shadow-sm"
      role="status"
      aria-label="Loading table"
    >
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {/* Rows */}
      <div className="px-4">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} columns={columns} />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for mobile card list (used on mobile table views)
 */
export function SkeletonMobileCard({ className }: SkeletonProps) {
  return (
    <div className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-1.5 h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-3 w-24" />
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
        <Skeleton className="h-3 w-16" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-12 rounded-md" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for mobile card list
 */
export function SkeletonMobileCards({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMobileCard key={i} />
      ))}
    </div>
  )
}

/**
 * Skeleton for chart area
 * Uses deterministic heights based on index to avoid SSR hydration mismatch
 */
export function SkeletonChart({ className }: SkeletonProps) {
  // Deterministic heights to avoid SSR/client mismatch (simulates varying bar heights)
  const barHeights = [45, 72, 58, 85, 40, 68, 52, 78, 35, 65, 55, 80];

  return (
    <div
      className={clsx('rounded-lg border border-zinc-200 bg-white p-5 shadow-sm', className)}
      role="status"
      aria-label="Loading chart"
    >
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 flex h-64 items-end gap-2">
        {barHeights.map((height, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for treemap visualization
 */
export function SkeletonTreemap({ className }: SkeletonProps) {
  return (
    <div className={clsx('h-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)}>
      <div className="grid h-full grid-cols-4 grid-rows-3 gap-2">
        <Skeleton className="col-span-2 row-span-2" />
        <Skeleton className="col-span-1 row-span-1" />
        <Skeleton className="col-span-1 row-span-2" />
        <Skeleton className="col-span-1 row-span-1" />
        <Skeleton className="col-span-2 row-span-1" />
        <Skeleton className="col-span-2 row-span-1" />
      </div>
    </div>
  )
}

/**
 * Skeleton for gauge/sentiment indicator
 */
export function SkeletonGauge({ className }: SkeletonProps) {
  return (
    <div className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      <Skeleton className="h-3 w-24" />
      <div className="mt-4 flex items-center justify-center">
        <Skeleton className="h-20 w-20 rounded-full" />
      </div>
      <div className="mt-4 flex justify-between">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
      </div>
    </div>
  )
}

/**
 * Skeleton for responsive table (shows cards on mobile, table on desktop)
 */
export function SkeletonResponsiveTable({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <>
      {/* Mobile skeleton */}
      <div className="md:hidden">
        <SkeletonMobileCards count={rows} />
      </div>
      {/* Desktop skeleton */}
      <div className="hidden md:block">
        <SkeletonTable rows={rows} columns={columns} />
      </div>
    </>
  )
}

/**
 * Skeleton for filing card (matches FilingsTable mobile card layout)
 */
export function SkeletonFilingCard({ className, delay = 0 }: SkeletonProps & { delay?: number }) {
  return (
    <div
      className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-1.5 h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  )
}

/**
 * Skeleton for holding card (matches PortfolioHoldingsTable mobile card layout)
 */
export function SkeletonHoldingCard({ className, delay = 0 }: SkeletonProps & { delay?: number }) {
  return (
    <div
      className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-3 w-32" />
        </div>
        <div className="text-right">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-1 h-3 w-12 ml-auto" />
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  )
}

/**
 * Skeleton for activist activity card (matches ActivistActivityTable mobile card layout)
 */
export function SkeletonActivityCard({ className, delay = 0 }: SkeletonProps & { delay?: number }) {
  return (
    <div
      className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="mt-1.5 h-3 w-28" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-2 h-3 w-36" />
      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
    </div>
  )
}

/**
 * Skeleton for insider transaction card (matches InsiderTransactionsTable mobile card layout)
 */
export function SkeletonTransactionCard({ className, delay = 0 }: SkeletonProps & { delay?: number }) {
  return (
    <div
      className={clsx('rounded-lg border border-zinc-200 bg-white p-4 shadow-sm', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="mt-1.5 h-3 w-12" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-2 flex justify-center">
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  )
}

/**
 * Skeleton for filing cards list with staggered animation
 */
export function SkeletonFilingCards({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonFilingCard key={i} delay={i * 100} />
      ))}
    </div>
  )
}

/**
 * Skeleton for holding cards list with staggered animation
 */
export function SkeletonHoldingCards({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonHoldingCard key={i} delay={i * 100} />
      ))}
    </div>
  )
}

/**
 * Skeleton for activity cards list with staggered animation
 */
export function SkeletonActivityCards({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonActivityCard key={i} delay={i * 100} />
      ))}
    </div>
  )
}

/**
 * Skeleton for transaction cards list with staggered animation
 */
export function SkeletonTransactionCards({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTransactionCard key={i} delay={i * 100} />
      ))}
    </div>
  )
}
