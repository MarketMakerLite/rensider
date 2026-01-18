'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Holding } from '@/types/ownership'
import { formatCurrency, decodeHtmlEntities } from '@/lib/format'

interface HoldingsTreemapProps {
  holdings: Holding[]
  totalValue: number
  maxItems?: number
}

interface TreemapItem {
  ticker: string
  cusip: string
  hasTicker: boolean
  value: number
  percentage: number
  name: string
}

interface LayoutRect extends TreemapItem {
  x: number
  y: number
  w: number
  h: number
}

// Sophisticated neutral palette with weight-based intensity
const getColorStyle = (percentage: number, isHovered: boolean) => {
  // Base colors scale from light to dark based on weight
  let bgColor: string
  let textColor: string
  let borderColor: string

  if (percentage >= 15) {
    bgColor = isHovered ? '#18181b' : '#27272a' // zinc-900/800
    textColor = '#ffffff'
    borderColor = '#3f3f46'
  } else if (percentage >= 10) {
    bgColor = isHovered ? '#27272a' : '#3f3f46' // zinc-800/700
    textColor = '#ffffff'
    borderColor = '#52525b'
  } else if (percentage >= 5) {
    bgColor = isHovered ? '#3f3f46' : '#52525b' // zinc-700/600
    textColor = '#ffffff'
    borderColor = '#71717a'
  } else if (percentage >= 2) {
    bgColor = isHovered ? '#52525b' : '#71717a' // zinc-600/500
    textColor = '#ffffff'
    borderColor = '#a1a1aa'
  } else if (percentage >= 1) {
    bgColor = isHovered ? '#71717a' : '#a1a1aa' // zinc-500/400
    textColor = '#ffffff'
    borderColor = '#d4d4d8'
  } else {
    bgColor = isHovered ? '#a1a1aa' : '#d4d4d8' // zinc-400/300
    textColor = '#27272a'
    borderColor = '#e4e4e7'
  }

  return { bgColor, textColor, borderColor }
}

/**
 * Calculate the worst aspect ratio in a row
 */
function worstRatio(
  row: Array<{ normalizedValue: number }>,
  rowArea: number,
  side: number
): number {
  if (row.length === 0 || side === 0) return Infinity

  const rowSize = rowArea / side
  if (rowSize === 0) return Infinity

  let worst = 0
  for (const item of row) {
    const itemSize = item.normalizedValue / rowSize
    if (itemSize === 0) continue
    const ratio = Math.max(rowSize / itemSize, itemSize / rowSize)
    worst = Math.max(worst, ratio)
  }

  return worst
}

/**
 * Squarified treemap algorithm
 * Creates visually balanced rectangles by optimizing aspect ratios
 */
function computeTreemapLayout(items: TreemapItem[]): LayoutRect[] {
  if (items.length === 0) return []

  const width = 100
  const height = 100

  if (items.length === 1) {
    return [{ ...items[0], x: 0, y: 0, w: width, h: height }]
  }

  const totalValue = items.reduce((sum, item) => sum + item.value, 0)
  if (totalValue === 0) return []

  const area = width * height
  const normalizedItems = items.map(item => ({
    ...item,
    normalizedValue: (item.value / totalValue) * area,
  }))

  const result: LayoutRect[] = []
  let remaining = [...normalizedItems]
  let currentX = 0
  let currentY = 0
  let currentWidth = width
  let currentHeight = height

  while (remaining.length > 0) {
    const vertical = currentWidth >= currentHeight
    const side = vertical ? currentHeight : currentWidth

    // Build optimal row
    const row: typeof normalizedItems = []
    let rowArea = 0

    for (const item of remaining) {
      const testRow = [...row, item]
      const testArea = rowArea + item.normalizedValue

      if (row.length === 0 || worstRatio(testRow, testArea, side) <= worstRatio(row, rowArea, side)) {
        row.push(item)
        rowArea = testArea
      } else {
        break
      }
    }

    // Layout the row
    const rowSize = side > 0 ? rowArea / side : 0
    let offset = 0

    for (const item of row) {
      const itemSize = rowSize > 0 ? item.normalizedValue / rowSize : 0

      result.push({
        ticker: item.ticker,
        cusip: item.cusip,
        hasTicker: item.hasTicker,
        value: item.value,
        percentage: item.percentage,
        name: item.name,
        x: vertical ? currentX : currentX + offset,
        y: vertical ? currentY + offset : currentY,
        w: vertical ? rowSize : itemSize,
        h: vertical ? itemSize : rowSize,
      })
      offset += itemSize
    }

    // Shrink remaining area
    if (vertical) {
      currentX += rowSize
      currentWidth -= rowSize
    } else {
      currentY += rowSize
      currentHeight -= rowSize
    }

    remaining = remaining.slice(row.length)
  }

  return result
}

