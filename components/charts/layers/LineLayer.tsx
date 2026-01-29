'use client'

import { useState } from 'react'
import { Group } from '@visx/group'
import { LinePath, AreaClosed } from '@visx/shape'
import { curveMonotoneX } from '@visx/curve'
import type { ScaleBand, ScaleLinear } from 'd3-scale'
import type { ChartDataPoint, ChartColors, SeriesVisibility, AnimationState, ChartStyle } from '../types'

interface LineLayerProps {
  data: ChartDataPoint[]
  xScale: ScaleBand<string>
  yScaleRight: ScaleLinear<number, number>
  colors: ChartColors
  visibility: SeriesVisibility
  animation: AnimationState
  showDataPoints?: boolean
  /** Currently active quarter (from crosshair) */
  activeQuarter?: string | null
  /** Chart style - 'advanced' uses gradients/glow, 'classic' uses simple lines */
  chartStyle?: ChartStyle
}

/**
 * Enhanced line overlay layer for net change and rolling average
 * Features:
 * - Gradient area fills
 * - Glow effects on lines
 * - Interactive data points with hover states
 * - Active quarter highlighting
 */
export function LineLayer({
  data,
  xScale,
  yScaleRight,
  colors,
  visibility,
  animation,
  showDataPoints = true,
  activeQuarter = null,
  chartStyle = 'advanced',
}: LineLayerProps) {
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const isClassic = chartStyle === 'classic'

  const bandwidth = xScale.bandwidth()
  const getX = (d: ChartDataPoint) => (xScale(d.quarter) ?? 0) + bandwidth / 2
  const getYNetChange = (d: ChartDataPoint) => yScaleRight(d.netChange)
  const getYRollingAvg = (d: ChartDataPoint) => yScaleRight(d.rollingAvg ?? 0)

  // Filter data with rolling averages
  const rollingData = data.filter((d) => d.rollingAvg !== null)

  // Calculate line opacity based on animation
  const lineOpacity = animation.isComplete ? 1 : animation.progress

  return (
    <Group>
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="net-change-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.netChangeLine} stopOpacity={0.2} />
          <stop offset="100%" stopColor={colors.netChangeLine} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="rolling-avg-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.rollingAvgLine} stopOpacity={0.15} />
          <stop offset="100%" stopColor={colors.rollingAvgLine} stopOpacity={0} />
        </linearGradient>

        {/* Line glow filter */}
        <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Data point glow filter */}
        <filter id="point-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Net Change Area Fill - only in advanced mode */}
      {!isClassic && visibility.netChange && (
        <AreaClosed
          data={data}
          x={getX}
          y={getYNetChange}
          yScale={yScaleRight}
          curve={curveMonotoneX}
          fill="url(#net-change-gradient)"
          opacity={lineOpacity * 0.5}
        />
      )}

      {/* Rolling Average Area Fill - only in advanced mode */}
      {!isClassic && visibility.rollingAvg && rollingData.length > 0 && (
        <AreaClosed
          data={rollingData}
          x={getX}
          y={getYRollingAvg}
          yScale={yScaleRight}
          curve={curveMonotoneX}
          fill="url(#rolling-avg-gradient)"
          opacity={lineOpacity * 0.5}
        />
      )}

      {/* Net Change Line */}
      {visibility.netChange && (
        <LinePath
          data={data}
          x={getX}
          y={getYNetChange}
          stroke={colors.netChangeLine}
          strokeWidth={isClassic ? 1.5 : 2}
          strokeLinecap="round"
          curve={curveMonotoneX}
          opacity={lineOpacity}
          filter={isClassic ? undefined : (animation.isComplete ? 'url(#line-glow)' : undefined)}
        />
      )}

      {/* Rolling Average Line */}
      {visibility.rollingAvg && rollingData.length > 0 && (
        <LinePath
          data={rollingData}
          x={getX}
          y={getYRollingAvg}
          stroke={colors.rollingAvgLine}
          strokeWidth={isClassic ? 1.5 : 2}
          strokeLinecap="round"
          strokeDasharray="6,4"
          curve={curveMonotoneX}
          opacity={lineOpacity}
        />
      )}

      {/* Data Point Markers */}
      {showDataPoints && animation.isComplete && (
        <>
          {/* Net Change Points */}
          {visibility.netChange &&
            data.map((d) => {
              const isActive = activeQuarter === d.quarter
              const isHovered = hoveredPoint === `net-${d.quarter}`
              const isHighlighted = isActive || isHovered

              return (
                <g key={`net-${d.quarter}`}>
                  {/* Larger invisible hit area for easier hover */}
                  <circle
                    cx={getX(d)}
                    cy={getYNetChange(d)}
                    r={8}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(`net-${d.quarter}`)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Outer ring for highlighted state */}
                  {isHighlighted && (
                    <circle
                      cx={getX(d)}
                      cy={getYNetChange(d)}
                      r={6}
                      fill="none"
                      stroke={colors.netChangeLine}
                      strokeWidth={1.5}
                      opacity={0.4}
                      style={{ transition: 'all 150ms ease-out' }}
                    />
                  )}
                  {/* Main data point */}
                  <circle
                    cx={getX(d)}
                    cy={getYNetChange(d)}
                    r={isHighlighted ? 4 : 3}
                    fill={colors.netChangeLine}
                    stroke={colors.background}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    filter={isClassic ? undefined : (isHighlighted ? 'url(#point-glow)' : undefined)}
                    style={isClassic ? { opacity: lineOpacity } : {
                      opacity: lineOpacity,
                      transition: 'all 150ms ease-out',
                    }}
                  />
                  {/* Value label on hover */}
                  {isHighlighted && (
                    <text
                      x={getX(d)}
                      y={getYNetChange(d) - 10}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={600}
                      fill={colors.netChangeLine}
                    >
                      {d.netChange >= 0 ? '+' : ''}{d.netChange}
                    </text>
                  )}
                </g>
              )
            })}

          {/* Rolling Average Points */}
          {visibility.rollingAvg &&
            rollingData.map((d) => {
              const isActive = activeQuarter === d.quarter
              const isHovered = hoveredPoint === `rolling-${d.quarter}`
              const isHighlighted = isActive || isHovered

              return (
                <g key={`rolling-${d.quarter}`}>
                  {/* Larger invisible hit area */}
                  <circle
                    cx={getX(d)}
                    cy={getYRollingAvg(d)}
                    r={8}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(`rolling-${d.quarter}`)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Outer ring for highlighted state */}
                  {isHighlighted && (
                    <circle
                      cx={getX(d)}
                      cy={getYRollingAvg(d)}
                      r={5}
                      fill="none"
                      stroke={colors.rollingAvgLine}
                      strokeWidth={1}
                      opacity={0.4}
                      style={{ transition: 'all 150ms ease-out' }}
                    />
                  )}
                  {/* Main data point */}
                  <circle
                    cx={getX(d)}
                    cy={getYRollingAvg(d)}
                    r={isHighlighted ? 3.5 : 2.5}
                    fill={colors.rollingAvgLine}
                    stroke={colors.background}
                    strokeWidth={isHighlighted ? 1.5 : 1}
                    filter={isClassic ? undefined : (isHighlighted ? 'url(#point-glow)' : undefined)}
                    style={isClassic ? { opacity: lineOpacity } : {
                      opacity: lineOpacity,
                      transition: 'all 150ms ease-out',
                    }}
                  />
                  {/* Value label on hover */}
                  {isHighlighted && d.rollingAvg !== null && (
                    <text
                      x={getX(d)}
                      y={getYRollingAvg(d) - 10}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={600}
                      fill={colors.rollingAvgLine}
                    >
                      {d.rollingAvg >= 0 ? '+' : ''}{d.rollingAvg.toFixed(1)}
                    </text>
                  )}
                </g>
              )
            })}
        </>
      )}
    </Group>
  )
}
