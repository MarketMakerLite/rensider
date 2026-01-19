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
import { formatDate, formatLargeNumber, formatCurrency, getSecFilingUrl, decodeHtmlEntities } from '@/lib/format'
import type { InsiderTransaction, TransactionCode } from '@/types/insider-sales'

type TransactionSortKey = 'transactionDate' | 'insiderName' | 'ticker' | 'shares' | 'totalValue'

interface InsiderTransactionsTableProps {
  transactions: InsiderTransaction[]
  title?: string
  showCompany?: boolean
  showPrice?: boolean
}

export function InsiderTransactionsTable({
  transactions,
  title = 'Recent Transactions',
  showCompany = true,
  showPrice = false,
}: InsiderTransactionsTableProps) {
  const { filteredData, filterValue, setFilterValue } = useTableFilter(
    transactions,
    ['insiderName', 'ticker', 'issuerName']
  )

  const { sortedData, sortState, toggleSort } = useTableSort<InsiderTransaction, TransactionSortKey>(
    filteredData,
    'transactionDate',
    'desc',
    { column: 'totalValue', direction: 'desc' }
  )

  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  if (transactions.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <Text className="text-zinc-500">No insider transactions found</Text>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Subheading level={2}>{title}</Subheading>
        <FilterInput
          type="text"
          placeholder="Filter transactions..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="w-56"
          aria-label="Filter transactions"
        />
      </div>

      <Table className="mt-4" striped>
        <TableHead>
          <TableRow>
            <TableHeader>
              <SortableHeader
                column="insiderName"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
              >
                Insider
              </SortableHeader>
            </TableHeader>
            <TableHeader>
              <SortableHeader
                column="transactionDate"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
              >
                Date
              </SortableHeader>
            </TableHeader>
            {showCompany && (
              <TableHeader>
                <SortableHeader
                  column="ticker"
                  currentColumn={sortState.column}
                  direction={sortState.direction}
                  onSort={(col) => toggleSort(col as TransactionSortKey)}
                >
                  Company
                </SortableHeader>
              </TableHeader>
            )}
            <TableHeader>Type</TableHeader>
            <TableHeader className="text-right">
              <SortableHeader
                column="shares"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
                className="justify-end"
              >
                Shares
              </SortableHeader>
            </TableHeader>
            {showPrice && <TableHeader className="text-right">Price</TableHeader>}
            <TableHeader className="text-right">
              <SortableHeader
                column="totalValue"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
                className="justify-end"
              >
                Value
              </SortableHeader>
            </TableHeader>
            <TableHeader>Filing</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((transaction, index) => {
            const isSale = transaction.acquiredDisposed === 'D'
            return (
              <TableRow key={`${transaction.accessionNumber}-${index}`}>
                <TableCell className="max-w-xs">
                  <Link
                    href={`/insider/${transaction.insiderCik}`}
                    prefetch={false}
                    className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                  >
                    {decodeHtmlEntities(transaction.insiderName)}
                  </Link>
                  {transaction.insiderTitle && (
                    <div className="text-xs text-zinc-500">{transaction.insiderTitle}</div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-zinc-500">
                  {formatDate(transaction.transactionDate || transaction.filingDate)}
                </TableCell>
                {showCompany && (
                  <TableCell className="max-w-xs">
                    {transaction.ticker ? (
                      <Link
                        href={`/insiders/${transaction.ticker}`}
                        prefetch={false}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {transaction.ticker}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                    {transaction.issuerName && (
                      <div className="truncate text-xs text-zinc-500">
                        {decodeHtmlEntities(transaction.issuerName)}
                      </div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <TransactionBadge code={transaction.transactionCode} isAcquired={!isSale} />
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={isSale ? 'text-red-600' : 'text-green-600'}>
                    {isSale ? '-' : '+'}
                    {formatLargeNumber(transaction.shares)}
                  </span>
                </TableCell>
                {showPrice && (
                  <TableCell className="text-right font-mono">
                    {transaction.pricePerShare ? (
                      `$${transaction.pricePerShare.toFixed(2)}`
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right font-mono">
                  {transaction.totalValue ? (
                    <span className={isSale ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(transaction.totalValue)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={getSecFilingUrl(transaction.accessionNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </TableCell>
              </TableRow>
            )
          })}
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

function TransactionBadge({ code, isAcquired }: { code: TransactionCode; isAcquired: boolean }) {
  const labels: Record<TransactionCode, string> = {
    'P': 'Buy',
    'S': 'Sale',
    'A': 'Award',
    'D': 'Sale to Issuer',
    'F': 'Tax Payment',
    'I': 'Discretionary',
    'M': 'Exercise',
    'C': 'Conversion',
    'E': 'Expiration',
    'H': 'Expiration',
    'O': 'Exercise',
    'X': 'Exercise',
    'G': 'Gift',
    'L': 'Small Acq',
    'W': 'Inheritance',
    'Z': 'Trust',
    'J': 'Other',
    'K': 'Swap',
    'U': 'Tender',
    'V': 'Voluntary',
  }

  const color = isAcquired ? 'green' : 'red'

  return (
    <Badge color={color}>
      {labels[code] || code}
    </Badge>
  )
}
