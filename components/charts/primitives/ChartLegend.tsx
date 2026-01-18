'use client'

import type { ChartColors, SeriesVisibility } from '../types'

interface ChartLegendProps {
  colors: ChartColors
  visibility: SeriesVisibility
  interactive?: boolean
  onToggle?: (series: keyof SeriesVisibility) => void
}

interface LegendItem {
  key: keyof SeriesVisibility
  label: string
  type: 'bar' | 'line'
  colorKey: keyof ChartColors
  secondaryColorKey?: keyof ChartColors
}

const legendItems: LegendItem[] = [
  { key: 'newPositions', label: 'New Positions', type: 'bar', colorKey: 'bullishPrimary' },
  { key: 'addedPositions', label: 'Added', type: 'bar', colorKey: 'bullishSecondary' },
  { key: 'reducedPositions', label: 'Reduced', type: 'bar', colorKey: 'bearishSecondary' },
  { key: 'closedPositions', label: 'Closed', type: 'bar', colorKey: 'bearishPrimary' },
  { key: 'netChange', label: 'Net Change', type: 'line', colorKey: 'netChangeLine' },
  { key: 'rollingAvg', label: '4Q Rolling Avg', type: 'line', colorKey: 'rollingAvgLine' },
]

/**
 * Interactive chart legend with show/hide functionality
 */
export function ChartLegend({
  colors,
  visibility,
  interactive = true,
  onToggle,
}: ChartLegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
      {legendItems.map((item) => {
        const isVisible = visibility[item.key]
        const color = colors[item.colorKey]

        const content = (
          <span
            className={`
              inline-flex items-center gap-2 text-xs
              ${!isVisible ? 'opacity-40' : ''}
              ${interactive ? 'cursor-pointer hover:opacity-80' : ''}
            `}
          >
            {item.type === 'bar' ? (
              <span
                className="h-3 w-3 flex-shrink-0"
                style={{ backgroundColor: color }}
              />
            ) : (
              <span className="flex h-3 w-4 items-center">
                <span
                  className="h-0.5 w-full"
                  style={{ backgroundColor: color }}
                />
              </span>
            )}
            <span className="text-zinc-600">{item.label}</span>
          </span>
        )

        if (interactive && onToggle) {
          return (
            <button
              key={item.key}
              onClick={() => onToggle(item.key)}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-pressed={isVisible}
              aria-label={`${isVisible ? 'Hide' : 'Show'} ${item.label}`}
            >
              {content}
            </button>
          )
        }

        return <span key={item.key}>{content}</span>
      })}
    </div>
  )
}
