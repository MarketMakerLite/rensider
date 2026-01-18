import { formatLargeNumber, formatNumber } from '@/lib/format'

interface ChangeIndicatorProps {
  value?: number | null
  formatAsCurrency?: boolean
  showSign?: boolean
  className?: string
}

/**
 * Displays a numeric change with color coding (green for positive, red for negative)
 */
export function ChangeIndicator({
  value,
  formatAsCurrency = false,
  showSign = true,
  className = '',
}: ChangeIndicatorProps) {
  if (value == null) {
    return <span className={`text-zinc-400 ${className}`}>-</span>
  }

  const colorClass = getChangeColorClass(value)
  const prefix = showSign && value > 0 ? '+' : ''
  const displayValue = formatAsCurrency
    ? formatLargeNumber(Math.abs(value) * 1000)
    : formatNumber(Math.abs(value))

  return (
    <span className={`${colorClass} ${className}`}>
      {value < 0 ? '-' : prefix}{displayValue}
    </span>
  )
}

/**
 * Returns the appropriate Tailwind color class for a numeric change value
 */
export function getChangeColorClass(value: number | null | undefined): string {
  if (value == null || value === 0) return 'text-zinc-500'
  return value > 0
    ? 'text-green-600'
    : 'text-red-600'
}
