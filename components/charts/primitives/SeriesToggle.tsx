'use client'

import type { DataSeries, SeriesVisibility, ChartColors } from '../types'

interface SeriesToggleProps {
  visibility: SeriesVisibility
  onChange: (series: DataSeries, visible: boolean) => void
  colors: ChartColors
}

interface SeriesConfig {
  key: DataSeries
  label: string
  colorKey: keyof ChartColors
}

const seriesConfig: SeriesConfig[] = [
  { key: 'newPositions', label: 'New', colorKey: 'bullishPrimary' },
  { key: 'addedPositions', label: 'Added', colorKey: 'bullishSecondary' },
  { key: 'reducedPositions', label: 'Reduced', colorKey: 'bearishSecondary' },
  { key: 'closedPositions', label: 'Closed', colorKey: 'bearishPrimary' },
  { key: 'netChange', label: 'Net Change', colorKey: 'netChangeLine' },
  { key: 'rollingAvg', label: '4Q Avg', colorKey: 'rollingAvgLine' },
]

/**
 * Toggle switches for showing/hiding data series
 */
export function SeriesToggle({ visibility, onChange, colors }: SeriesToggleProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {seriesConfig.map(({ key, label, colorKey }) => {
        const isVisible = visibility[key]
        const color = colors[colorKey]

        return (
          <button
            key={key}
            onClick={() => onChange(key, !isVisible)}
            className={`
              inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium
              border transition-all
              ${
                isVisible
                  ? 'border-zinc-300'
                  : 'border-zinc-200 opacity-50'
              }
            `}
            aria-pressed={isVisible}
          >
            <span
              className="h-2.5 w-2.5 transition-opacity"
              style={{
                backgroundColor: color,
                opacity: isVisible ? 1 : 0.3,
              }}
            />
            <span className="text-zinc-700">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
