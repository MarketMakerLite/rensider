'use client'

import type { ChartStyle } from '../types'

interface ChartStyleSelectorProps {
  value: ChartStyle
  onChange: (style: ChartStyle) => void
  disabled?: boolean
}

const styles: { value: ChartStyle; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'advanced', label: 'Advanced' },
]

/**
 * Chart style selector toggle
 */
export function ChartStyleSelector({
  value,
  onChange,
  disabled = false,
}: ChartStyleSelectorProps) {
  return (
    <div className="inline-flex border border-zinc-200">
      {styles.map((style) => (
        <button
          key={style.value}
          onClick={() => onChange(style.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 text-xs font-medium transition-colors
            ${
              value === style.value
                ? 'bg-zinc-900 text-white'
                : 'bg-transparent text-zinc-600 hover:bg-zinc-100'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            border-r border-zinc-200 last:border-r-0
          `}
          aria-pressed={value === style.value}
        >
          {style.label}
        </button>
      ))}
    </div>
  )
}
