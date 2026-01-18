'use client'

import type { TimeRange } from '../types'

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (range: TimeRange) => void
  disabled?: boolean
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: '2Y', label: '2Y' },
  { value: '4Q', label: '1Y' },
  { value: '1Q', label: '1Q' },
]

/**
 * Time range selector buttons (Bloomberg-style)
 */
export function TimeRangeSelector({
  value,
  onChange,
  disabled = false,
}: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex border border-zinc-200">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 text-xs font-medium transition-colors
            ${
              value === range.value
                ? 'bg-zinc-900 text-white'
                : 'bg-transparent text-zinc-600 hover:bg-zinc-100'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            border-r border-zinc-200 last:border-r-0
          `}
          aria-pressed={value === range.value}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
