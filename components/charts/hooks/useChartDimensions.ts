import { useMemo } from 'react'
import type { ChartMargin, ChartDimensions } from '../types'

interface UseChartDimensionsProps {
  width: number
  height: number
  margin?: Partial<ChartMargin>
}

const defaultMargin: ChartMargin = {
  top: 40,
  right: 60,
  bottom: 60,
  left: 60,
}

/**
 * Hook to compute chart dimensions from container size and margins
 */
export function useChartDimensions({
  width,
  height,
  margin: marginOverrides,
}: UseChartDimensionsProps): ChartDimensions {
  return useMemo(() => {
    const margin: ChartMargin = {
      ...defaultMargin,
      ...marginOverrides,
    }

    const innerWidth = Math.max(0, width - margin.left - margin.right)
    const innerHeight = Math.max(0, height - margin.top - margin.bottom)

    return {
      width,
      height,
      margin,
      innerWidth,
      innerHeight,
    }
  }, [width, height, marginOverrides])
}
