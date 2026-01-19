'use client'

import { useMemo } from 'react'
import Link from 'next/link'
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
          <Table className="mt-4" striped>
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
