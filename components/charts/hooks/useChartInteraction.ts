'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { localPoint } from '@visx/event'
import type { ScaleBand, ScaleLinear } from 'd3-scale'
import type {
  ChartDataPoint,
  ChartInteractionState,
  CrosshairPosition,
  BrushSelection,
  ChartDimensions,
  CHART_KEYS,
} from '../types'

interface UseChartInteractionProps {
  data: ChartDataPoint[]
  dimensions: ChartDimensions
  xScale: ScaleBand<string>
  yScale: ScaleLinear<number, number> // Used for potential future features
  enabled: boolean
}

interface UseChartInteractionReturn {
  state: ChartInteractionState
  handlers: {
    onMouseMove: (event: React.MouseEvent<SVGElement>) => void
    onMouseLeave: () => void
    onMouseDown: (event: React.MouseEvent<SVGElement>) => void
    onMouseUp: () => void
    onKeyDown: (event: React.KeyboardEvent) => void
    onBarHover: (quarter: string, type: 'bullish' | 'bearish') => void
    onBarLeave: () => void
  }
  containerRef: React.RefObject<SVGSVGElement | null>
}

const initialCrosshair: CrosshairPosition = {
  x: 0,
  y: 0,
  svgX: 0,
  svgY: 0,
  dataPoint: null,
  visible: false,
}

const initialBrush: BrushSelection = {
  startIndex: 0,
  endIndex: 0,
  start: null,
  end: null,
  isSelecting: false,
}

const initialState: ChartInteractionState = {
  crosshair: initialCrosshair,
  brush: initialBrush,
  hoveredBar: null,
  focusedIndex: -1,
  isPanning: false,
}

/**
 * Hook to manage all chart interaction state and event handlers
 */
export function useChartInteraction(props: UseChartInteractionProps): UseChartInteractionReturn {
  const { data, dimensions, xScale, enabled } = props
  const [state, setState] = useState<ChartInteractionState>(initialState)
  const containerRef = useRef<SVGSVGElement | null>(null)
  const brushStartRef = useRef<number | null>(null)

  // Find the data point closest to an x coordinate
  const findClosestDataPoint = useCallback(
    (x: number): ChartDataPoint | null => {
      if (data.length === 0) return null

      const { margin } = dimensions
      const adjustedX = x - margin.left

      // Find closest quarter
      let closestIndex = 0
      let closestDistance = Infinity

      data.forEach((d, i) => {
        const barX = (xScale(d.quarter) ?? 0) + xScale.bandwidth() / 2
        const distance = Math.abs(barX - adjustedX)
        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = i
        }
      })

      return data[closestIndex]
    },
    [data, dimensions, xScale]
  )

  // Handle mouse move for crosshair
  const onMouseMove = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      if (!enabled) return

      const point = localPoint(event)
      if (!point) return

      const dataPoint = findClosestDataPoint(point.x)
      const { margin } = dimensions

      // Calculate chart-area relative coordinates (for crosshair inside Group)
      const chartX = point.x - margin.left
      const chartY = point.y - margin.top

      setState((prev) => ({
        ...prev,
        crosshair: {
          x: chartX, // Chart-area relative for crosshair
          y: chartY, // Chart-area relative for crosshair
          svgX: point.x, // SVG root for tooltip
          svgY: point.y, // SVG root for tooltip
          dataPoint,
          visible: true,
        },
        // Update brush end if selecting
        brush: prev.brush.isSelecting
          ? {
              ...prev.brush,
              endIndex: dataPoint?.index ?? prev.brush.endIndex,
            }
          : prev.brush,
      }))
    },
    [enabled, findClosestDataPoint, dimensions]
  )

  // Handle mouse leave
  const onMouseLeave = useCallback(() => {
    setState((prev) => ({
      ...prev,
      crosshair: { ...initialCrosshair },
      hoveredBar: null,
    }))
  }, [])

  // Handle mouse down for brush selection
  const onMouseDown = useCallback(
    (event: React.MouseEvent<SVGElement>) => {
      if (!enabled) return

      const point = localPoint(event)
      if (!point) return

      const dataPoint = findClosestDataPoint(point.x)
      if (!dataPoint) return

      brushStartRef.current = dataPoint.index

      setState((prev) => ({
        ...prev,
        brush: {
          startIndex: dataPoint.index,
          endIndex: dataPoint.index,
          start: null,
          end: null,
          isSelecting: true,
        },
      }))
    },
    [enabled, findClosestDataPoint]
  )

  // Handle mouse up to complete brush selection
  const onMouseUp = useCallback(() => {
    if (!state.brush.isSelecting) return

    setState((prev) => ({
      ...prev,
      brush: {
        ...prev.brush,
        isSelecting: false,
      },
    }))

    brushStartRef.current = null
  }, [state.brush.isSelecting])

  // Handle bar hover
  const onBarHover = useCallback((quarter: string, type: 'bullish' | 'bearish') => {
    setState((prev) => ({
      ...prev,
      hoveredBar: { quarter, type },
    }))
  }, [])

  // Handle bar leave
  const onBarLeave = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hoveredBar: null,
    }))
  }, [])

  // Handle keyboard navigation
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!enabled || data.length === 0) return

      const key = event.key as (typeof CHART_KEYS)[keyof typeof CHART_KEYS]

      switch (key) {
        case 'ArrowLeft':
          event.preventDefault()
          setState((prev) => ({
            ...prev,
            focusedIndex: Math.max(0, prev.focusedIndex - 1),
          }))
          break

        case 'ArrowRight':
          event.preventDefault()
          setState((prev) => ({
            ...prev,
            focusedIndex: Math.min(data.length - 1, prev.focusedIndex + 1),
          }))
          break

        case 'Home':
          event.preventDefault()
          setState((prev) => ({
            ...prev,
            focusedIndex: 0,
          }))
          break

        case 'End':
          event.preventDefault()
          setState((prev) => ({
            ...prev,
            focusedIndex: data.length - 1,
          }))
          break

        case 'Escape':
          event.preventDefault()
          setState((prev) => ({
            ...prev,
            focusedIndex: -1,
            brush: initialBrush,
          }))
          break
      }
    },
    [enabled, data.length]
  )

  // Update crosshair position based on focused index (keyboard navigation)
  useEffect(() => {
    if (state.focusedIndex >= 0 && state.focusedIndex < data.length) {
      const dataPoint = data[state.focusedIndex]
      // Chart-area relative coordinates
      const chartX = (xScale(dataPoint.quarter) ?? 0) + xScale.bandwidth() / 2
      const chartY = dimensions.innerHeight / 2
      // SVG root coordinates (add margin back for tooltip)
      const svgX = chartX + dimensions.margin.left
      const svgY = chartY + dimensions.margin.top

      setState((prev) => ({
        ...prev,
        crosshair: {
          x: chartX,
          y: chartY,
          svgX,
          svgY,
          dataPoint,
          visible: true,
        },
      }))
    }
  }, [state.focusedIndex, data, xScale, dimensions])

  // Add global mouse up listener for brush
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (brushStartRef.current !== null) {
        setState((prev) => ({
          ...prev,
          brush: {
            ...prev.brush,
            isSelecting: false,
          },
        }))
        brushStartRef.current = null
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  return {
    state,
    handlers: {
      onMouseMove,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onKeyDown,
      onBarHover,
      onBarLeave,
    },
    containerRef,
  }
}
