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
import { formatDate, formatShortDate, formatLargeNumber, formatNumber, decodeHtmlEntities } from '@/lib/format'
import type { Filing } from '@/types/ownership'

type FilingSortKey = 'institutionName' | 'cik' | 'quarter' | 'filingDate' | 'holdingsCount' | 'holdingsCountChange' | 'totalValue' | 'totalValueChange'

interface FilingsTableProps {
  filings: Filing[]
}

export function FilingsTable({ filings }: FilingsTableProps) {
  // Filter filings
  const { filteredData, filterValue, setFilterValue } = useTableFilter(filings, ['institutionName', 'cik', 'quarter'])

  // Sort filtered data - default by filing date descending
  const { sortedData, sortState, toggleSort } = useTableSort<Filing, FilingSortKey>(
    filteredData,
    'filingDate'
  )

  // Paginate sorted data
  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Subheading level={2}>Recent Filings</Subheading>
        <div className="flex items-center gap-4">
          <FilterInput
            type="text"
            placeholder="Filter filings..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="w-48"
            aria-label="Filter filings"
          />
        </div>
      </div>

      {filings.length > 0 ? (
        <>
          {/* Mobile Card View */}
          <div className="mt-4 space-y-3 md:hidden">
            {paginatedData.map((filing) => (
              <div
                key={`mobile-${filing.accessionNumber}`}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/fund/${filing.cik}`}
                      prefetch={false}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {decodeHtmlEntities(filing.institutionName)}
                    </Link>
                    <div className="text-xs text-zinc-500">CIK: {filing.cik}</div>
                  </div>
                  <Badge color="blue">{filing.formType}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <span className="text-sm text-zinc-500">{filing.quarter}</span>
                  <span className="text-xs text-zinc-500">{formatShortDate(filing.filingDate)}</span>
                  <a
                    href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.cik}&type=13F&dateb=&owner=include&count=40`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    title="View on SEC EDGAR"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <Table className="mt-4 hidden md:block" striped fixed>
            <TableHead>
              <TableRow>
                <TableHeader className="w-64">
                  <SortableHeader
                    column="institutionName"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as FilingSortKey)}
                  >
                    Institution
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-28">Form</TableHeader>
                <TableHeader className="w-28">
                  <SortableHeader
                    column="quarter"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as FilingSortKey)}
                  >
                    Quarter
                  </SortableHeader>
                </TableHeader>
                <TableHeader className="w-28">
                  <SortableHeader
                    column="filingDate"
                    currentColumn={sortState.column}
                    direction={sortState.direction}
                    onSort={(col) => toggleSort(col as FilingSortKey)}
                  >
                    Filing Date
                  </SortableHeader>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((filing) => (
                <TableRow key={filing.accessionNumber}>
                  <TableCell className="truncate" title={`${decodeHtmlEntities(filing.institutionName)} (${filing.cik})`}>
                    <Link
                      href={`/fund/${filing.cik}`}
                      prefetch={false}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {decodeHtmlEntities(filing.institutionName)} <span className="text-blue-400">({filing.cik})</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <Badge color="blue">{filing.formType}</Badge>
                      <a
                        href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.cik}&type=13F&dateb=&owner=include&count=40`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-blue-600"
                        title="View on SEC EDGAR"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </span>
                  </TableCell>
                  <TableCell>
                    {filing.quarter}
                  </TableCell>
                  <TableCell>
                    {formatDate(filing.filingDate)}
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-500">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <Text className="font-medium text-zinc-700">No recent filings found</Text>
          <Text className="mt-2 text-sm text-zinc-500">
            Filings are updated periodically from SEC EDGAR
          </Text>
        </div>
      )}
    </div>
  )
}
