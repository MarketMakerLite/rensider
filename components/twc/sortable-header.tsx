'use client'

import { useState } from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { MobileFilterSheet } from '@/components/ui/MobileFilterSheet'

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
      aria-label={isActive && direction ? `Sort ${direction === 'asc' ? 'ascending' : 'descending'}` : undefined}
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

interface SortOption {
  column: string
  label: string
}

interface MobileSortControlProps {
  options: SortOption[]
  currentColumn: string | null
  direction: SortDirection
  onSort: (column: string) => void
  className?: string
}

/**
 * Mobile-friendly sort dropdown for card-based table views
 * Shows current sort state and opens a bottom sheet with sort options
 */
export function MobileSortControl({
  options,
  currentColumn,
  direction,
  onSort,
  className = '',
}: MobileSortControlProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentOption = options.find((opt) => opt.column === currentColumn)
  const currentLabel = currentOption?.label ?? 'Sort'

  return (
    <div className={`md:hidden ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        aria-haspopup="dialog"
      >
        <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
        <span>{currentLabel}</span>
        {direction && (
          <span className="text-zinc-400">
            {direction === 'asc' ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      <MobileFilterSheet isOpen={isOpen} onClose={() => setIsOpen(false)} title="Sort by">
        <div className="space-y-2">
          {options.map((option) => {
            const isActive = currentColumn === option.column
            return (
              <button
                key={option.column}
                type="button"
                onClick={() => {
                  onSort(option.column)
                  setIsOpen(false)
                }}
                className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <span className="text-base font-medium">{option.label}</span>
                {isActive && direction && (
                  <span className="flex items-center gap-1 text-sm">
                    {direction === 'asc' ? (
                      <>
                        <ChevronUpIcon className="h-4 w-4" />
                        <span>Ascending</span>
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="h-4 w-4" />
                        <span>Descending</span>
                      </>
                    )}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </MobileFilterSheet>
    </div>
  )
}
