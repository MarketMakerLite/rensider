'use client'

import { Grid } from '@visx/grid'
import type { ChartColors } from '../types'

interface GridLayerProps {
  width: number
  height: number
  xScale: any
  yScale: any
  colors: ChartColors
  numTicksRows?: number
  numTicksColumns?: number
}

/**
 * Professional grid layer with subtle styling
 */
export function GridLayer({
  width,
  height,
  xScale,
  yScale,
  colors,
  numTicksRows = 5,
  numTicksColumns = 0,
}: GridLayerProps) {
  return (
    <Grid
      xScale={xScale}
      yScale={yScale}
      width={width}
      height={height}
      numTicksRows={numTicksRows}
      numTicksColumns={numTicksColumns}
      stroke={colors.grid}
      strokeOpacity={0.5}
      strokeDasharray="2,3"
    />
  )
}
