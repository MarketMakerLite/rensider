'use client'

import { Line } from '@visx/shape'
import { Text } from '@visx/text'
import type { ChartDimensions, ChartDataPoint, ChartColors } from '../types'

interface CrosshairProps {
  x: number
  y: number
  dataPoint: ChartDataPoint | null
  dimensions: ChartDimensions
  colors: ChartColors
  visible: boolean
  showLabels?: boolean
}

/**
 * Crosshair overlay with floating value labels
 * Note: This component is rendered inside a Group with margin translation,
 * so x,y coordinates are chart-area relative (0,0 = top-left of chart area)
 */
export function Crosshair({
  x,
  y,
  dataPoint,
  dimensions,
  colors,
  visible,
  showLabels = true,
}: CrosshairProps) {
  if (!visible || !dataPoint) return null

  const { innerWidth, innerHeight } = dimensions

  // Clamp crosshair to chart area (coordinates are already chart-area relative)
  const clampedX = Math.max(0, Math.min(x, innerWidth))
  const clampedY = Math.max(0, Math.min(y, innerHeight))

  // Determine label positioning (flip if near edges)
  const labelOnRight = clampedX < innerWidth / 2

  return (
    <g className="pointer-events-none">
      {/* Vertical line */}
      <Line
        from={{ x: clampedX, y: 0 }}
        to={{ x: clampedX, y: innerHeight }}
        stroke={colors.crosshair}
        strokeWidth={1}
        strokeDasharray="4,4"
        strokeOpacity={0.8}
      />

      {/* Horizontal line */}
      <Line
        from={{ x: 0, y: clampedY }}
        to={{ x: innerWidth, y: clampedY }}
        stroke={colors.crosshair}
        strokeWidth={1}
        strokeDasharray="4,4"
        strokeOpacity={0.8}
      />

      {/* Intersection point */}
      <circle
        cx={clampedX}
        cy={clampedY}
        r={4}
        fill={colors.crosshair}
        stroke={colors.background}
        strokeWidth={2}
      />

      {showLabels && (
        <>
          {/* Quarter label at top */}
          <g transform={`translate(${clampedX}, -8)`}>
            <rect
              x={-24}
              y={-14}
              width={48}
              height={18}
              fill={colors.crosshair}
              rx={0}
            />
            <Text
              textAnchor="middle"
              verticalAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill={colors.background}
              fontFamily="inherit"
            >
              {dataPoint.quarter}
            </Text>
          </g>

          {/* Value label on side */}
          <g
            transform={`translate(${
              labelOnRight ? innerWidth + 4 : -4
            }, ${clampedY})`}
          >
            <rect
              x={labelOnRight ? 0 : -48}
              y={-9}
              width={48}
              height={18}
              fill={colors.crosshair}
              rx={0}
            />
            <Text
              x={labelOnRight ? 24 : -24}
              textAnchor="middle"
              verticalAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill={colors.background}
              fontFamily="inherit"
            >
              {`${dataPoint.netChange >= 0 ? '+' : ''}${dataPoint.netChange}`}
            </Text>
          </g>
        </>
      )}
    </g>
  )
}
