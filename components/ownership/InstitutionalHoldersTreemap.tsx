'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import type { Holding } from '@/types/ownership'
import { formatCurrency, decodeHtmlEntities } from '@/lib/format'

interface InstitutionalHoldersTreemapProps {
  holders: Holding[]
  totalValue: number
  maxItems?: number
}

interface TreemapItem {
  cik: string
  institutionName: string
  value: number
  percentage: number
  shares: number
  changeType: 'NEW' | 'ADDED' | 'REDUCED' | 'CLOSED' | 'UNCHANGED' | null
  changePercent: number | null
}

interface LayoutRect extends TreemapItem {
  x: number
  y: number
  w: number
  h: number
}

// Interpolate between two hex colors
function lerpColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)
  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Scale colors based on relative percentage (0 = min, 1 = max)
const getColorStyle = (percentage: number, maxPercentage: number, isHovered: boolean) => {
  // Calculate relative intensity (0 to 1)
  const t = maxPercentage > 0 ? percentage / maxPercentage : 0

  // Color stops: zinc-300 (lightest) to zinc-900 (darkest)
  const lightBg = '#d4d4d8' // zinc-300
  const darkBg = '#27272a'  // zinc-800
  const lightBorder = '#e4e4e7' // zinc-200
  const darkBorder = '#3f3f46'  // zinc-700

  const bgColor = lerpColor(lightBg, darkBg, t)
  const hoverBg = lerpColor(lightBg, '#18181b', t) // hover goes to zinc-900
  const borderColor = lerpColor(lightBorder, darkBorder, t)

  // Text color: dark for light backgrounds, white for dark backgrounds
  const textColor = t > 0.3 ? '#ffffff' : '#27272a'

  return {
    bgColor: isHovered ? hoverBg : bgColor,
    textColor,
    borderColor,
  }
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
        cik: item.cik,
        institutionName: item.institutionName,
        value: item.value,
        percentage: item.percentage,
        shares: item.shares,
        changeType: item.changeType,
        changePercent: item.changePercent,
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
 * Change indicator arrow
 */
function ChangeIndicator({
  changeType,
  changePercent,
  size = 'sm',
  showPercent = true,
}: {
  changeType: TreemapItem['changeType']
  changePercent: number | null
  size?: 'xs' | 'sm'
  showPercent?: boolean
}) {
  if (!changeType || changeType === 'UNCHANGED' || changeType === 'CLOSED') return null

  const isPositive = changeType === 'NEW' || changeType === 'ADDED'
  const sizeClass = size === 'xs' ? 'text-[8px]' : 'text-xs'

  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${sizeClass} ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? '▲' : '▼'}
      {showPercent && changePercent != null && (
        <span>{Math.abs(changePercent).toFixed(0)}%</span>
      )}
      {changeType === 'NEW' && <span>NEW</span>}
    </span>
  )
}

/**
 * Tooltip component for institutional holders
 */