/**
 * Elegant tooltip component
 */
function TreemapTooltip({
  item,
  visible,
}: {
  item: LayoutRect | null
  visible: boolean
}) {
  if (!visible || !item) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-xl">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-zinc-900">{item.ticker}</span>
          <span className="text-sm font-medium tabular-nums text-zinc-500">
            {item.percentage.toFixed(2)}%
          </span>
        </div>
        <div className="mt-0.5 max-w-52 truncate text-sm text-zinc-500">{decodeHtmlEntities(item.name)}</div>
        <div className="mt-2 text-sm font-medium tabular-nums text-zinc-700">
          {formatCurrency(item.value * 1000)}
        </div>
      </div>
    </div>
  )
}

export function HoldingsTreemap({ holdings, totalValue, maxItems = 25 }: HoldingsTreemapProps) {
  const [hoveredItem, setHoveredItem] = useState<LayoutRect | null>(null)

  // Compute layout in single pass
  const layout = useMemo(() => {
    const sorted = [...holdings]
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems)
      .map(h => ({
        ticker: h.ticker || h.cusip.substring(0, 6), // Fallback to issuer CUSIP
        cusip: h.cusip,
        hasTicker: !!h.ticker,
        value: h.value,
        percentage: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
        name: h.securityName,
      }))

    return computeTreemapLayout(sorted)
  }, [holdings, totalValue, maxItems])

  const handleMouseEnter = useCallback((item: LayoutRect) => {
    setHoveredItem(item)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null)
  }, [])

  if (holdings.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
        <span className="text-sm text-zinc-400">No holdings data</span>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      {/* Tooltip */}
      <TreemapTooltip item={hoveredItem} visible={hoveredItem !== null} />

      {/* Treemap grid */}
      <div className="relative h-80 w-full">
        {layout.map((item, index) => {
          const isHovered = hoveredItem?.ticker === item.ticker
          const colors = getColorStyle(item.percentage, isHovered)

          // Calculate cell area for adaptive content
          const cellArea = item.w * item.h
          const minDimension = Math.min(item.w, item.h)

          // Adaptive typography based on cell size
          const showTicker = minDimension > 4
          const showPercentage = cellArea > 80 && minDimension > 6
          const tickerSize = cellArea > 400 ? 'text-sm' : cellArea > 150 ? 'text-xs' : 'text-[10px]'
          const percentSize = cellArea > 400 ? 'text-xs' : 'text-[9px]'

          const cellContent = (
            <>
              {showTicker && (
                <span className={`font-semibold tracking-tight ${tickerSize}`}>
                  {item.ticker}
                </span>
              )}
              {showPercentage && (
                <span className={`mt-0.5 tabular-nums opacity-75 ${percentSize}`}>
                  {item.percentage.toFixed(1)}%
                </span>
              )}
            </>
          )

          const cellStyle = {
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: `${Math.max(item.w - 0.3, 0.5)}%`,
            height: `${Math.max(item.h - 0.3, 0.5)}%`,
            backgroundColor: colors.bgColor,
            color: colors.textColor,
            transform: isHovered ? 'scale(1.02)' : 'scale(1)',
            zIndex: isHovered ? 20 : 1,
            boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
          }

          const cellClass = "absolute flex flex-col items-center justify-center overflow-hidden transition-all duration-200"
          const ariaLabel = `${item.ticker}: ${item.percentage.toFixed(1)}% of portfolio, ${formatCurrency(item.value * 1000)}`

          // Only link if we have a real ticker
          if (item.hasTicker) {
            return (
              <Link
                key={`${item.cusip}-${index}`}
                href={`/stock/${item.ticker}`}
                className={cellClass}
                style={cellStyle}
                onMouseEnter={() => handleMouseEnter(item)}
                onMouseLeave={handleMouseLeave}
                aria-label={ariaLabel}
              >
                {cellContent}
              </Link>
            )
          }

          return (
            <div
              key={`${item.cusip}-${index}`}
              className={cellClass}
              style={cellStyle}
              onMouseEnter={() => handleMouseEnter(item)}
              onMouseLeave={handleMouseLeave}
              aria-label={ariaLabel}
            >
              {cellContent}
            </div>
          )
        })}
      </div>

      {/* Refined legend */}
      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
        <span className="text-xs font-medium text-zinc-500">Portfolio Weight</span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-zinc-300" />
            <span className="text-xs text-zinc-500">&lt;2%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-zinc-500" />
            <span className="text-xs text-zinc-500">2-10%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-zinc-800" />
            <span className="text-xs text-zinc-500">&gt;10%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
