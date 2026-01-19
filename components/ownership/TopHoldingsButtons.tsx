'use client'

import { useState } from 'react'
import Link from 'next/link'

interface TopHolding {
  id: number
  ticker: string
  value: number
}

interface TopHoldingsButtonsProps {
  holdings: TopHolding[]
  totalValue: number
}

export function TopHoldingsButtons({ holdings, totalValue }: TopHoldingsButtonsProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  const maxPct = holdings[0] && totalValue > 0
    ? (holdings[0].value / totalValue) * 100
    : 1

  return (
    <div className="flex flex-wrap gap-2">
      {holdings.map((h) => {
        const pct = totalValue > 0 ? (h.value / totalValue) * 100 : 0
        const intensity = maxPct > 0 ? pct / maxPct : 0
        const isHovered = hoveredId === h.id

        // Interpolate colors based on relative percentage
        // From zinc-100 (lightest) to zinc-300 (darkest for buttons)
        const bgR = Math.round(244 - intensity * 40)
        const bgG = Math.round(244 - intensity * 40)
        const bgB = Math.round(245 - intensity * 37)

        const borderR = Math.round(228 - intensity * 56)
        const borderG = Math.round(228 - intensity * 56)
        const borderB = Math.round(232 - intensity * 52)

        const hoverBgR = Math.round(228 - intensity * 56)
        const hoverBgG = Math.round(228 - intensity * 56)
        const hoverBgB = Math.round(232 - intensity * 52)

        const hoverBorderR = Math.round(212 - intensity * 71)
        const hoverBorderG = Math.round(212 - intensity * 71)
        const hoverBorderB = Math.round(216 - intensity * 64)

        return (
          <Link
            key={h.id}
            href={`/stock/${h.ticker}`}
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium text-zinc-800 transition-all duration-200"
            style={{
              backgroundColor: isHovered
                ? `rgb(${hoverBgR} ${hoverBgG} ${hoverBgB})`
                : `rgb(${bgR} ${bgG} ${bgB})`,
              borderColor: isHovered
                ? `rgb(${hoverBorderR} ${hoverBorderG} ${hoverBorderB})`
                : `rgb(${borderR} ${borderG} ${borderB})`,
            }}
            onMouseEnter={() => setHoveredId(h.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <span>{h.ticker}</span>
            <span className="text-zinc-500">{pct.toFixed(1)}%</span>
          </Link>
        )
      })}
    </div>
  )
}
