'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { getChangeColorClass } from '@/components/common/ChangeIndicator'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilterInput } from '@/components/twc/filter-input'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/twc/table'
import { SortableHeader } from '@/components/twc/sortable-header'
import { TablePagination } from '@/components/twc/pagination'
import { useTableSort, useTableFilter, usePagination } from '@/lib/useTableSort'
import { formatShortDate, formatCurrency, formatNumber, decodeHtmlEntities } from '@/lib/format'
import type { RecentFiler } from '@/types/ownership'

type FilerSortKey = 'institutionName' | 'filingDate' | 'shares' | 'value' | 'changePercent' | 'shareChange'

// Calculate share change from current shares and change percent
function calculateShareChange(shares: number, changePercent: number | null): number | null {
  if (changePercent === null || changePercent === 0) return null
  const previousShares = shares / (1 + changePercent / 100)
  return Math.round(shares - previousShares)
}

function getPositionColor(changeType: RecentFiler['changeType']): 'green' | 'blue' | 'yellow' | 'red' | 'zinc' {
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

interface RecentFilersProps {
  filers: RecentFiler[]
}

export function RecentFilers({ filers }: RecentFilersProps) {
  // Enrich filers with calculated share change
  const enrichedFilers = useMemo(
    () => filers.map((f) => ({
      ...f,
      shareChange: calculateShareChange(f.shares, f.changePercent),
    })),
    [filers]
  )

  // Filter filers by institution name
  const { filteredData, filterValue, setFilterValue } = useTableFilter(enrichedFilers, ['institutionName', 'cik'])

  // Sort filtered data - default to filingDate
  const { sortedData, sortState, toggleSort } = useTableSort<typeof enrichedFilers[0], FilerSortKey>(
    filteredData,
    'filingDate',
    'desc',
    { column: 'shareChange', direction: 'desc' }
  )

  // Paginate sorted data
  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  if (filers.length === 0) {
    return null
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Subheading level={2}>Recent Filers</Subheading>
          <Text className="mt-1 text-sm text-zinc-500">
            Institutions with the most recent 13F filings for this stock
          </Text>
        </div>
        <div className="flex items-center gap-4">
          <FilterInput
            type="text"
            placeholder="Filter institutions..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="w-48"
            aria-label="Filter institutions"
          />
        </div>
      </div>

      <Table className="mt-4" striped>
        <TableHead>
          <TableRow>
            <TableHeader>
              <SortableHeader
                column="institutionName"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as FilerSortKey)}
              >
                Institution
              </SortableHeader>
            </TableHeader>
            <TableHeader className="text-right">
              <SortableHeader
                column="filingDate"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as FilerSortKey)}
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
                onSort={(col) => toggleSort(col as FilerSortKey)}
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
                onSort={(col) => toggleSort(col as FilerSortKey)}
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
                onSort={(col) => toggleSort(col as FilerSortKey)}
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
                onSort={(col) => toggleSort(col as FilerSortKey)}
                className="justify-end"
              >
                Change %
              </SortableHeader>
            </TableHeader>
            <TableHeader>Position</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((filer) => (
            <TableRow key={`${filer.cik}-${filer.filingDate}`}>
              <TableCell>
                <Link
                  href={`/fund/${filer.cik}`}
                  prefetch={false}
                  className="text-blue-600 hover:underline"
                >
                  {decodeHtmlEntities(filer.institutionName)}
                </Link>
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-zinc-500">
                {formatShortDate(filer.filingDate)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(filer.shares)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {filer.shareChange !== null ? (
                  <span className={getChangeColorClass(filer.shareChange)}>
                    {filer.shareChange >= 0 ? '+' : ''}{formatNumber(filer.shareChange)}
                  </span>
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(filer.value * 1000)}
              </TableCell>
              <TableCell className="text-right">
                {filer.changePercent !== null ? (
                  <span className={getChangeColorClass(filer.changePercent)}>
                    {filer.changePercent >= 0 ? '+' : ''}{filer.changePercent.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {filer.changeType && (
                  <Badge color={getPositionColor(filer.changeType)}>
                    {filer.changeType}
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
    </div>
  )
}
