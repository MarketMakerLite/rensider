'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilterInput } from '@/components/twc/filter-input'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { SortableHeader } from '@/components/twc/sortable-header'
import { TablePagination } from '@/components/twc/pagination'
import { useTableSort, useTableFilter, usePagination } from '@/lib/useTableSort'
import { formatNumber, formatCurrency, decodeHtmlEntities } from '@/lib/format'
import type { Holding } from '@/types/ownership'

type PortfolioSortKey = 'ticker' | 'securityName' | 'shares' | 'value' | 'changePercent' | 'portfolioPct'

interface PortfolioHoldingsTableProps {
  holdings: Holding[]
  totalValue: number
}

export function PortfolioHoldingsTable({ holdings, totalValue }: PortfolioHoldingsTableProps) {
  // Deduplicate holdings by ticker - keep only most recent filing
  const deduplicatedHoldings = useMemo(() => {
    const byTicker = new Map<string, Holding>()

    for (const h of holdings) {
      const key = h.ticker || h.cusip
      const existing = byTicker.get(key)

      // Keep the holding with the most recent filing date
      if (!existing || h.filingDate > existing.filingDate) {
        byTicker.set(key, h)
      }
    }

    return Array.from(byTicker.values())
  }, [holdings])

  const { filteredData, filterValue, setFilterValue } = useTableFilter(deduplicatedHoldings, ['ticker', 'securityName'])

  // Add portfolio percentage to each holding for sorting
  const holdingsWithPct = filteredData.map(h => ({
    ...h,
    portfolioPct: totalValue > 0 ? (h.value / totalValue) * 100 : 0,
  }))

  const { sortedData, sortState, toggleSort } = useTableSort<typeof holdingsWithPct[0], PortfolioSortKey>(
    holdingsWithPct,
    'value'
  )

  // Paginate sorted data
  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Subheading level={2}>All Holdings</Subheading>
        <div className="flex items-center gap-4">
          <FilterInput
            type="text"
            placeholder="Filter holdings..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="w-56"
            aria-label="Filter holdings"
          />
        </div>
      </div>

      {holdings.length > 0 ? (
        <>
          {/* Mobile Card View with Progressive Disclosure */}
          <MobileHoldingsCards holdings={paginatedData} />

          {/* Desktop Table View */}
          <Table className="mt-4 hidden md:block" striped>
            <TableHead>
              <TableRow>
                <TableHeader>
                  <SortableHeader
                    column="ticker"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as PortfolioSortKey)}
                  >
                    Ticker
                  </SortableHeader>
                </TableHeader>
                <TableHeader>
                  <SortableHeader
                    column="securityName"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as PortfolioSortKey)}
                  >
                    Security
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="text-right">
                  <SortableHeader
                    column="shares"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as PortfolioSortKey)}
                    className="justify-end"
                  >
                    Shares
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="text-right">
                  <SortableHeader
                    column="value"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as PortfolioSortKey)}
                    className="justify-end"
                  >
                    Value
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="text-right">
                  <SortableHeader
                    column="changePercent"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as PortfolioSortKey)}
                    className="justify-end"
                  >
                    Change
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="text-right">
                  <SortableHeader
                    column="portfolioPct"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as PortfolioSortKey)}
                    className="justify-end"
                  >
                    Weight
                  </SortableHeader>
                </TableHeader>
                <TableHeader>Type</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((holding) => (
                <TableRow key={holding.id}>
                  <TableCell>
                    {holding.ticker ? (
                      <Link
                        href={`/stock/${holding.ticker}`}
                        prefetch={false}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {holding.ticker}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-zinc-400">{holding.cusip}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {holding.ticker ? (
                      <Link
                        href={`/stock/${holding.ticker}`}
                        prefetch={false}
                        className="text-zinc-700 hover:text-blue-600 hover:underline"
                      >
                        {decodeHtmlEntities(holding.securityName)}
                      </Link>
                    ) : (
                      <span className="text-zinc-600">{decodeHtmlEntities(holding.securityName)}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(holding.shares)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(holding.value * 1000)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell changeType={holding.changeType} changePercent={holding.changePercent} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 bg-zinc-100">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(holding.portfolioPct * 2, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm">{holding.portfolioPct.toFixed(2)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {holding.putCall ? (
                      <Badge color={holding.putCall === 'CALL' ? 'green' : 'red'}>
                        {holding.putCall}
                      </Badge>
                    ) : (
                      <Badge color="zinc">EQUITY</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4">
            <TablePagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </div>
        </>
      ) : (
        <div className="mt-4 border border-zinc-200 p-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center border border-zinc-200 bg-zinc-50 text-zinc-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <Text className="text-zinc-500">No holdings data available</Text>
          <Text className="mt-1 text-sm text-zinc-400">
            Data may need to be synced from SEC EDGAR
          </Text>
        </div>
      )}
    </div>
  )
}

function ChangeCell({
  changeType,
  changePercent,
}: {
  changeType: Holding['changeType']
  changePercent: number | null
}) {
  if (!changeType || changeType === 'UNCHANGED') {
    return <span className="text-zinc-400">—</span>
  }

  if (changeType === 'NEW') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
        <span className="text-xs">▲</span>
        NEW
      </span>
    )
  }

  if (changeType === 'CLOSED') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-500">
        <span className="text-xs">▼</span>
        CLOSED
      </span>
    )
  }

  const isPositive = changeType === 'ADDED'
  const colorClass = isPositive ? 'text-emerald-600' : 'text-red-500'

  return (
    <span className={`inline-flex items-center gap-1 font-mono font-medium ${colorClass}`}>
      <span className="text-xs">{isPositive ? '▲' : '▼'}</span>
      {changePercent != null ? `${isPositive ? '+' : ''}${changePercent.toFixed(1)}%` : ''}
    </span>
  )
}

