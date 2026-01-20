'use client'

import Link from 'next/link'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilterInput } from '@/components/twc/filter-input'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { SortableHeader } from '@/components/twc/sortable-header'
import { TablePagination } from '@/components/twc/pagination'
import { useTableSort, useTableFilter, usePagination } from '@/lib/useTableSort'
import { formatDate, formatShortDate, formatLargeNumber, getSecFilingUrl } from '@/lib/format'
import type { ActivistActivity } from '@/types/activists'

type ActivitySortKey = 'filingDate' | 'ownerName' | 'ticker' | 'percentOfClass' | 'shares'

interface ActivistActivityTableProps {
  activities: ActivistActivity[]
  title?: string
}

export function ActivistActivityTable({
  activities,
  title = 'Recent Activist Filings',
}: ActivistActivityTableProps) {
  const { filteredData, filterValue, setFilterValue } = useTableFilter(
    activities,
    ['ownerName', 'ticker', 'issuerName', 'cusip']
  )

  const { sortedData, sortState, toggleSort } = useTableSort<ActivistActivity, ActivitySortKey>(
    filteredData,
    'filingDate'
  )

  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  if (activities.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <Text className="text-zinc-500">No recent activist filings found</Text>
        <Text className="mt-1 text-sm text-zinc-400">
          Try searching for a specific ticker above
        </Text>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="shrink-0">
          <Subheading level={2}>{title}</Subheading>
          <Text className="mt-1 text-sm text-zinc-500">
            Schedule 13D filings from the past 90 days
          </Text>
        </div>
        <FilterInput
          type="text"
          placeholder="Filter filings..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="w-full sm:flex-1 sm:max-w-md"
          aria-label="Filter filings"
        />
      </div>

      {/* Mobile Card View */}
      <div className="mt-4 space-y-3 md:hidden">
        {paginatedData.map((activity) => (
          <div
            key={`mobile-${activity.accessionNumber}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            {/* Header: Target + Intent badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {activity.ticker ? (
                  <Link
                    href={`/stock/${activity.ticker}`}
                    prefetch={false}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {activity.ticker}
                  </Link>
                ) : activity.issuerName ? (
                  <span className="font-medium text-zinc-900">{activity.issuerName}</span>
                ) : (
                  <span className="font-mono text-xs text-zinc-500">CUSIP: {activity.cusip}</span>
                )}
                {activity.issuerName && activity.ticker && (
                  <div className="truncate text-xs text-zinc-500">{activity.issuerName}</div>
                )}
              </div>
              <IntentBadgeMobile intent={activity.intentCategory ?? 'passive'} />
            </div>

            {/* Investor name */}
            <div className="mt-2">
              {activity.ownerCik ? (
                <Link
                  href={`/fund/${activity.ownerCik}`}
                  prefetch={false}
                  className="text-sm text-zinc-700 hover:text-blue-600 hover:underline"
                >
                  {activity.ownerName}
                </Link>
              ) : (
                <span className="text-sm text-zinc-700">{activity.ownerName}</span>
              )}
            </div>

            {/* Footer: Date + Position + Filing */}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
              <span className="text-xs text-zinc-500">
                {activity.filingDate ? formatShortDate(activity.filingDate) : '-'}
              </span>
              {activity.percentOfClass ? (
                <span
                  className="font-mono text-sm font-medium"
                  style={{ color: getPositionColor(activity.percentOfClass) }}
                >
                  {activity.percentOfClass.toFixed(1)}%
                </span>
              ) : (
                <span className="text-xs text-zinc-400">NA</span>
              )}
              <a
                href={getSecFilingUrl(activity.accessionNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                title="View Filing"
              >
                <LinkIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <Table className="mt-4 hidden md:block" striped stickyFirstColumn showScrollIndicators>
        <TableHead>
          <TableRow>
            <TableHeader className="w-24">
              <SortableHeader
                column="filingDate"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as ActivitySortKey)}
              >
                Date
              </SortableHeader>
            </TableHeader>
            <TableHeader className="w-12">
              <SortableHeader
                column="ticker"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as ActivitySortKey)}
              >
                Target
              </SortableHeader>
            </TableHeader>
            <TableHeader className="w-40">
              <SortableHeader
                column="ownerName"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as ActivitySortKey)}
              >
                Investor
              </SortableHeader>
            </TableHeader>
            <TableHeader className="w-20">Intent</TableHeader>
            <TableHeader className="w-8">Filing</TableHeader>
            <TableHeader className="w-20 text-right">
              <SortableHeader
                column="percentOfClass"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as ActivitySortKey)}
                className="justify-end"
              >
                Position
              </SortableHeader>
            </TableHeader>
            <TableHeader className="w-24 text-right">
              <SortableHeader
                column="shares"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as ActivitySortKey)}
                className="justify-end"
              >
                Shares
              </SortableHeader>
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((activity) => (
            <TableRow key={activity.accessionNumber}>
              <TableCell className="max-w-16 whitespace-nowrap text-zinc-500">
                {activity.filingDate ? formatDate(activity.filingDate) : '-'}
              </TableCell>
              <TableCell className="max-w-56">
                {activity.ticker ? (
                  <div>
                    <Link
                      href={`/stock/${activity.ticker}`}
                      prefetch={false}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {activity.ticker}
                    </Link>
                    {activity.issuerName && (
                      <div className="truncate text-xs text-zinc-500" title={activity.issuerName}>
                        {activity.issuerName}
                      </div>
                    )}
                  </div>
                ) : activity.issuerName ? (
                  <div>
                    <span className="font-medium text-zinc-900">{activity.issuerName}</span>
                    {activity.cusip && (
                      <div className="text-xs text-zinc-400">CUSIP: {activity.cusip}</div>
                    )}
                  </div>
                ) : activity.cusip ? (
                  <div>
                    <span className="font-medium text-zinc-600">CUSIP: {activity.cusip}</span>
                  </div>
                ) : (
                  <a
                    href={getSecFilingUrl(activity.accessionNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-blue-600"
                    title="View filing on SEC"
                  >
                    See Filing
                  </a>
                )}
              </TableCell>
              <TableCell className="max-w-64 truncate font-medium">
                {activity.ownerCik ? (
                  <Link
                    href={`/fund/${activity.ownerCik}`}
                    prefetch={false}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {activity.ownerName}
                  </Link>
                ) : (
                  activity.ownerName
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <IntentBadge intent={activity.intentCategory ?? 'passive'} />
              </TableCell>
              <TableCell className="min-w-8 whitespace-nowrap">
                <a
                  href={getSecFilingUrl(activity.accessionNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-blue-600 mx-auto"
                >
                  <LinkIcon className="h-4 w-4 mx-auto" />
                </a>
              </TableCell>
              <TableCell className="whitespace-nowrap text-center">
                {activity.percentOfClass ? (
                  <span
                    className="font-mono font-medium"
                    style={{ color: getPositionColor(activity.percentOfClass) }}
                  >
                    {activity.percentOfClass.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-zinc-400">NA</span>
                )}
              </TableCell>
              <TableCell className="min-w-12 whitespace-nowrap text-center">
                {activity.shares ? (
                  <span className="font-mono text-zinc-600">
                    {formatLargeNumber(activity.shares)}
                  </span>
                ) : (
                  <span className="text-zinc-400">NA</span>
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

function getPositionColor(percent: number): string {
  // Interpolate from black (0%) to green #16a34a (100%)
  const t = Math.min(percent / 100, 1)
  const r = Math.round(0x16 * t)
  const g = Math.round(0xa3 * t)
  const b = Math.round(0x4a * t)
  return `rgb(${r}, ${g}, ${b})`
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

function IntentBadge({ intent }: { intent: string }) {
  const colorMap: Record<string, 'red' | 'orange' | 'yellow' | 'blue' | 'zinc'> = {
    activist: 'red',
    board: 'orange',
    merger: 'yellow',
    proxy: 'orange',
    restructuring: 'yellow',
    passive: 'blue',
  }

  return (
    <Badge color={colorMap[intent] || 'zinc'}>
      {intent.charAt(0).toUpperCase() + intent.slice(1)}
    </Badge>
  )
}

/**
 * Enhanced intent badge for mobile with icon prefix
 */
function IntentBadgeMobile({ intent }: { intent: string }) {
  const colorMap: Record<string, 'red' | 'orange' | 'yellow' | 'blue' | 'zinc'> = {
    activist: 'red',
    board: 'orange',
    merger: 'yellow',
    proxy: 'orange',
    restructuring: 'yellow',
    passive: 'blue',
  }

  const iconMap: Record<string, React.ReactNode> = {
    activist: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    passive: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
  }

  return (
    <Badge color={colorMap[intent] || 'zinc'} className="text-sm inline-flex items-center gap-1">
      {iconMap[intent]}
      {intent.charAt(0).toUpperCase() + intent.slice(1)}
    </Badge>
  )
}
