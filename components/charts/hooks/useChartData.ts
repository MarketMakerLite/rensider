import { useMemo } from 'react'
import type { QuarterlyChange } from '@/types/ownership'
import type { ChartDataPoint, ChartStats, ChartStyle, TimeRange } from '../types'

interface UseChartDataProps {
  data: QuarterlyChange[]
  timeRange: TimeRange
  rollingAvgPeriod: number
  chartStyle?: ChartStyle
}

interface UseChartDataReturn {
  chartData: ChartDataPoint[]
  stats: ChartStats
  domains: {
    countMax: number
    valueMax: number
    valueMin: number
  }
}

/**
 * Filter data based on time range selection
 */
function filterByTimeRange(data: QuarterlyChange[], timeRange: TimeRange): QuarterlyChange[] {
  if (timeRange === 'ALL' || data.length === 0) {
    return data
  }

  const quartersToShow = {
    '1Q': 1,
    '4Q': 4,
    '2Y': 8,
  }[timeRange]

  return data.slice(-quartersToShow)
}

/**
 * Calculate rolling average for a given period
 */
function calculateRollingAvg(
  data: ChartDataPoint[],
  index: number,
  period: number
): number | null {
  if (index < period - 1) return null

  let sum = 0
  for (let i = index - period + 1; i <= index; i++) {
    sum += data[i].netChange
  }
  return sum / period
}

/**
 * Hook to transform raw data into chart-ready format with computed metrics
 */
export function useChartData({
  data,
  timeRange,
  rollingAvgPeriod,
  chartStyle = 'advanced',
}: UseChartDataProps): UseChartDataReturn {
  return useMemo(() => {
    // Filter data by time range
    let filteredData = filterByTimeRange(data, timeRange)

    // For advanced mode, skip the first data point (X0) since change values
    // are meaningless without a prior quarter to compare against
    if (chartStyle === 'advanced' && filteredData.length > 1) {
      filteredData = filteredData.slice(1)
    }

    // Transform to chart data points
    const chartData: ChartDataPoint[] = filteredData.map((d, index) => {
      const bullishTotal = d.newPositions + d.addedPositions
      const bearishTotal = d.reducedPositions + d.closedPositions
      const netChange = bullishTotal - bearishTotal

      return {
        quarter: d.quarter,
        index,
        newPositions: d.newPositions,
        addedPositions: d.addedPositions,
        bullishTotal,
        reducedPositions: d.reducedPositions,
        closedPositions: d.closedPositions,
        bearishTotal,
        netChange,
        totalHolders: d.totalHolders,
        totalValue: d.totalValue,
        rollingAvg: null, // Will be computed in second pass
        original: d,
      }
    })

    // Second pass: compute rolling averages
    chartData.forEach((point, index) => {
      point.rollingAvg = calculateRollingAvg(chartData, index, rollingAvgPeriod)
    })

    // Compute statistics
    const stats = computeStats(chartData)

    // Compute domains for scales
    const countMax = Math.max(
      1,
      ...chartData.map((d) => Math.max(d.bullishTotal, d.bearishTotal))
    )
    const allValues = chartData.map((d) => d.totalValue)
    const valueMax = Math.max(1, ...allValues)
    const valueMin = Math.min(...allValues)

    return {
      chartData,
      stats,
      domains: {
        countMax: countMax * 1.15, // Add 15% headroom
        valueMax,
        valueMin,
      },
    }
  }, [data, timeRange, rollingAvgPeriod, chartStyle])
}

/**
 * Compute summary statistics from chart data
 */
function computeStats(data: ChartDataPoint[]): ChartStats {
  if (data.length === 0) {
    return {
      totalNewPositions: 0,
      totalClosedPositions: 0,
      avgNetChange: 0,
      maxBullish: 0,
      maxBearish: 0,
      totalValueChange: 0,
      avgTotalValue: 0,
      trendDirection: 'flat',
      trendPercent: 0,
    }
  }

  const totalNewPositions = data.reduce((sum, d) => sum + d.newPositions, 0)
  const totalClosedPositions = data.reduce((sum, d) => sum + d.closedPositions, 0)
  const avgNetChange = data.reduce((sum, d) => sum + d.netChange, 0) / data.length
  const maxBullish = Math.max(...data.map((d) => d.bullishTotal))
  const maxBearish = Math.max(...data.map((d) => d.bearishTotal))

  const firstValue = data[0].totalValue
  const lastValue = data[data.length - 1].totalValue
  const totalValueChange = lastValue - firstValue
  const avgTotalValue = data.reduce((sum, d) => sum + d.totalValue, 0) / data.length

  // Compute trend from last 4 quarters (or all if less)
  const trendData = data.slice(-4)
  const trendStart = trendData[0].netChange
  const trendEnd = trendData[trendData.length - 1].netChange
  const trendDiff = trendEnd - trendStart

  let trendDirection: 'up' | 'down' | 'flat' = 'flat'
  if (trendDiff > 2) trendDirection = 'up'
  else if (trendDiff < -2) trendDirection = 'down'

  const trendPercent = trendStart !== 0 ? ((trendEnd - trendStart) / Math.abs(trendStart)) * 100 : 0

  return {
    totalNewPositions,
    totalClosedPositions,
    avgNetChange,
    maxBullish,
    maxBearish,
    totalValueChange,
    avgTotalValue,
    trendDirection,
    trendPercent,
  }
}
