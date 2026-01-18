'use client'

import { useMemo } from 'react'
import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { scaleBand, scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'
import type { FundQuarterlyData } from '@/types/ownership'
import { formatCurrency } from '@/lib/format'

interface FundAumChartProps {
  data: FundQuarterlyData[]
}

const margin = { top: 20, right: 20, bottom: 40, left: 60 }

const colors = {
  bar: '#3b82f6',       // blue-500
  barHover: '#2563eb',  // blue-600
  grid: '#e4e4e7',      // zinc-200
  axis: '#a1a1aa',      // zinc-400
  axisLabel: '#52525b', // zinc-600
}

function ResponsiveChart({ data, width, height }: { data: FundQuarterlyData[]; width: number; height: number }) {
  const xMax = Math.max(width - margin.left - margin.right, 0)
  const yMax = Math.max(height - margin.top - margin.bottom, 0)

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, xMax],
        domain: data.map(d => d.quarter),
        padding: 0.3,
      }),
    [xMax, data]
  )

  const yScale = useMemo(() => {
    const maxValue = Math.max(...data.map(d => d.totalValue), 1)
    return scaleLinear<number>({
      range: [yMax, 0],
      domain: [0, maxValue * 1.1],
      nice: true,
    })
  }, [yMax, data])

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        No historical data available
      </div>
    )
  }

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        <GridRows
          scale={yScale}
          width={xMax}
          stroke={colors.grid}
          strokeOpacity={0.5}
          strokeDasharray="2,3"
          numTicks={5}
        />

        {data.map((d) => {
          const x = xScale(d.quarter)
          if (x === undefined) return null
          const barHeight = yMax - yScale(d.totalValue)

          return (
            <Bar
              key={d.quarter}
              x={x}
              y={yScale(d.totalValue)}
              width={xScale.bandwidth()}
              height={barHeight}
              fill={colors.bar}
              rx={2}
            />
          )
        })}

        <AxisBottom
          top={yMax}
          scale={xScale}
          tickLabelProps={() => ({
            fill: colors.axisLabel,
            fontSize: 11,
            fontFamily: 'inherit',
            textAnchor: 'middle',
            dy: 4,
          })}
          stroke={colors.axis}
          tickStroke={colors.axis}
          tickLength={4}
        />

        <AxisLeft
          scale={yScale}
          numTicks={5}
          tickFormat={(v) => formatCurrency(v as number * 1000)}
          tickLabelProps={() => ({
            fill: colors.axisLabel,
            fontSize: 11,
            fontFamily: 'inherit',
            textAnchor: 'end',
            dx: -8,
            dy: 4,
          })}
          stroke={colors.axis}
          tickStroke={colors.axis}
          tickLength={4}
        />
      </Group>
    </svg>
  )
}

export function FundAumChart({ data }: FundAumChartProps) {
  return (
    <div className="h-full w-full">
      <ParentSize>
        {({ width, height }) => (
          <ResponsiveChart data={data} width={width} height={height} />
        )}
      </ParentSize>
    </div>
  )
}