function TreemapTooltip({
  item,
  visible,
}: {
  item: LayoutRect | null
  visible: boolean
}) {
  if (!visible || !item) return null

  const isPositive = item.changeType === 'NEW' || item.changeType === 'ADDED'
  const isNegative = item.changeType === 'REDUCED'

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
      <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-xl">
        <div className="max-w-64 truncate text-base font-semibold text-zinc-900">
          {decodeHtmlEntities(item.institutionName)}
        </div>
        <div className="mt-0.5 text-sm text-zinc-500">
          {item.percentage.toFixed(2)}% of institutional ownership
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums text-zinc-700">
            {formatCurrency(item.value * 1000)}
          </span>
          {item.changeType && item.changeType !== 'UNCHANGED' && (
            <span className={`text-xs font-medium tabular-nums ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-zinc-500'}`}>
              {item.changeType === 'NEW' ? 'NEW' : (
                <>
                  {isPositive ? '+' : ''}{item.changePercent?.toFixed(1)}%
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function InstitutionalHoldersTreemap({ holders, totalValue, maxItems = 25 }: InstitutionalHoldersTreemapProps) {
  const [hoveredItem, setHoveredItem] = useState<LayoutRect | null>(null)

  // Compute layout - aggregate by institution (CIK)
  const layout = useMemo(() => {
    // Aggregate holdings by CIK - sum values for same institution
    const byCik = new Map<string, {
      institutionName: string
      value: number
      shares: number
      filingDate: number
      changeType: Holding['changeType']
      changePercent: number | null
    }>()

    for (const h of holders) {
      const existing = byCik.get(h.cik)

      if (!existing) {
        byCik.set(h.cik, {
          institutionName: h.institutionName || h.cik,
          value: h.value,
          shares: h.shares,
          filingDate: h.filingDate,
          changeType: h.changeType,
          changePercent: h.changePercent,
        })
      } else {
        // Keep the most recent filing date info, but sum values
        if (h.filingDate > existing.filingDate) {
          existing.institutionName = h.institutionName || h.cik
          existing.filingDate = h.filingDate
          existing.changeType = h.changeType
          existing.changePercent = h.changePercent
        }
        existing.value += h.value
        existing.shares += h.shares
      }
    }

    // Convert to array and sort by value
    const sorted = Array.from(byCik.entries())
      .map(([cik, data]) => ({
        cik,
        institutionName: data.institutionName,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
        shares: data.shares,
        changeType: data.changeType,
        changePercent: data.changePercent,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems)

    return computeTreemapLayout(sorted)
  }, [holders, totalValue, maxItems])

  const handleMouseEnter = useCallback((item: LayoutRect) => {
    setHoveredItem(item)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null)
  }, [])

  if (holders.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
        <span className="text-sm text-zinc-400">No institutional holders data</span>
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
          const isHovered = hoveredItem?.cik === item.cik
          const maxPercentage = layout[0]?.percentage ?? 1
          const colors = getColorStyle(item.percentage, maxPercentage, isHovered)

          // Calculate cell area for adaptive content
          const cellArea = item.w * item.h
          const minDimension = Math.min(item.w, item.h)

          // Adaptive typography based on cell size
          const showName = minDimension > 4
          const showPercentage = cellArea > 80 && minDimension > 6
          const showChange = cellArea > 120 && minDimension > 8 && item.changeType && item.changeType !== 'UNCHANGED'

          // Truncate institution name based on cell width
          const maxNameLength = Math.floor(item.w * 1.2)
          const displayName = item.institutionName.length > maxNameLength
            ? item.institutionName.slice(0, maxNameLength - 2) + '...'
            : item.institutionName

          const nameSize = cellArea > 400 ? 'text-xs' : cellArea > 150 ? 'text-[10px]' : 'text-[9px]'
          const percentSize = cellArea > 400 ? 'text-xs' : 'text-[9px]'

          const cellContent = (
            <>
              {showName && (
                <span className={`font-semibold tracking-tight text-center leading-tight px-1 ${nameSize}`}>
                  {decodeHtmlEntities(displayName)}
                </span>
              )}
              {showPercentage && (
                <span className={`mt-0.5 tabular-nums opacity-75 ${percentSize}`}>
                  {item.percentage.toFixed(1)}%
                </span>
              )}
              {showChange && (
                <ChangeIndicator
                  changeType={item.changeType}
                  changePercent={item.changePercent}
                  size={cellArea > 200 ? 'sm' : 'xs'}
                  showPercent={cellArea > 200}
                />
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
          const ariaLabel = `${item.institutionName}: ${item.percentage.toFixed(1)}% of ownership, ${formatCurrency(item.value * 1000)}`

          return (
            <Link
              key={`${item.cik}-${index}`}
              href={`/fund/${item.cik}`}
              prefetch={false}
              className={cellClass}
              style={cellStyle}
              onMouseEnter={() => handleMouseEnter(item)}
              onMouseLeave={handleMouseLeave}
              aria-label={ariaLabel}
            >
              {cellContent}
            </Link>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
        <span className="text-xs font-medium text-zinc-500">Ownership Weight</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Low</span>
          <div className="flex h-3 w-20 overflow-hidden rounded-sm">
            <div className="h-full flex-1 bg-zinc-300" />
            <div className="h-full flex-1 bg-zinc-400" />
            <div className="h-full flex-1 bg-zinc-500" />
            <div className="h-full flex-1 bg-zinc-600" />
            <div className="h-full flex-1 bg-zinc-800" />
          </div>
          <span className="text-xs text-zinc-500">High</span>
        </div>
      </div>
    </div>
  )
}
