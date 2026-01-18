'use client'

import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid'

export type SortDirection = 'asc' | 'desc' | null

interface SortableHeaderProps {
  children: React.ReactNode
  column: string
  currentColumn: string | null
  direction: SortDirection
  onSort: (column: string) => void
  className?: string
}

export function SortableHeader({
  children,
  column,
  currentColumn,
  direction,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentColumn === column

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`group inline-flex items-center gap-1 text-left font-medium hover:text-zinc-900 ${className}`}
      aria-sort={isActive && direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {children}
      <span className={`flex-none ${isActive ? 'text-zinc-900' : 'text-zinc-400 opacity-0 group-hover:opacity-100'}`}>
        {isActive && direction === 'asc' ? (
          <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}
