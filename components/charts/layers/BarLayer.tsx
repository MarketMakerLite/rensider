'use client'

import { useState, useMemo } from 'react'
import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { Text } from '@visx/text'
import type { ChartDataPoint, ChartColors, SeriesVisibility, AnimationState, ChartStyle } from '../types'

interface BarLayerProps {
  data: ChartDataPoint[]
  xScale: any
  yScaleLeft: any
  /** Scale for totalValue in classic mode (USD) */
  yScaleValue?: any
  colors: ChartColors
  visibility: SeriesVisibility
  animation: AnimationState
  getAnimatedValue: (targetValue: number, startValue?: number) => number
  onMouseMove?: (point: ChartDataPoint, event: React.MouseEvent) => void
  onMouseLeave?: () => void
  /** Show value labels above bars */
  showValueLabels?: boolean
  /** Show quarter-over-quarter change indicators */
  showChangeIndicators?: boolean
  /** Currently active/selected quarter (from crosshair) */
  activeQuarter?: string | null
  /** Chart style - 'advanced' uses gradients/glow, 'classic' uses simple retro-style bars */
  chartStyle?: ChartStyle
}

/** Bar corner radius for advanced style */
const BAR_RADIUS = 2

/** Shadow offset for pseudo-3D effect in classic style */
const SHADOW_OFFSET_X = 3

/**
 * Enhanced stacked bar layer with:
 * - Gradient fills and glow effects
 * - Hover state with brightness/scale transitions
 * - Optional value labels
 * - Quarter-over-quarter change indicators
 * - Rounded corners
 * - Accessibility attributes
 */
