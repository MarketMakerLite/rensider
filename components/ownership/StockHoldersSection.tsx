'use client'

import { useState, useEffect, useMemo } from 'react'
import { getChangeColorClass } from '@/components/common/ChangeIndicator'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilterInput } from '@/components/twc/filter-input'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { SortableHeader } from '@/components/twc/sortable-header'
import { TablePagination } from '@/components/twc/pagination'
import { useTableSort, useTableFilter, usePagination } from '@/lib/useTableSort'
import { formatShortDate, formatNumber, formatCurrency, decodeHtmlEntities } from '@/lib/format'
import { HoldersViewSelector, type HoldersView } from './HoldersViewSelector'
import { InstitutionalHoldersTreemap } from './InstitutionalHoldersTreemap'
import Link from 'next/link'
import type { Holding } from '@/types/ownership'

const STORAGE_KEY = 'holders-view-preference'

type HolderSortKey = 'institutionName' | 'shares' | 'value' | 'changePercent' | 'filingDate' | 'shareChange'

// Calculate share change from current shares and change percent
function calculateShareChange(shares: number, changePercent: number | null): number | null {
  if (changePercent === null || changePercent === 0) return null
  const previousShares = shares / (1 + changePercent / 100)
  return Math.round(shares - previousShares)
}

function getPositionColor(changeType: string): 'green' | 'blue' | 'yellow' | 'red' | 'zinc' {
  switch (changeType) {
    case 'NEW':
      return 'green'
    case 'ADDED':
      return 'blue'
    case 'REDUCED':
      return 'yellow'
    case 'CLOSED':
      return 'red'
    default:
      return 'zinc'
  }
}

interface StockHoldersSectionProps {
  holders: Holding[]
  totalValue: number
}

export function StockHoldersSection({ holders, totalValue }: StockHoldersSectionProps) {
  const [view, setView] = useState<HoldersView>('table')
  const [mounted, setMounted] = useState(false)

  // Load preference from localStorage on mount
  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'table' || stored === 'treemap') {
      setView(stored)
    }
  }, [])

  // Save preference when view changes
  const handleViewChange = (newView: HoldersView) => {
    setView(newView)
    localStorage.setItem(STORAGE_KEY, newView)
  }

  // Memoize enriched holders to avoid recalculation on every render
  const enrichedHolders = useMemo(
    () => holders.map((h) => ({
      ...h,
      shareChange: calculateShareChange(h.shares, h.changePercent),
    })),
    [holders]
  )

  // Filter holders by institution name
  const { filteredData, filterValue, setFilterValue } = useTableFilter(enrichedHolders, ['institutionName', 'cik'])

  // Sort filtered data - default to filingDate with shareChange as secondary
  const { sortedData, sortState, toggleSort } = useTableSort<typeof enrichedHolders[0], HolderSortKey>(
    filteredData,
    'filingDate',
    'desc',
    { column: 'shareChange', direction: 'desc' }
  )

  // Paginate sorted data
  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  // Prevent hydration mismatch by showing table by default until mounted
  const currentView = mounted ? view : 'table'

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Subheading level={2}>Institutional Holders</Subheading>
        <div className="flex items-center gap-4">
          {currentView === 'table' && (
            <FilterInput
              type="text"
              placeholder="Filter institutions..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-48"
              aria-label="Filter institutions"
            />
          )}
          <HoldersViewSelector value={currentView} onChange={handleViewChange} />
        </div>
      </div>

      {holders.length > 0 ? (
        currentView === 'treemap' ? (
          <div className="mt-4">
            <InstitutionalHoldersTreemap
              holders={holders}
              totalValue={totalValue}
              maxItems={30}
            />
          </div>
        ) : (
          <>
            <Table className="mt-4" striped>
              <TableHead>
                <TableRow>
                  <TableHeader>
                    <SortableHeader
                      column="institutionName"
                      currentColumn={sortState.column}
                      direction={sortState.direction}
                      onSort={(col) => toggleSort(col as HolderSortKey)}
                    >
                      Institution
                    </SortableHeader>
                  </TableHeader>
                  <TableHeader className="text-right">
                    <SortableHeader
                      column="filingDate"
                      currentColumn={sortState.column}
                      direction={sortState.direction}
                      onSort={(col) => toggleSort(col as HolderSortKey)}
                      className="justify-end"
                    >
                      Filed
                    </SortableHeader>
                  </TableHeader>
                  <TableHeader className="text-right">
                    <SortableHeader
                      column="shares"
                      currentColumn={sortState.column}
                      direction={sortState.direction}
                      onSort={(col) => toggleSort(col as HolderSortKey)}
                      className="justify-end"
                    >
                      Shares
                    </SortableHeader>
                  </TableHeader>
                  <TableHeader className="text-right">
                    <SortableHeader
                      column="shareChange"
                      currentColumn={sortState.column}
                      direction={sortState.direction}
                      onSort={(col) => toggleSort(col as HolderSortKey)}
                      className="justify-end"
                    >
                      Change
                    </SortableHeader>
                  </TableHeader>
                  <TableHeader className="text-right">
                    <SortableHeader
                      column="value"
                      currentColumn={sortState.column}
                      direction={sortState.direction}
                      onSort={(col) => toggleSort(col as HolderSortKey)}
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
                      onSort={(col) => toggleSort(col as HolderSortKey)}
                      className="justify-end"
                    >
                      Change %
                    </SortableHeader>
                  </TableHeader>
                  <TableHeader>Position</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedData.map((holder) => (
                  <TableRow key={holder.id}>
                    <TableCell>
                      <Link
                        href={`/fund/${holder.cik}`}
                        prefetch={false}
                        className="text-blue-600 hover:underline"
                      >
                        {decodeHtmlEntities(holder.institutionName) || holder.cik}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-zinc-500">
                      {formatShortDate(holder.filingDate)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(holder.shares)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {holder.shareChange !== null ? (
                        <span className={getChangeColorClass(holder.shareChange)}>
                          {holder.shareChange >= 0 ? '+' : ''}{formatNumber(holder.shareChange)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(holder.value * 1000)}
                    </TableCell>
                    <TableCell className="text-right">
                      {holder.changePercent !== null ? (
                        <span className={getChangeColorClass(holder.changePercent)}>
                          {holder.changePercent >= 0 ? '+' : ''}{holder.changePercent.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {holder.changeType && (
                        <Badge color={getPositionColor(holder.changeType)}>
                          {holder.changeType}
                        </Badge>
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
        )
      ) : (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <Text className="text-zinc-500">No institutional holdings data available</Text>
          <Text className="mt-1 text-sm text-zinc-400">
            Data may need to be synced from SEC EDGAR
          </Text>
        </div>
      )}
    </div>
  )
}
