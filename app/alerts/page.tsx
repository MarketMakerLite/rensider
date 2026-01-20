'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilterInput } from '@/components/twc/filter-input'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { SortableHeader } from '@/components/twc/sortable-header'
import { TablePagination } from '@/components/twc/pagination'
import { SkeletonResponsiveTable, SkeletonCard } from '@/components/ui/Skeleton'
import { MobileFilterSheet, FilterSelect, FilterCheckbox } from '@/components/ui/MobileFilterSheet'
import { getAlertsWithStats } from '@/actions/alerts'
import { formatDate, formatCurrency } from '@/lib/format'
import { useTableSort, useTableFilter, usePagination } from '@/lib/useTableSort'
import {
  useAlertSettings,
  MIN_CHANGE_OPTIONS,
  MAX_CHANGE_OPTIONS,
  MIN_START_VALUE_OPTIONS,
  LOOKBACK_OPTIONS,
} from '@/lib/useAlertSettings'
import { useServerAction } from '@/lib/useServerAction'
import type { Alert } from '@/types/ownership'

export default function AlertsPage() {
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const {
    settings,
    isLoaded,
    updateMinChange,
    updateMaxChange,
    updateMinStartValue,
    updateLookbackMonths,
    updateOnlyMappedAssets,
  } = useAlertSettings()

  // Memoize the action function to prevent infinite loops
  const fetchAlerts = useCallback(
    () => getAlertsWithStats({
      limit: 100,
      minChange: settings.minChange,
      maxChange: settings.maxChange,
      minStartValue: settings.minStartValue,
      lookbackMonths: settings.lookbackMonths,
      onlyMappedAssets: settings.onlyMappedAssets,
    }),
    [settings.minChange, settings.maxChange, settings.minStartValue, settings.lookbackMonths, settings.onlyMappedAssets]
  )

  // Use custom hook instead of TanStack Query
  const { data, isLoading: dataLoading } = useServerAction(fetchAlerts, {
    enabled: isLoaded,
  })

  const alerts = data?.alerts
  const stats = data?.stats
  const isLoading = !isLoaded || dataLoading

  // Find the label for the min start value
  const minStartLabel = MIN_START_VALUE_OPTIONS.find(o => o.value === settings.minStartValue)?.label ?? `$${settings.minStartValue / 1000}M`

  return (
    <ApplicationLayout>
      <div className="max-w-7xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <Heading>Accumulation Signals</Heading>
            {stats && stats.total > 0 && (
              <Badge color="amber">{stats.total} found</Badge>
            )}
          </div>
          <Text className="mt-1 text-zinc-600">
            Stocks with {settings.minChange}x-{settings.maxChange}x institutional ownership increase (min {minStartLabel} start) over {settings.lookbackMonths} months
          </Text>
        </div>

        {/* Mobile Filter Button */}
        <div className="mt-6 md:hidden">
          <button
            onClick={() => setIsFilterSheetOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white text-base font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Adjust Filters
          </button>
        </div>

        {/* Mobile Filter Sheet */}
        <MobileFilterSheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          title="Filter Signals"
        >
          <FilterSelect
            label="Minimum Change"
            value={settings.minChange}
            options={MIN_CHANGE_OPTIONS}
            onChange={(v) => updateMinChange(Number(v))}
          />
          <FilterSelect
            label="Maximum Change"
            value={settings.maxChange}
            options={MAX_CHANGE_OPTIONS}
            onChange={(v) => updateMaxChange(Number(v))}
          />
          <FilterSelect
            label="Minimum Starting Value"
            value={settings.minStartValue}
            options={MIN_START_VALUE_OPTIONS}
            onChange={(v) => updateMinStartValue(Number(v))}
          />
          <FilterSelect
            label="Lookback Period"
            value={settings.lookbackMonths}
            options={LOOKBACK_OPTIONS}
            onChange={(v) => updateLookbackMonths(Number(v))}
          />
          <FilterCheckbox
            label="Known tickers only"
            checked={settings.onlyMappedAssets}
            onChange={updateOnlyMappedAssets}
          />
        </MobileFilterSheet>

        {/* Desktop Settings Panel */}
        <div className="mt-6 hidden flex-wrap items-center gap-4 md:flex">
          <div className="flex items-center gap-2">
            <Text className="text-sm font-medium text-zinc-700">Min Change:</Text>
            <select
              value={settings.minChange}
              onChange={(e) => updateMinChange(Number(e.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-800"
            >
              {MIN_CHANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Text className="text-sm font-medium text-zinc-700">Max Change:</Text>
            <select
              value={settings.maxChange}
              onChange={(e) => updateMaxChange(Number(e.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-800"
            >
              {MAX_CHANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Text className="text-sm font-medium text-zinc-700">Min Start:</Text>
            <select
              value={settings.minStartValue}
              onChange={(e) => updateMinStartValue(Number(e.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-800"
            >
              {MIN_START_VALUE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Text className="text-sm font-medium text-zinc-700">Lookback:</Text>
            <select
              value={settings.lookbackMonths}
              onChange={(e) => updateLookbackMonths(Number(e.target.value))}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-800"
            >
              {LOOKBACK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.onlyMappedAssets}
              onChange={(e) => updateOnlyMappedAssets(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-green-800 focus:ring-green-800"
            />
            <Text className="text-sm font-medium text-zinc-700">Known tickers only</Text>
          </label>
          {isLoading && (
            <Text className="text-sm text-zinc-500">Loading...</Text>
          )}
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">Signals Found</Text>
              <div className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 sm:text-2xl">{stats.total}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">Filter Settings</Text>
              <div className="mt-2 text-lg font-semibold tabular-nums text-zinc-900 sm:text-2xl">{settings.minChange}x-{settings.maxChange}x / {settings.lookbackMonths}mo</div>
            </div>
            <div className="col-span-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">Strongest Momentum</Text>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.topAlerts?.slice(0, 5).map((alert) => (
                  <Link key={alert.ticker} href={`/stock/${alert.ticker}`} prefetch={false}>
                    <Badge color="green">
                      {alert.ticker} ({alert.recentChange?.toFixed(2) ?? alert.changeMultiple.toFixed(1)}x)
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alerts Table */}
        {isLoading ? (
          <div className="mt-8">
            <Subheading level={2}>All Signals</Subheading>
            <div className="mt-4">
              <SkeletonResponsiveTable rows={5} columns={8} />
            </div>
          </div>
        ) : (
          <AlertsTable alerts={alerts || []} />
        )}

        {/* Explanation */}
        <div className="mt-8 border-t border-zinc-200 pt-8">
          <Subheading level={2}>How Signals Work</Subheading>
          <div className="mt-4 grid gap-4 sm:gap-6 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <Text className="font-medium text-zinc-900">How We Find Signals</Text>
              </div>
              <Text className="mt-1 pl-6 text-sm text-zinc-600">
                Scanning 13F filings for stocks where institutional ownership increased {settings.minChange}x-{settings.maxChange}x
                (from a minimum of {minStartLabel}) over {settings.lookbackMonths} months. Sorted by 12-month momentum.
              </Text>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <Text className="font-medium text-zinc-900">Customize</Text>
              </div>
              <Text className="mt-1 pl-6 text-sm text-zinc-600">
                Adjust the min/max change, minimum starting value, and lookback period above to find different accumulation patterns.
                Settings are saved in your browser.
              </Text>
            </div>
          </div>
        </div>
      </div>
    </ApplicationLayout>
  )
}

// Check if ticker is a real ticker (not a CUSIP fallback)
// Real tickers are 1-5 letters only, CUSIPs contain numbers or are 6+ chars
function isRealTicker(ticker: string): boolean {
  return /^[A-Z]{1,5}$/.test(ticker)
}

// Alerts table with filtering and sorting
type AlertSortKey = 'ticker' | 'companyName' | 'changeMultiple' | 'currentValue' | 'filingDate' | 'detectedAt' | 'recentChange' | 'largestHolder' | 'latestFiler'

function AlertsTable({ alerts }: { alerts: Alert[] }) {
  // Filter alerts
  const { filteredData, filterValue, setFilterValue } = useTableFilter(alerts, ['ticker', 'companyName'])

  // Sort filtered data - default by recent 12-month change (momentum)
  const { sortedData, sortState, toggleSort } = useTableSort<Alert, AlertSortKey>(
    filteredData,
    'recentChange'
  )

  // Paginate sorted data
  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Subheading level={2}>All Signals</Subheading>
        <div className="flex items-center gap-4">
          <FilterInput
            type="text"
            placeholder="Filter alerts..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="w-48"
            aria-label="Filter alerts"
          />
        </div>
      </div>

      {alerts.length > 0 ? (
        <>
          <Table className="mt-4" striped>
            <TableHead>
              <TableRow>
                <TableHeader className="w-16">
                  <SortableHeader
                    column="ticker"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                  >
                    Ticker
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-32">
                  <SortableHeader
                    column="companyName"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                  >
                    Company
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-40">
                  <SortableHeader
                    column="largestHolder"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                  >
                    Largest
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-40">
                  <SortableHeader
                    column="latestFiler"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                  >
                    Latest
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-24">
                  <SortableHeader
                    column="filingDate"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                  >
                    Last Filed
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-16 text-center">Prev</TableHeader>
                <TableHeader className="w-16 text-center">
                  <SortableHeader
                    column="currentValue"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                    className="justify-center"
                  >
                    Curr
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-16 text-center">
                  <SortableHeader
                    column="changeMultiple"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as AlertSortKey)}
                    className="justify-center"
                  >
                    Change
                  </SortableHeader>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell className="truncate text-zinc-600">
                    {isRealTicker(alert.ticker) ? (
                      <Link
                        href={`/stock/${alert.ticker}`}
                        className="text-blue-600 hover:underline"
                        prefetch={false}
                      >
                        {alert.ticker}
                      </Link>
                    ) : (
                      alert.ticker
                    )}
                  </TableCell>
                  <TableCell className="truncate text-zinc-600" title={alert.companyName || undefined}>
                    {alert.companyName ? (
                      isRealTicker(alert.ticker) ? (
                        <Link
                          href={`/stock/${alert.ticker}`}
                          prefetch={false}
                          className="text-blue-600 hover:underline"
                        >
                          {alert.companyName}
                        </Link>
                      ) : (
                        alert.companyName
                      )
                    ) : '-'}
                  </TableCell>
                  <TableCell className="w-40 truncate text-zinc-600" title={alert.largestHolder || undefined}>
                    {alert.largestHolder && alert.largestHolderCik ? (
                      <Link
                        href={`/fund/${alert.largestHolderCik}`}
                        className="text-blue-600 hover:underline"
                        prefetch={false}
                      >
                        {alert.largestHolder}
                      </Link>
                    ) : (
                      alert.largestHolder || '-'
                    )}
                  </TableCell>
                  <TableCell className="w-40 truncate text-zinc-600" title={alert.latestFiler || undefined}>
                    {alert.latestFiler && alert.latestFilerCik ? (
                      <Link
                        href={`/fund/${alert.latestFilerCik}`}
                        className="text-blue-600 hover:underline"
                        prefetch={false}
                      >
                        {alert.latestFiler}
                      </Link>
                    ) : (
                      alert.latestFiler || '-'
                    )}
                  </TableCell>
                  <TableCell className="w-24 whitespace-nowrap text-zinc-500">
                    {alert.filingDate ? formatDate(alert.filingDate) : '-'}
                  </TableCell>
                  <TableCell className="w-16 truncate text-center font-mono text-xs">
                    {formatCurrency(alert.previousValue * 1000)}
                  </TableCell>
                  <TableCell className="w-16 truncate text-center font-mono text-xs">
                    {formatCurrency(alert.currentValue * 1000)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge color="zinc" className="font-mono text-xs">
                      {alert.changeMultiple.toFixed(1)}x
                    </Badge>
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
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-500">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <Text className="font-medium text-zinc-700">No accumulation signals found</Text>
          <Text className="mt-2 text-sm text-zinc-500">
            Try adjusting filters: lower the minimum change, extend the lookback period, or include all tickers.
          </Text>
        </div>
      )}
    </div>
  )
}