export function BarLayer({
  data,
  xScale,
  yScaleLeft,
  yScaleValue,
  colors,
  visibility,
  animation,
  getAnimatedValue,
  onMouseMove,
  onMouseLeave,
  showValueLabels = false,
  showChangeIndicators = false,
  activeQuarter = null,
  chartStyle = 'advanced',
}: BarLayerProps) {
  const [hoveredQuarter, setHoveredQuarter] = useState<string | null>(null)

  const isClassic = chartStyle === 'classic'
  const bandwidth = xScale.bandwidth()

  // Wide bars for both modes - matching classic style
  const barWidth = Math.min(bandwidth * 0.95, 100)
  const barGap = 1
  const halfWidth = (barWidth - barGap) / 2

  // Use value scale for classic mode, count scale for advanced
  const yScale = isClassic && yScaleValue ? yScaleValue : yScaleLeft

  // Pre-calculate QoQ changes for indicators
  const qoqChanges = useMemo(() => {
    if (!showChangeIndicators) return new Map<string, { bullish: number; bearish: number }>()

    const changes = new Map<string, { bullish: number; bearish: number }>()
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1]
      const curr = data[i]
      const bullishChange = curr.bullishTotal - prev.bullishTotal
      const bearishChange = curr.bearishTotal - prev.bearishTotal
      changes.set(curr.quarter, { bullish: bullishChange, bearish: bearishChange })
    }
    return changes
  }, [data, showChangeIndicators])

  const handleMouseEnter = (quarter: string) => {
    setHoveredQuarter(quarter)
  }

  const handleMouseLeave = () => {
    setHoveredQuarter(null)
    onMouseLeave?.()
  }

  return (
    <Group>
      {/* Gradient definitions */}
      <defs>
        <linearGradient id="bullish-primary-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bullishPrimary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bullishPrimary} stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id="bullish-secondary-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bullishSecondary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bullishSecondary} stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id="bearish-primary-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bearishPrimary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bearishPrimary} stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id="bearish-secondary-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bearishSecondary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bearishSecondary} stopOpacity={0.7} />
        </linearGradient>

        {/* Hover state gradients (brighter) */}
        <linearGradient id="bullish-primary-hover" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bullishPrimary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bullishPrimary} stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id="bullish-secondary-hover" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bullishSecondary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bullishSecondary} stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id="bearish-primary-hover" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bearishPrimary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bearishPrimary} stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id="bearish-secondary-hover" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colors.bearishSecondary} stopOpacity={1} />
          <stop offset="100%" stopColor={colors.bearishSecondary} stopOpacity={0.85} />
        </linearGradient>

        {/* Glow filters */}
        <filter id="bullish-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bearish-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Enhanced hover glow */}
        <filter id="hover-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {data.map((d) => {
        const x = (xScale(d.quarter) ?? 0) + (bandwidth - barWidth) / 2
        const isHovered = hoveredQuarter === d.quarter
        const isActive = activeQuarter === d.quarter
        const isHighlighted = isHovered || isActive

        // Determine dimming for non-hovered bars when one is hovered
        const isDimmed = hoveredQuarter !== null && !isHighlighted
        const baseOpacity = isDimmed ? 0.4 : animation.isComplete ? 1 : 0.8

        // ============================================
        // CLASSIC MODE: Simple single bar for totalValue
        // ============================================
        if (isClassic && yScaleValue) {
          const valueHeight = getAnimatedValue(
            Math.abs(yScaleValue(0) - yScaleValue(d.totalValue))
          )
          const barY = yScaleValue(d.totalValue)

          return (
            <Group
              key={d.quarter}
              onMouseMove={(e) => onMouseMove?.(d, e)}
              onMouseEnter={() => handleMouseEnter(d.quarter)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer' }}
              role="graphics-symbol"
              aria-label={`${d.quarter}: $${(d.totalValue / 1_000_000).toFixed(1)}M total value`}
            >
              {/* Invisible hit area */}
              <rect
                x={x - 2}
                y={barY - 10}
                width={barWidth + SHADOW_OFFSET_X + 4}
                height={valueHeight + 20}
                fill="transparent"
              />

              {/* Shadow bar for pseudo-3D effect */}
              <Bar
                x={x + SHADOW_OFFSET_X}
                y={barY}
                width={barWidth}
                height={valueHeight}
                fill={colors.bullishShadow}
                opacity={baseOpacity}
              />

              {/* Main bar */}
              <Bar
                x={x}
                y={barY}
                width={barWidth}
                height={valueHeight}
                fill={colors.bullishPrimary}
                opacity={baseOpacity}
              />
            </Group>
          )
        }

        // ============================================
        // ADVANCED MODE: Stacked bullish/bearish bars
        // ============================================
        // Check if only one type of bar exists for centering
        const hasBullish = d.bullishTotal > 0
        const hasBearish = d.bearishTotal > 0
        const onlyBullish = hasBullish && !hasBearish
        const onlyBearish = hasBearish && !hasBullish

        // Calculate bar width and position based on whether both types exist
        const singleBarWidth = onlyBullish || onlyBearish ? halfWidth : halfWidth
        const bullishX = onlyBullish ? x + (barWidth - halfWidth) / 2 : x
        const bearishX = onlyBearish ? x + (barWidth - halfWidth) / 2 : x + halfWidth + barGap

        // Bullish bars - grow upward from axis
        const newPosHeight = getAnimatedValue(
          Math.abs(yScaleLeft(0) - yScaleLeft(d.newPositions))
        )
        const addedHeight = getAnimatedValue(
          Math.abs(yScaleLeft(0) - yScaleLeft(d.addedPositions))
        )
        const newPosY = yScaleLeft(0) - newPosHeight
        const addedY = newPosY - addedHeight
        const bullishStackTop = addedHeight > 0 ? addedY : newPosY

        // Bearish bars - grow upward from axis
        const closedHeight = getAnimatedValue(
          Math.abs(yScaleLeft(0) - yScaleLeft(d.closedPositions))
        )
        const reducedHeight = getAnimatedValue(
          Math.abs(yScaleLeft(0) - yScaleLeft(d.reducedPositions))
        )
        const closedY = yScaleLeft(0) - closedHeight
        const reducedY = closedY - reducedHeight
        const bearishStackTop = reducedHeight > 0 ? reducedY : closedY

        // QoQ change for this quarter
        const qoqChange = qoqChanges.get(d.quarter)

        return (
          <Group
            key={d.quarter}
            onMouseMove={(e) => onMouseMove?.(d, e)}
            onMouseEnter={() => handleMouseEnter(d.quarter)}
            onMouseLeave={handleMouseLeave}
            style={{
              cursor: 'pointer',
              transition: 'opacity 150ms ease-out',
            }}
            role="graphics-symbol"
            aria-label={`${d.quarter}: ${d.bullishTotal} bullish, ${d.bearishTotal} bearish positions`}
          >
            {/* Invisible hit area for better hover detection */}
            <rect
              x={x - 2}
              y={Math.min(bullishStackTop, bearishStackTop) - 10}
              width={barWidth + 4}
              height={yScaleLeft(0) - Math.min(bullishStackTop, bearishStackTop) + 20}
              fill="transparent"
            />

            {/* New Positions (bullish primary) - base bar */}
            {visibility.newPositions && newPosHeight > 0 && (
              <Bar
                x={bullishX}
                y={newPosY}
                width={halfWidth}
                height={newPosHeight}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={isHighlighted ? 'url(#bullish-primary-hover)' : 'url(#bullish-primary-gradient)'}
                filter={isHighlighted ? 'url(#hover-glow)' : animation.isComplete ? 'url(#bullish-glow)' : undefined}
                opacity={baseOpacity}
                style={{
                  transition: 'opacity 150ms ease-out, filter 150ms ease-out',
                  transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: `${bullishX + halfWidth / 2}px ${yScaleLeft(0)}px`,
                }}
              />
            )}

            {/* Added Positions (bullish secondary) - stacked on top */}
            {visibility.addedPositions && addedHeight > 0 && (
              <Bar
                x={bullishX}
                y={addedY}
                width={halfWidth}
                height={addedHeight}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={isHighlighted ? 'url(#bullish-secondary-hover)' : 'url(#bullish-secondary-gradient)'}
                opacity={baseOpacity}
                style={{ transition: 'opacity 150ms ease-out' }}
              />
            )}

            {/* Closed Positions (bearish primary) - base bar */}
            {visibility.closedPositions && closedHeight > 0 && (
              <Bar
                x={bearishX}
                y={closedY}
                width={halfWidth}
                height={closedHeight}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={isHighlighted ? 'url(#bearish-primary-hover)' : 'url(#bearish-primary-gradient)'}
                filter={isHighlighted ? 'url(#hover-glow)' : animation.isComplete ? 'url(#bearish-glow)' : undefined}
                opacity={baseOpacity}
                style={{
                  transition: 'opacity 150ms ease-out, filter 150ms ease-out',
                  transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
                  transformOrigin: `${bearishX + halfWidth / 2}px ${yScaleLeft(0)}px`,
                }}
              />
            )}

            {/* Reduced Positions (bearish secondary) - stacked on top */}
            {visibility.reducedPositions && reducedHeight > 0 && (
              <Bar
                x={bearishX}
                y={reducedY}
                width={halfWidth}
                height={reducedHeight}
                rx={BAR_RADIUS}
                ry={BAR_RADIUS}
                fill={isHighlighted ? 'url(#bearish-secondary-hover)' : 'url(#bearish-secondary-gradient)'}
                opacity={baseOpacity}
                style={{ transition: 'opacity 150ms ease-out' }}
              />
            )}

            {/* Value labels above bars */}
            {showValueLabels && animation.isComplete && (
              <>
                {/* Bullish total label */}
                {d.bullishTotal > 0 && (
                  <Text
                    x={bullishX + halfWidth / 2}
                    y={bullishStackTop - 6}
                    textAnchor="middle"
                    verticalAnchor="end"
                    fontSize={9}
                    fontWeight={600}
                    fill={colors.bullishPrimary}
                    opacity={isHighlighted ? 1 : 0.7}
                    style={{ transition: 'opacity 150ms ease-out' }}
                  >
                    {d.bullishTotal}
                  </Text>
                )}
                {/* Bearish total label */}
                {d.bearishTotal > 0 && (
                  <Text
                    x={bearishX + halfWidth / 2}
                    y={bearishStackTop - 6}
                    textAnchor="middle"
                    verticalAnchor="end"
                    fontSize={9}
                    fontWeight={600}
                    fill={colors.bearishPrimary}
                    opacity={isHighlighted ? 1 : 0.7}
                    style={{ transition: 'opacity 150ms ease-out' }}
                  >
                    {d.bearishTotal}
                  </Text>
                )}
              </>
            )}

            {/* QoQ Change indicators */}
            {showChangeIndicators && qoqChange && animation.isComplete && (
              <>
                {/* Bullish change indicator */}
                {qoqChange.bullish !== 0 && (
                  <g transform={`translate(${bullishX + halfWidth / 2}, ${bullishStackTop - (showValueLabels ? 18 : 6)})`}>
                    <text
                      textAnchor="middle"
                      fontSize={7}
                      fontWeight={500}
                      fill={qoqChange.bullish > 0 ? colors.bullishPrimary : colors.bearishPrimary}
                      opacity={0.8}
                    >
                      {qoqChange.bullish > 0 ? '▲' : '▼'}
                      {Math.abs(qoqChange.bullish)}
                    </text>
                  </g>
                )}
                {/* Bearish change indicator */}
                {qoqChange.bearish !== 0 && (
                  <g transform={`translate(${bearishX + halfWidth / 2}, ${bearishStackTop - (showValueLabels ? 18 : 6)})`}>
                    <text
                      textAnchor="middle"
                      fontSize={7}
                      fontWeight={500}
                      fill={qoqChange.bearish > 0 ? colors.bearishPrimary : colors.bullishPrimary}
                      opacity={0.8}
                    >
                      {qoqChange.bearish > 0 ? '▲' : '▼'}
                      {Math.abs(qoqChange.bearish)}
                    </text>
                  </g>
                )}
              </>
            )}
          </Group>
        )
      })}
    </Group>
  )
}