/**
 * Mobile holdings cards with progressive disclosure
 * Collapsed: Ticker, Security (truncated), Value, Change indicator
 * Expanded: Shares, Weight bar, PUT/CALL type
 */
function MobileHoldingsCards({
  holdings,
}: {
  holdings: (Holding & { portfolioPct: number })[]
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <div className="mt-4 space-y-3 md:hidden">
      {holdings.map((holding) => {
        const isExpanded = expandedId === holding.id
        return (
          <div
            key={`mobile-${holding.id}`}
            className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
          >
            {/* Always visible section */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : holding.id)}
              className="w-full p-4 text-left"
              aria-expanded={isExpanded}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {holding.ticker ? (
                    <Link
                      href={`/stock/${holding.ticker}`}
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {holding.ticker}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs text-zinc-400">{holding.cusip}</span>
                  )}
                  <div className="truncate text-sm text-zinc-500">
                    {decodeHtmlEntities(holding.securityName)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-medium">
                    {formatCurrency(holding.value * 1000)}
                  </div>
                  <ChangeCell changeType={holding.changeType} changePercent={holding.changePercent} />
                </div>
              </div>

              {/* Expand indicator */}
              <div className="mt-2 flex items-center justify-center">
                <motion.svg
                  className="h-4 w-4 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>
            </button>

            {/* Expandable section */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 space-y-3">
                    {/* Shares */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Shares</span>
                      <span className="font-mono text-sm">{formatNumber(holding.shares)}</span>
                    </div>

                    {/* Weight bar */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-zinc-500">Portfolio Weight</span>
                        <span className="font-mono text-sm">{holding.portfolioPct.toFixed(2)}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 rounded-full">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.min(holding.portfolioPct * 2, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Type</span>
                      {holding.putCall ? (
                        <Badge color={holding.putCall === 'CALL' ? 'green' : 'red'}>
                          {holding.putCall}
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-zinc-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>
                          EQUITY
                        </span>
                      )}
                    </div>

                    {/* View Stock link */}
                    {holding.ticker && (
                      <Link
                        href={`/stock/${holding.ticker}`}
                        prefetch={false}
                        className="flex items-center justify-center gap-2 mt-2 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        View {holding.ticker} Details
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
