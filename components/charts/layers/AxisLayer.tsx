'use client'

import { AxisBottom, AxisLeft, AxisRight } from '@visx/axis'
import type { ChartColors, ChartStyle } from '../types'

interface AxisLayerProps {
  xScale: any
  yScaleLeft: any
  yScaleRight: any
  height: number
  colors: ChartColors
  showLeftAxis?: boolean
  showRightAxis?: boolean
  leftAxisLabel?: string
  rightAxisLabel?: string
  chartStyle?: ChartStyle
}

/** Format large numbers as millions with commas */
function formatMillions(value: number): string {
  const millions = value / 1_000_000
  if (millions >= 1000) {
    return `${(millions / 1000).toFixed(1)}B`
  }
  if (millions >= 1) {
    return `${millions.toFixed(0)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toFixed(0)
}

/**
 * Dual Y-axis layer with professional styling
 */
export function AxisLayer({
  xScale,
  yScaleLeft,
  yScaleRight,
  height,
  colors,
  showLeftAxis = true,
  showRightAxis = true,
  leftAxisLabel = 'Positions',
  rightAxisLabel = 'Net Change',
  chartStyle = 'advanced',
}: AxisLayerProps) {
  const isClassic = chartStyle === 'classic'

  const axisStyles = {
    tickStroke: colors.axis,
    stroke: colors.axis,
    tickLabelProps: {
      fill: colors.text,
      fontSize: 14,
      fontFamily: isClassic ? 'Arial, Helvetica, sans-serif' : 'Inter, system-ui, sans-serif',
      fontWeight: 500,
    },
  }

  return (
    <>
      {/* Bottom Axis (Quarters/Time) */}
      <AxisBottom
        top={height}
        scale={xScale}
        stroke={colors.axis}
        tickStroke={colors.axis}
        tickLabelProps={() => ({
          ...axisStyles.tickLabelProps,
          textAnchor: 'middle' as const,
          dy: '0.25em',
        })}
        hideAxisLine={false}
        hideTicks={false}
        tickLength={4}
      />

      {/* Left Axis (Position Counts or USD for classic) */}
      {showLeftAxis && (
        <AxisLeft
          scale={yScaleLeft}
          stroke={colors.axis}
          tickStroke={colors.axis}
          tickLabelProps={() => ({
            ...axisStyles.tickLabelProps,
            textAnchor: 'end' as const,
            dx: '-0.25em',
            dy: '0.25em',
          })}
          hideAxisLine={false}
          hideTicks={false}
          tickLength={4}
          numTicks={5}
          tickFormat={isClassic ? (value) => formatMillions(Number(value)) : undefined}
          label={leftAxisLabel}
          labelProps={{
            fill: colors.textSecondary,
            fontSize: 14,
            fontFamily: isClassic ? 'Arial, Helvetica, sans-serif' : 'Inter, system-ui, sans-serif',
            textAnchor: 'middle',
            fontWeight: 600,
          }}
          labelOffset={50}
        />
      )}

      {/* Right Axis (Net Change) */}
      {showRightAxis && (
        <AxisRight
          left={xScale.range()[1]}
          scale={yScaleRight}
          stroke={colors.axis}
          tickStroke={colors.axis}
          tickLabelProps={() => ({
            ...axisStyles.tickLabelProps,
            textAnchor: 'start' as const,
            dx: '0.25em',
            dy: '0.25em',
          })}
          hideAxisLine={false}
          hideTicks={false}
          tickLength={4}
          numTicks={5}
          tickFormat={(value) => {
            const num = Number(value)
            return num >= 0 ? `+${num}` : `${num}`
          }}
          label={rightAxisLabel}
          labelProps={{
            fill: colors.textSecondary,
            fontSize: 14,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAnchor: 'middle',
            fontWeight: 600,
          }}
          labelOffset={50}
        />
      )}
    </>
  )
}
