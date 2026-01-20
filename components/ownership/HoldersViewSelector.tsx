'use client'

export type HoldersView = 'table' | 'treemap'

interface HoldersViewSelectorProps {
  value: HoldersView
  onChange: (view: HoldersView) => void
  disabled?: boolean
}

const views: { value: HoldersView; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'treemap', label: 'Treemap' },
]

/**
 * View selector toggle for institutional holders section
 */
export function HoldersViewSelector({
  value,
  onChange,
  disabled = false,
}: HoldersViewSelectorProps) {
  return (
    <div className="inline-flex border border-zinc-200">
      {views.map((view) => (
        <button
          key={view.value}
          onClick={() => onChange(view.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 text-xs font-medium transition-colors
            ${
              value === view.value
                ? 'bg-zinc-900 text-white'
                : 'bg-transparent text-zinc-600 hover:bg-zinc-100'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            border-r border-zinc-200 last:border-r-0
          `}
          aria-pressed={value === view.value}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}
